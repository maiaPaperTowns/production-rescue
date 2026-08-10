"""Runs one end-to-end rescue analysis: parse -> investigate -> generate ->
validate -> score -> impact -> propose. If Gemini is configured, it drives
tool selection itself via real function calling; otherwise (or if that call
fails for any reason) a deterministic pipeline runs the identical tool
functions in the documented order. Either way, every tool call is persisted
as an AgentAction so the live activity timeline and audit log reflect what
actually happened on the backend, never a fabricated animation.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import app.models as m
from app.agents.prompts import EXPLANATION_PROMPT_TEMPLATE, ORCHESTRATOR_SYSTEM_PROMPT
from app.agents.tools import (
    TOOL_DECLARATIONS,
    TOOL_FUNCTIONS,
    AgentContext,
    calculate_impact,
    calculate_schedule_score,
    check_actor_availability,
    check_equipment_availability,
    check_location_availability,
    detect_affected_scenes,
    generate_candidate_schedules,
    get_current_schedule,
    get_weather,
    propose_schedule_change,
    validate_schedule,
)
from app.core.config import get_settings
from app.services import gemini_service
from app.services.interval_utils import fmt_hm
from app.services.scheduling_service import build_day_context, disruption_items_to_parsed

logger = logging.getLogger(__name__)
settings = get_settings()
MAX_TOOL_STEPS = 16

_TYPE_MAP = {"object": "OBJECT", "string": "STRING", "integer": "INTEGER", "number": "NUMBER",
             "array": "ARRAY", "boolean": "BOOLEAN"}


def _convert_schema(schema: dict) -> dict:
    out = dict(schema)
    if "type" in out:
        out["type"] = _TYPE_MAP.get(out["type"], out["type"])
    if "properties" in out:
        out["properties"] = {k: _convert_schema(v) for k, v in out["properties"].items()}
    if "items" in out:
        out["items"] = _convert_schema(out["items"])
    return out


def get_known_names(db: Session, shooting_day_id: int) -> dict:
    scenes = db.query(m.Scene).filter(m.Scene.shooting_day_id == shooting_day_id).all()
    actor_ids, location_ids, equipment_ids = set(), set(), set()
    for s in scenes:
        location_ids.add(s.location_id)
        for link in s.cast_links:
            actor_ids.add(link.actor_id)
        for link in s.equipment_links:
            equipment_ids.add(link.equipment_id)
    actors = db.query(m.Actor).filter(m.Actor.id.in_(actor_ids)).all() if actor_ids else []
    locations = db.query(m.Location).filter(m.Location.id.in_(location_ids)).all() if location_ids else []
    equipment = db.query(m.Equipment).filter(m.Equipment.id.in_(equipment_ids)).all() if equipment_ids else []
    return {
        "actors": [a.name for a in actors],
        "locations": [loc.name for loc in locations],
        "equipment": [e.name for e in equipment],
    }


def _deterministic_pipeline(ctx: AgentContext) -> None:
    get_current_schedule(ctx)
    detect_affected_scenes(ctx)

    checked_actors, checked_locations, checked_equipment = set(), set(), set()
    for affected in ctx.affected_scenes:
        scene = ctx.day_context.scene_by_id(affected.scene_id)
        orig = next(a for a in ctx.original_assignments if a.scene_id == scene.id)
        start, end = fmt_hm(orig.start_min), fmt_hm(orig.end_min)

        new_actor_ids = [a for a in scene.actor_ids if a not in checked_actors]
        if new_actor_ids:
            check_actor_availability(ctx, actor_ids=new_actor_ids, start=start, end=end)
            checked_actors.update(new_actor_ids)

        if scene.location_id not in checked_locations:
            check_location_availability(ctx, location_id=scene.location_id, start=start, end=end)
            checked_locations.add(scene.location_id)

        new_equipment_ids = [e for e in scene.equipment_ids if e not in checked_equipment]
        if new_equipment_ids:
            check_equipment_availability(ctx, equipment_ids=new_equipment_ids, start=start, end=end)
            checked_equipment.update(new_equipment_ids)

    if any(d.type == "weather" for d in ctx.disruptions):
        exterior_locations = {
            ctx.day_context.scene_by_id(a.scene_id).location_id for a in ctx.original_assignments
            if ctx.day_context.scene_by_id(a.scene_id).weather_requirement == "dry"
        }
        for loc_id in exterior_locations:
            get_weather(ctx, location=ctx.day_context.location_names.get(loc_id, "set"),
                        date=str(ctx.shooting_day.shoot_date))

    generate_candidate_schedules(ctx)
    top_indices = [i for i, c in enumerate(ctx.candidates) if c.valid][:3]
    for idx in top_indices:
        validate_schedule(ctx, candidate_index=idx)
        calculate_schedule_score(ctx, candidate_index=idx)
        calculate_impact(ctx, candidate_index=idx)

    if top_indices:
        propose_schedule_change(ctx, candidate_index=top_indices[0])


def _run_gemini_tool_loop(ctx: AgentContext) -> bool:
    if not settings.gemini_configured:
        return False
    try:
        from google import genai
        from google.genai import types

        if settings.google_genai_use_vertexai:
            client = genai.Client(vertexai=True, project=settings.google_cloud_project, location=settings.google_cloud_location)
        else:
            client = genai.Client(api_key=settings.google_api_key)

        tool = types.Tool(function_declarations=[
            types.FunctionDeclaration(name=t["name"], description=t["description"], parameters=_convert_schema(t["parameters"]))
            for t in TOOL_DECLARATIONS
        ])
        config = types.GenerateContentConfig(tools=[tool], system_instruction=ORCHESTRATOR_SYSTEM_PROMPT, temperature=0.2)

        disruption_desc = "; ".join(
            f"{d.type}: " + json.dumps({k: v for k, v in d.__dict__.items() if v not in (None, [], "")})
            for d in ctx.disruptions
        ) or "none reported"
        contents = [types.Content(role="user", parts=[
            types.Part(text=f"Disruptions reported for today's shooting day: {disruption_desc}. Begin your investigation.")
        ])]

        for _ in range(MAX_TOOL_STEPS):
            response = client.models.generate_content(model=settings.gemini_model, contents=contents, config=config)
            candidate = response.candidates[0]
            function_calls = [p.function_call for p in candidate.content.parts if p.function_call]
            if not function_calls:
                break
            contents.append(candidate.content)

            response_parts = []
            proposed = False
            for fc in function_calls:
                fn = TOOL_FUNCTIONS.get(fc.name)
                args = dict(fc.args or {})
                result = fn(ctx, **args) if fn else {"error": f"unknown tool {fc.name}"}
                response_parts.append(types.Part.from_function_response(name=fc.name, response=result))
                if fc.name == "propose_schedule_change":
                    proposed = True
            contents.append(types.Content(role="tool", parts=response_parts))
            if proposed:
                break

        return ctx.recommended_index is not None
    except Exception:
        logger.exception("Gemini tool-calling loop failed; falling back to deterministic pipeline")
        return False


def _plan_description(ctx: AgentContext, index: int) -> str:
    c = ctx.candidates[index]
    moved = []
    for a in sorted(c.assignments, key=lambda x: x.start_min):
        orig = next((o for o in ctx.original_assignments if o.scene_id == a.scene_id), None)
        scene = ctx.day_context.scene_by_id(a.scene_id)
        if orig and orig.start_min != a.start_min:
            moved.append(f"Scene {scene.scene_number} moved {fmt_hm(orig.start_min)} to {fmt_hm(a.start_min)}")
    dropped_desc = ""
    if c.dropped_scene_ids:
        names = ", ".join(f"Scene {ctx.day_context.scene_by_id(sid).scene_number}" for sid in c.dropped_scene_ids)
        dropped_desc = f" {names} could not be fit into today and should move to another shooting day."
    return ("; ".join(moved) or "Scene order preserved") + "." + dropped_desc


def run_rescue_analysis(db: Session, shooting_day_id: int, raw_text: str) -> m.AgentRun:
    started = time.monotonic()
    shooting_day = db.get(m.ShootingDay, shooting_day_id)
    production = db.get(m.Production, shooting_day.production_id)

    known_names = get_known_names(db, shooting_day_id)
    parse_result = gemini_service.parse_disruption_text(raw_text, known_names)
    parsed_disruptions = disruption_items_to_parsed(parse_result.disruptions)

    disruption_row = m.Disruption(
        shooting_day_id=shooting_day_id, raw_text=raw_text,
        disruption_type=parsed_disruptions[0].type if parsed_disruptions else "unknown",
        payload={"items": [d.model_dump(exclude_none=True) for d in parse_result.disruptions], "summary": parse_result.summary},
    )
    db.add(disruption_row)

    day_context = build_day_context(db, shooting_day_id, parsed_disruptions)
    ctx = AgentContext(db=db, shooting_day=shooting_day, production=production,
                        day_context=day_context, disruptions=parsed_disruptions)

    run = m.AgentRun(shooting_day_id=shooting_day_id, disruption_summary=parse_result.summary, status="running")
    db.add(run)
    db.flush()

    used_gemini = _run_gemini_tool_loop(ctx)
    if not used_gemini:
        _deterministic_pipeline(ctx)

    for i, entry in enumerate(ctx.log):
        db.add(m.AgentAction(
            agent_run_id=run.id, seq=i, tool_name=entry["tool_name"], summary=entry["summary"],
            input_json=entry["input"], output_json=entry["output"], status="completed",
        ))

    run.candidates_generated = len(ctx.candidates)
    run.candidates_valid = len([c for c in ctx.candidates if c.valid])

    if ctx.recommended_index is None:
        run.status = "infeasible"
        blocking = []
        for affected in ctx.affected_scenes:
            for code, message in affected.reasons:
                blocking.append(f"Scene {affected.scene_number} ({affected.title}): {message}")
        run.blocking_constraints = blocking
        run.explanation = (
            "No conflict-free rescue plan could be found for today given the current constraints. "
            + " ".join(blocking[:4])
            + " Consider: extending an actor's availability, substituting the location or equipment, "
              "or moving the affected scene(s) to another shooting day."
        )
        run.completed_at = datetime.utcnow()
        run.execution_ms = int((time.monotonic() - started) * 1000)
        db.commit()
        return run

    best_index = ctx.recommended_index
    top_indices = [best_index] + [i for i in ctx.impacts.keys() if i != best_index]
    top_indices = top_indices[:3]

    created_versions: list[m.ScheduleVersion] = []
    latest_version_number = (
        db.query(m.ScheduleVersion).filter_by(shooting_day_id=shooting_day_id).count()
    )
    for rank, idx in enumerate(top_indices):
        c = ctx.candidates[idx]
        version = m.ScheduleVersion(
            shooting_day_id=shooting_day_id, version_number=latest_version_number + 1 + rank,
            status="PROPOSED", created_by="agent", label=f"Plan {chr(65 + rank)}",
            score=c.score, is_current=False, agent_run_id=run.id,
        )
        db.add(version)
        db.flush()
        for a in c.assignments:
            orig = next((o for o in ctx.original_assignments if o.scene_id == a.scene_id), None)
            reason = ""
            scene = ctx.day_context.scene_by_id(a.scene_id)
            if orig and orig.start_min != a.start_min:
                affected = next((af for af in ctx.affected_scenes if af.scene_id == scene.id), None)
                reason = affected.reasons[0][1] if affected and affected.reasons else "Rescheduled to satisfy updated constraints"
            db.add(m.ScheduleAssignment(
                schedule_version_id=version.id, scene_id=a.scene_id, start_min=a.start_min, end_min=a.end_min,
                location_id=a.location_id, status="scheduled", change_reason=reason,
            ))
        for scene_id in c.dropped_scene_ids:
            db.add(m.ScheduleAssignment(
                schedule_version_id=version.id, scene_id=scene_id, start_min=0, end_min=0,
                location_id=ctx.day_context.scene_by_id(scene_id).location_id, status="dropped",
                change_reason="Could not be scheduled today; recommend moving to another shooting day",
            ))
        created_versions.append(version)

    run.recommended_schedule_version_id = created_versions[0].id
    impact = ctx.impacts.get(best_index)
    impact_summary = (
        f"{impact.downtime_hours_avoided}h downtime avoided, ${impact.estimated_cost_avoided:,.0f} cost avoided, "
        f"{impact.scenes_preserved_of_total[0]}/{impact.scenes_preserved_of_total[1]} scenes preserved"
    ) if impact else "impact not calculated"
    run.explanation = gemini_service.explain_recommendation(
        disruption_summary=parse_result.summary,
        plan_description=_plan_description(ctx, best_index),
        impact_summary=impact_summary,
    )
    run.status = "proposed"
    run.completed_at = datetime.utcnow()
    run.execution_ms = int((time.monotonic() - started) * 1000)
    db.commit()
    return run
