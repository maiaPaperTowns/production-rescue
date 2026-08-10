from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AssignmentOut(BaseModel):
    scene_id: int
    scene_number: str
    title: str
    start: str
    end: str
    location_id: int
    location_name: str
    status: str
    change_reason: str = ""


class ScheduleVersionOut(BaseModel):
    id: int
    version_number: int
    status: str
    label: str
    score: float
    is_current: bool
    created_by: str
    created_at: datetime
    assignments: list[AssignmentOut]


class ScheduleOut(BaseModel):
    shooting_day_id: int
    day_number: int
    shoot_date: str
    status: str
    current_version: Optional[ScheduleVersionOut]
