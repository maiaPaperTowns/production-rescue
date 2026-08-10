import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class DisruptionItem(BaseModel):
    type: Literal["weather", "actor_availability", "equipment_delay", "location_unavailable"]

    # weather
    condition: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    affects: List[str] = Field(default_factory=list)

    # actor_availability
    actor: Optional[str] = None
    available_until: Optional[str] = None
    available_from: Optional[str] = None

    # equipment_delay
    equipment: Optional[str] = None
    available_after: Optional[str] = None

    # location_unavailable
    location: Optional[str] = None
    unavailable_start: Optional[str] = None
    unavailable_end: Optional[str] = None

    @field_validator("start_time", "end_time", "available_until", "available_from", "available_after",
                      "unavailable_start", "unavailable_end")
    @classmethod
    def _validate_hm(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not TIME_RE.match(v):
            raise ValueError(f"time must be HH:MM (24h), got {v!r}")
        return v


class DisruptionExtractionResult(BaseModel):
    disruptions: List[DisruptionItem] = Field(default_factory=list)
    summary: str = ""
    source: Literal["gemini", "mock"] = "mock"


class DisruptionParseRequest(BaseModel):
    shooting_day_id: int
    raw_text: str
