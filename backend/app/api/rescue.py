import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import app.models as m
from app.agents.orchestrator import run_rescue_analysis
from app.api.schedule import assignment_to_out
from app.core.database import get_db
from app.schemas.rescue import (
    AgentActionOut,
    AgentRunOut,
    ApprovalRequest,
    ApprovalResult,
    ImpactOut,
    PlanOut,
    RescueAnalyzeRequest,
)

router = APIRouter(tags=["rescue"])


def _plan_to_out(version: m.ScheduleVersion, db: Session, recommended_id: int) -> PlanOut:
    dropped = [
        db.get(m.Scene, a.scene_id).scene_number
        for a in version.assignments if a.status == "dropped"
    ]
    scheduled = [a for a in version.assignments if a.status != "dropped"]
    return PlanOut(
        schedule_version_id=version.id, label=version.label, score=float(version.score),
        recommended=(version.id == recommended_id),
        assignments=[assignment_to_out(a, db) for a in sorted(scheduled, key=lambda x: x.start_min)],
        dropped_scenes=dropped,
        impact=ImpactOut(
            downtime_hours_avoided=float(version.downtime_hours_avoided),
            scenes_saved=version.scenes_saved, scenes_preserved=version.scenes_preserved,
            scenes_total=version.scenes_total, scenes_delayed=version.scenes_delayed,
            changed_call_times=version.changed_call_times, company_moves_change=version.company_moves_change,
            overtime_change_minutes=version.overtime_change_minutes,
            estimated_cost_avoided=float(version.estimated_cost_avoided),
        ),
    )


def _run_to_out(run: m.AgentRun, db: Session) -> AgentRunOut:
    plans = db.query(m.ScheduleVersion).filter_by(agent_run_id=run.id).order_by(m.ScheduleVersion.version_number).all()
    return AgentRunOut(
        id=run.id, shooting_day_id=run.shooting_day_id, status=run.status,
        disruption_summary=run.disruption_summary, candidates_generated=run.candidates_generated,
        candidates_valid=run.candidates_valid, explanation=run.explanation,
        blocking_constraints=run.blocking_constraints or [], affected_scene_ids=run.affected_scene_ids or [],
        execution_ms=run.execution_ms,
        started_at=run.started_at, completed_at=run.completed_at,
        recommended_schedule_version_id=run.recommended_schedule_version_id,
        plans=[_plan_to_out(v, db, run.recommended_schedule_version_id) for v in plans],
        actions=[AgentActionOut(seq=a.seq, tool_name=a.tool_name, summary=a.summary, timestamp=a.timestamp)
                 for a in sorted(run.actions, key=lambda x: x.seq)],
    )


@router.post("/api/rescue/analyze", response_model=AgentRunOut)
def analyze_disruption(payload: RescueAnalyzeRequest, db: Session = Depends(get_db)):
    day = db.get(m.ShootingDay, payload.shooting_day_id)
    if day is None:
        raise HTTPException(404, "Shooting day not found")
    if not payload.raw_text.strip():
        raise HTTPException(422, "raw_text must not be empty")
    try:
        run = run_rescue_analysis(db, payload.shooting_day_id, payload.raw_text)
    except Exception as exc:
        raise HTTPException(500, f"Rescue analysis failed: {exc}") from exc
    return _run_to_out(run, db)


@router.get("/api/agent-runs/{run_id}", response_model=AgentRunOut)
def get_agent_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(m.AgentRun, run_id)
    if run is None:
        raise HTTPException(404, "Agent run not found")
    return _run_to_out(run, db)


@router.get("/api/agent-runs")
def list_agent_runs(shooting_day_id: Optional[int] = None, limit: int = 25, db: Session = Depends(get_db)):
    query = db.query(m.AgentRun).order_by(m.AgentRun.started_at.desc())
    if shooting_day_id is not None:
        query = query.filter(m.AgentRun.shooting_day_id == shooting_day_id)
    runs = query.limit(limit).all()
    return [_run_to_out(r, db) for r in runs]


