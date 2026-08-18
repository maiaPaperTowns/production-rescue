"""Request schemas for building up a production from scratch: creating the
production itself, shooting days, cast/location/equipment resources, and
scenes. Deliberately minimal (create + delete, no partial-update PATCH
semantics) — enough for a real cold-start user to populate their own
production, not a full production-management suite."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class ProductionCreate(BaseModel):
    name: str
    total_shooting_days: int = Field(gt=0, default=1)
    daily_budget: float = Field(ge=0, default=0)


class ShootingDayCreate(BaseModel):
    day_number: int = Field(gt=0)
    shoot_date: date
    day_start: str = "07:00"
    day_end: str = "21:00"


class ActorCreate(BaseModel):
    name: str
    role: str = ""
    day_rate: float = Field(ge=0, default=0)


class LocationCreate(BaseModel):
    name: str
    location_type: str = "exterior"
    address: str = ""
    permit_required: bool = False


class EquipmentCreate(BaseModel):
    name: str
    category: str = ""


class SceneCreate(BaseModel):
    scene_number: str
    title: str
    int_ext: str = "INT"
    location_id: int
    start: str  # "HH:MM"
    end: str  # "HH:MM"
    weather_requirement: Optional[str] = None
    daylight_required: bool = False
    priority: int = Field(ge=1, le=5, default=3)
    actor_ids: List[int] = Field(default_factory=list)
    equipment_ids: List[int] = Field(default_factory=list)
    depends_on_scene_ids: List[int] = Field(default_factory=list)
