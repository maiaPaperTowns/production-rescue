from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.schedule import AssignmentOut


class RescueAnalyzeRequest(BaseModel):
    shooting_day_id: int
    raw_text: str


class AgentActionOut(BaseModel):
    seq: int
    tool_name: str
    summary: str
    timestamp: datetime


class ImpactOut(BaseModel):
    downtime_hours_avoided: float
    scenes_saved: int
    scenes_preserved: int
    scenes_total: int
    scenes_delayed: int
    changed_call_times: int
    company_moves_change: int
    overtime_change_minutes: int
    estimated_cost_avoided: float


class PlanOut(BaseModel):
    schedule_version_id: int
    label: str
    score: float
    recommended: bool
    assignments: list[AssignmentOut]
    dropped_scenes: list[str]
    impact: Optional[ImpactOut] = None


class AgentRunOut(BaseModel):
    id: int
    shooting_day_id: int
    status: str
    disruption_summary: str
    candidates_generated: int
    candidates_valid: int
    explanation: str
    blocking_constraints: list[str]
    execution_ms: int
    started_at: datetime
    completed_at: Optional[datetime]
    recommended_schedule_version_id: Optional[int]
    plans: list[PlanOut]
    actions: list[AgentActionOut]


class ApprovalRequest(BaseModel):
    decided_by: str = "Assistant Director"
    notes: str = ""


class ApprovalResult(BaseModel):
    schedule_version_id: int
    new_version_number: int
    assignments_updated: int
    status: str
