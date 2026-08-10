from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import app.models as m
from app.core.database import get_db
from app.schemas.analytics import AnalyticsOut

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db)):
    runs = db.query(m.AgentRun).filter(m.AgentRun.status != "running").all()
    completed = [r for r in runs if r.status in ("proposed", "approved", "rejected")]
    approved_versions = (
        db.query(m.ScheduleVersion)
        .filter(m.ScheduleVersion.status == "APPROVED", m.ScheduleVersion.created_by == "agent")
        .all()
    )

    hours_saved = sum(float(v.downtime_hours_avoided) for v in approved_versions)
    cost_avoided = sum(float(v.estimated_cost_avoided) for v in approved_versions)

    disruption_type_counts: Counter = Counter()
    for r in runs:
        for d in db.query(m.Disruption).filter(m.Disruption.shooting_day_id == r.shooting_day_id).all():
            disruption_type_counts[d.disruption_type] += 1
    most_common = disruption_type_counts.most_common(1)[0][0] if disruption_type_counts else "none"

    avg_response_ms = sum(r.execution_ms for r in runs) / len(runs) if runs else 0.0
    feasible_runs = len([r for r in runs if r.status != "infeasible"])
    success_rate = (feasible_runs / len(runs) * 100) if runs else 100.0

    hours_saved_series = [
        {"date": str(r.started_at.date()), "hours_saved": float(
            next((v.downtime_hours_avoided for v in db.query(m.ScheduleVersion)
                  .filter_by(agent_run_id=r.id, status="APPROVED").all()), 0)
        )}
        for r in sorted(completed, key=lambda x: x.started_at)
    ]

    return AnalyticsOut(
        rescue_events=len(runs),
        production_hours_saved=round(hours_saved, 1),
        estimated_cost_avoided=round(cost_avoided, 2),
        most_common_disruption=most_common,
        average_response_time_ms=round(avg_response_ms, 1),
        rescue_success_rate=round(success_rate, 1),
        disruptions_by_type=dict(disruption_type_counts),
        hours_saved_series=hours_saved_series,
    )
