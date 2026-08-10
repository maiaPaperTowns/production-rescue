from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProductionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    total_shooting_days: int
    current_day_number: int
    daily_budget: float


class ShootingDayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    production_id: int
    day_number: int
    shoot_date: date
    day_start: str
    day_end: str
    status: str


class ActorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    role: str
    day_rate: float


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    location_type: str
    address: str
    permit_required: bool


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category: str


class SceneOut(BaseModel):
    id: int
    scene_number: str
    title: str
    int_ext: str
    duration_min: int
    original_start: str
    original_end: str
    weather_requirement: Optional[str]
    daylight_required: bool
    priority: int
    location: LocationOut
    cast: list[ActorOut]
    equipment: list[EquipmentOut]
    depends_on: list[str]