@router.get("/api/agent-runs/{run_id}/events")
async def stream_agent_run_events(run_id: int, db: Session = Depends(get_db)):
    """Server-Sent Events stream of an already-completed run's tool-call log.
    The analysis itself runs synchronously (it completes in well under a
    second against the solver), so this replays the real, persisted
    AgentAction rows with a short pacing delay purely so the frontend can
    render a legible step-by-step timeline instead of dumping 20 events at once."""
    run = db.get(m.AgentRun, run_id)
    if run is None:
        raise HTTPException(404, "Agent run not found")
    actions = sorted(run.actions, key=lambda a: a.seq)

    async def event_generator():
        for action in actions:
            payload = {"seq": action.seq, "tool_name": action.tool_name, "summary": action.summary}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.15)
        yield f"data: {json.dumps({'done': True, 'status': run.status})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/rescue/{run_id}/alternatives")
def get_alternatives(run_id: int, db: Session = Depends(get_db)):
    run = db.get(m.AgentRun, run_id)
    if run is None:
        raise HTTPException(404, "Agent run not found")
    plans = db.query(m.ScheduleVersion).filter_by(agent_run_id=run_id).order_by(m.ScheduleVersion.version_number).all()
    return [_plan_to_out(v, db, run.recommended_schedule_version_id) for v in plans]


@router.post("/api/rescue/{run_id}/approve", response_model=ApprovalResult)
def approve_rescue(run_id: int, payload: ApprovalRequest, db: Session = Depends(get_db)):
    run = db.get(m.AgentRun, run_id)
    if run is None:
        raise HTTPException(404, "Agent run not found")
    if run.status != "proposed":
        raise HTTPException(409, f"Cannot approve a run with status '{run.status}'")
    version = db.get(m.ScheduleVersion, run.recommended_schedule_version_id)
    if version is None:
        raise HTTPException(409, "No recommended schedule version to approve")

    # The only place in the whole codebase that ever mutates the active schedule.
    previous_active = db.query(m.ScheduleVersion).filter_by(
        shooting_day_id=run.shooting_day_id, is_current=True
    ).first()
    if previous_active:
        previous_active.is_current = False

    version.status = "APPROVED"
    version.is_current = True
    run.status = "approved"

    db.add(m.Approval(agent_run_id=run.id, schedule_version_id=version.id, decision="approved",
                       decided_by=payload.decided_by, notes=payload.notes))

    day = db.get(m.ShootingDay, run.shooting_day_id)
    if any(a.status == "dropped" for a in version.assignments):
        day.status = "at_risk"
    else:
        day.status = "on_track"

    db.commit()
    return ApprovalResult(
        schedule_version_id=version.id, new_version_number=version.version_number,
        assignments_updated=len([a for a in version.assignments if a.status != "dropped"]), status="APPROVED",
    )


@router.post("/api/rescue/{run_id}/reject", response_model=ApprovalResult)
def reject_rescue(run_id: int, payload: ApprovalRequest, db: Session = Depends(get_db)):
    run = db.get(m.AgentRun, run_id)
    if run is None:
        raise HTTPException(404, "Agent run not found")
    if run.status != "proposed":
        raise HTTPException(409, f"Cannot reject a run with status '{run.status}'")
    version = db.get(m.ScheduleVersion, run.recommended_schedule_version_id)

    for v in db.query(m.ScheduleVersion).filter_by(agent_run_id=run.id).all():
        v.status = "REJECTED"
    run.status = "rejected"

    db.add(m.Approval(agent_run_id=run.id, schedule_version_id=version.id, decision="rejected",
                       decided_by=payload.decided_by, notes=payload.notes))
    db.commit()
    return ApprovalResult(schedule_version_id=version.id, new_version_number=version.version_number,
                           assignments_updated=0, status="REJECTED")
