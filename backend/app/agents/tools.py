"""The agent's tool layer: every function here is plain, deterministic Python
that reads structured production data or runs the constraint solver. Gemini
never computes a schedule itself — it only decides which of these to call, in
what order, and later narrates the results. Each call is logged onto
AgentContext so the exact same trace powers the live activity timeline, the
audit log, and (when configured) the Gemini function-calling loop.

Notably absent: apply_schedule_change. That mutation is only ever reachable
from the human-approval API endpoint (app/api/rescue.py) — it is not a tool
the agent can call, which is what makes "AI proposes, humans approve" true at
the architecture level rather than just a UI convention.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

import app.models as m
from app.services import impact_service as impact_svc
from app.services import scheduling_service as sched
from app.services import weather_service
from app.services.partner_service import get_partner_service
from app.services.interval_utils import fmt_hm, parse_hm
from app.services.scheduling_models import Assignment, CandidateSchedule, DayContext, ParsedDisruption


@dataclass
class AgentContext:
    db: Session
    shooting_day: m.ShootingDay
    production: m.Production
    day_context: DayContext
    disruptions: list[ParsedDisruption] = field(default_factory=list)
    original_assignments: list[Assignment] = field(default_factory=list)
    affected_scenes: list = field(default_factory=list)
    candidates: list[CandidateSchedule] = field(default_factory=list)
    impacts: dict = field(default_factory=dict)  # candidate_index -> ImpactResult
    recommended_index: Optional[int] = None
    log: list[dict] = field(default_factory=list)

    def record(self, tool_name: str, input_data: dict, output_data: dict, summary: str) -> None:
        self.log.append({"tool_name": tool_name, "input": input_data, "output": output_data, "summary": summary})


def _plan_label(index: int) -> str:
    return f"Plan {chr(65 + index)}"


def get_current_schedule(ctx: AgentContext, **_) -> dict:
    version = (
        ctx.db.query(m.ScheduleVersion)
        .filter_by(shooting_day_id=ctx.shooting_day.id, is_current=True)
        .first()
    )
    rows = sorted(version.assignments, key=lambda a: a.start_min) if version else []
    ctx.original_assignments = [Assignment(a.scene_id, a.start_min, a.end_min, a.location_id) for a in rows]
    scenes = [
        {
            "scene_id": a.scene_id,
            "scene_number": ctx.day_context.scene_by_id(a.scene_id).scene_number,
            "title": ctx.day_context.scene_by_id(a.scene_id).title,
            "start": fmt_hm(a.start_min),
            "end": fmt_hm(a.end_min),
        }
        for a in rows
    ]
    out = {"scenes": scenes}
    ctx.record("get_current_schedule", {}, out, f"Retrieved today's shooting schedule: {len(scenes)} scenes")
    return out


def get_scene(ctx: AgentContext, scene_id: int, **_) -> dict:
    scene = ctx.day_context.scene_by_id(int(scene_id))
    out = {
        "scene_id": scene.id, "scene_number": scene.scene_number, "title": scene.title, "int_ext": scene.int_ext,
        "duration_min": scene.duration_min, "weather_requirement": scene.weather_requirement,
        "daylight_required": scene.daylight_required, "priority": scene.priority,
        "actors": [ctx.day_context.actor_names.get(a) for a in scene.actor_ids],
        "equipment": [ctx.day_context.equipment_names.get(e) for e in scene.equipment_ids],
        "location": ctx.day_context.location_names.get(scene.location_id),
        "depends_on": scene.depends_on_scene_ids,
    }
    ctx.record("get_scene", {"scene_id": scene_id}, out, f"Retrieved Scene {scene.scene_number} details")
    return out


def check_actor_availability(ctx: AgentContext, actor_ids: list[int], start: str, end: str, **_) -> dict:
    s, e = parse_hm(start), parse_hm(end)
    conflicts = []
    for aid in actor_ids:
        windows = ctx.day_context.actor_windows.get(aid, [(ctx.day_context.day_start, ctx.day_context.day_end)])
        if not any(w[0] <= s and e <= w[1] for w in windows):
            conflicts.append({"actor_id": aid, "name": ctx.day_context.actor_names.get(aid)})
    out = {"conflicts": conflicts, "all_available": len(conflicts) == 0}
    summary = f"Checked {len(actor_ids)} cast member(s) for {start}-{end}: " + (
        "no conflicts" if not conflicts else f"{len(conflicts)} unavailable"
    )
    ctx.record("check_actor_availability", {"actor_ids": actor_ids, "start": start, "end": end}, out, summary)
    return out


def check_location_availability(ctx: AgentContext, location_id: int, start: str, end: str, **_) -> dict:
    s, e = parse_hm(start), parse_hm(end)
    windows = ctx.day_context.location_windows.get(location_id, [(ctx.day_context.day_start, ctx.day_context.day_end)])
    available = any(w[0] <= s and e <= w[1] for w in windows)
    out = {"available": available, "location": ctx.day_context.location_names.get(location_id)}
    ctx.record("check_location_availability", {"location_id": location_id, "start": start, "end": end}, out,
               f"Checked {out['location']} for {start}-{end}: {'available' if available else 'unavailable'}")
    return out


def check_equipment_availability(ctx: AgentContext, equipment_ids: list[int], start: str, end: str, **_) -> dict:
    s, e = parse_hm(start), parse_hm(end)
    conflicts = []
    for eid in equipment_ids:
        windows = ctx.day_context.equipment_windows.get(eid, [(ctx.day_context.day_start, ctx.day_context.day_end)])
        if not any(w[0] <= s and e <= w[1] for w in windows):
            conflicts.append({"equipment_id": eid, "name": ctx.day_context.equipment_names.get(eid)})
    out = {"conflicts": conflicts, "all_available": len(conflicts) == 0}
    summary = f"Checked {len(equipment_ids)} equipment item(s) for {start}-{end}: " + (
        "no conflicts" if not conflicts else f"{len(conflicts)} unavailable"
    )
    ctx.record("check_equipment_availability", {"equipment_ids": equipment_ids, "start": start, "end": end}, out, summary)
    return out


def get_weather(ctx: AgentContext, location: str, date: str, **_) -> dict:
    out = weather_service.get_weather(location, date, ctx.disruptions)
    ctx.record("get_weather", {"location": location, "date": date}, out, f"Weather for {location}: {out['condition']}")
    return out


def research_external_context(ctx: AgentContext, query: str, **_) -> dict:
    """Partner integration (Parallel): look outward for real-world context a
    production's own database can't provide, e.g. whether a location's permit
    was actually revoked, or a nearby event/closure is affecting access."""
    result = get_partner_service().research_context(query)
    out = {
        "query": result.query, "source": result.source,
        "results": [{"title": r.title, "url": r.url, "excerpt": r.excerpt} for r in result.results],
    }
    summary = f"Researched '{query}' via Parallel ({result.source}): {len(result.results)} result(s)"
    ctx.record("research_external_context", {"query": query}, out, summary)
    return out


def detect_affected_scenes(ctx: AgentContext, **_) -> dict:
    affected = sched.detect_affected_scenes(ctx.day_context, ctx.original_assignments)
    ctx.affected_scenes = affected
    scenes = [
        {"scene_id": a.scene_id, "scene_number": a.scene_number, "title": a.title,
         "reasons": [{"code": c, "message": msg} for c, msg in a.reasons]}
        for a in affected
    ]
    out = {"affected_scenes": scenes}
    ctx.record("detect_affected_scenes", {}, out, f"Identified {len(scenes)} affected scene(s)")
    return out


def generate_candidate_schedules(ctx: AgentContext, **_) -> dict:
    raw = sched.generate_candidate_schedules(ctx.day_context)
    ctx.candidates = sched.evaluate_candidates(ctx.day_context, raw)
    valid = [c for c in ctx.candidates if c.valid]
    out = {"total_generated": len(ctx.candidates), "valid": len(valid)}
    ctx.record("generate_candidate_schedules", {}, out,
               f"{len(ctx.candidates)} candidate schedules generated, {len(valid)} passed all hard constraints")
    return out


def validate_schedule(ctx: AgentContext, candidate_index: int = 0, **_) -> dict:
    c = ctx.candidates[candidate_index]
    out = {"valid": c.valid, "violations": [v.message for v in c.violations], "warnings": [w.message for w in c.warnings]}
    summary = f"{_plan_label(candidate_index)}: " + ("all hard constraints satisfied" if c.valid else f"{len(c.violations)} violation(s)")
    ctx.record("validate_schedule", {"candidate_index": candidate_index}, out, summary)
    return out


def calculate_schedule_score(ctx: AgentContext, candidate_index: int = 0, **_) -> dict:
    c = ctx.candidates[candidate_index]
    out = {"score": c.score, "breakdown": c.score_breakdown}
    ctx.record("calculate_schedule_score", {"candidate_index": candidate_index}, out,
               f"{_plan_label(candidate_index)} scored {c.score}/100")
    return out


def calculate_impact(ctx: AgentContext, candidate_index: int = 0, **_) -> dict:
    c = ctx.candidates[candidate_index]
    result = impact_svc.calculate_impact(ctx.day_context, ctx.original_assignments, c, float(ctx.production.daily_budget))
    ctx.impacts[candidate_index] = result
    out = {
        "downtime_hours_avoided": result.downtime_hours_avoided,
        "scenes_saved": result.scenes_saved,
        "scenes_preserved_of_total": list(result.scenes_preserved_of_total),
        "scenes_delayed": result.scenes_delayed,
        "estimated_cost_avoided": result.estimated_cost_avoided,
        "company_moves_change": result.company_moves_change,
    }
    ctx.record("calculate_impact", {"candidate_index": candidate_index}, out,
               f"{_plan_label(candidate_index)} impact: {result.downtime_hours_avoided}h downtime avoided, "
               f"${result.estimated_cost_avoided:,.0f} cost avoided")
    return out


def propose_schedule_change(ctx: AgentContext, candidate_index: int = 0, **_) -> dict:
    ctx.recommended_index = candidate_index
    c = ctx.candidates[candidate_index]
    out = {"candidate_index": candidate_index, "score": c.score, "scenes_included": len(c.assignments),
           "scenes_dropped": len(c.dropped_scene_ids)}
    ctx.record("propose_schedule_change", {"candidate_index": candidate_index}, out,
               f"Recommendation ready: {_plan_label(candidate_index)} (score {c.score})")
    return out


TOOL_FUNCTIONS: dict[str, Callable[..., dict]] = {
    "get_current_schedule": get_current_schedule,
    "get_scene": get_scene,
    "check_actor_availability": check_actor_availability,
    "check_location_availability": check_location_availability,
    "check_equipment_availability": check_equipment_availability,
    "get_weather": get_weather,
    "research_external_context": research_external_context,
    "detect_affected_scenes": detect_affected_scenes,
    "generate_candidate_schedules": generate_candidate_schedules,
    "validate_schedule": validate_schedule,
    "calculate_schedule_score": calculate_schedule_score,
    "calculate_impact": calculate_impact,
    "propose_schedule_change": propose_schedule_change,
}

# JSON-schema tool declarations for Gemini function calling. Kept separate from
# TOOL_FUNCTIONS so the same registry can be handed to google.genai.types.Tool.
TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {"name": "get_current_schedule", "description": "Get today's currently active shooting schedule.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "get_scene", "description": "Get full detail for one scene, including cast, location, equipment, and constraints.",
     "parameters": {"type": "object", "properties": {"scene_id": {"type": "integer"}}, "required": ["scene_id"]}},
    {"name": "check_actor_availability", "description": "Check whether the given actors are available for a time window.",
     "parameters": {"type": "object", "properties": {
         "actor_ids": {"type": "array", "items": {"type": "integer"}},
         "start": {"type": "string", "description": "HH:MM 24h"}, "end": {"type": "string", "description": "HH:MM 24h"},
     }, "required": ["actor_ids", "start", "end"]}},
    {"name": "check_location_availability", "description": "Check whether a location is available for a time window.",
     "parameters": {"type": "object", "properties": {
         "location_id": {"type": "integer"}, "start": {"type": "string"}, "end": {"type": "string"},
     }, "required": ["location_id", "start", "end"]}},
    {"name": "check_equipment_availability", "description": "Check whether the given equipment is available for a time window.",
     "parameters": {"type": "object", "properties": {
         "equipment_ids": {"type": "array", "items": {"type": "integer"}},
         "start": {"type": "string"}, "end": {"type": "string"},
     }, "required": ["equipment_ids", "start", "end"]}},
    {"name": "get_weather", "description": "Get the weather forecast for a location and date.",
     "parameters": {"type": "object", "properties": {"location": {"type": "string"}, "date": {"type": "string"}},
                     "required": ["location", "date"]}},
    {"name": "research_external_context", "description": "Research real-world context beyond the production's own "
     "data via the Parallel partner API — e.g. whether a location's permit was actually revoked, or a nearby "
     "closure/event is affecting access. Use this for location_unavailable disruptions or to corroborate weather.",
     "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "detect_affected_scenes", "description": "Determine which of today's scheduled scenes are affected by the reported disruptions, and why.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "generate_candidate_schedules", "description": "Run the constraint solver to generate and score alternative schedules for today.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "validate_schedule", "description": "Re-validate one generated candidate schedule (by its index) against all hard constraints.",
     "parameters": {"type": "object", "properties": {"candidate_index": {"type": "integer"}}}},
    {"name": "calculate_schedule_score", "description": "Get the weighted feasibility/downtime/cast/location/equipment/priority score for one candidate.",
     "parameters": {"type": "object", "properties": {"candidate_index": {"type": "integer"}}}},
    {"name": "calculate_impact", "description": "Calculate downtime avoided, cost avoided, and scenes saved for one candidate vs. doing nothing.",
     "parameters": {"type": "object", "properties": {"candidate_index": {"type": "integer"}}}},
    {"name": "propose_schedule_change", "description": "Finalize the recommended candidate as the proposed rescue plan, pending human approval.",
     "parameters": {"type": "object", "properties": {"candidate_index": {"type": "integer"}}}},
]
