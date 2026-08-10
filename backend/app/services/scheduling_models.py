"""Pure dataclasses used by the constraint solver. Decoupled from the ORM so the
solver can be unit tested without a database."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.interval_utils import Interval

DAYLIGHT_START = 6 * 60   # 06:00
DAYLIGHT_END = 19 * 60    # 19:00
SAME_LOCATION_BUFFER = 15   # minutes between back-to-back scenes at the same location
LOCATION_MOVE_BUFFER = 30   # minutes needed for a company move to a new location


@dataclass
class SceneData:
    id: int
    scene_number: str
    title: str
    int_ext: str
    location_id: int
    duration_min: int
    original_start_min: int
    original_end_min: int
    weather_requirement: str | None
    daylight_required: bool
    priority: int
    actor_ids: list[int] = field(default_factory=list)
    equipment_ids: list[int] = field(default_factory=list)
    depends_on_scene_ids: list[int] = field(default_factory=list)


@dataclass
class ParsedDisruption:
    """Normalized disruption, independent of how it was produced (Gemini or a
    demo shortcut)."""
    type: str  # weather | actor_availability | equipment_delay | location_unavailable
    # weather
    condition: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    affects: list[str] = field(default_factory=list)
    # actor_availability
    actor_name: str | None = None
    available_until: str | None = None
    available_from: str | None = None
    # equipment_delay
    equipment_name: str | None = None
    available_after: str | None = None
    # location_unavailable
    location_name: str | None = None
    unavailable_start: str | None = None
    unavailable_end: str | None = None
    raw_text: str = ""


@dataclass
class DayContext:
    shooting_day_id: int
    day_start: int
    day_end: int
    scenes: list[SceneData]
    actor_windows: dict[int, list[Interval]]
    location_windows: dict[int, list[Interval]]
    equipment_windows: dict[int, list[Interval]]
    weather_blackouts: list[Interval]
    actor_names: dict[int, str] = field(default_factory=dict)
    location_names: dict[int, str] = field(default_factory=dict)
    equipment_names: dict[int, str] = field(default_factory=dict)
    disruptions: list[ParsedDisruption] = field(default_factory=list)

    def scene_by_id(self, scene_id: int) -> SceneData:
        return next(s for s in self.scenes if s.id == scene_id)


@dataclass
class Assignment:
    scene_id: int
    start_min: int
    end_min: int
    location_id: int


@dataclass
class ScheduleViolation:
    scene_id: int
    code: str
    message: str


@dataclass
class AffectedScene:
    scene_id: int
    scene_number: str
    title: str
    reasons: list[tuple[str, str]] = field(default_factory=list)  # (code, message)


@dataclass
class CandidateSchedule:
    assignments: list[Assignment]
    dropped_scene_ids: list[int] = field(default_factory=list)
    score: float = 0.0
    score_breakdown: dict[str, float] = field(default_factory=dict)
    valid: bool = False
    violations: list[ScheduleViolation] = field(default_factory=list)
    warnings: list[ScheduleViolation] = field(default_factory=list)
    label: str = ""

    def assignment_for(self, scene_id: int) -> Assignment | None:
        return next((a for a in self.assignments if a.scene_id == scene_id), None)
