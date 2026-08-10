"""Deterministic constraint solver: the actual scheduling intelligence.

Nothing in this file calls an LLM. Gemini (in app/agents) decides *when* to call
these functions and turns their structured output into English; every number
here is produced by plain arithmetic so it is reproducible, testable, and
explainable.
"""
from __future__ import annotations

from itertools import permutations

from sqlalchemy.orm import Session

import app.models as m
from app.services.interval_utils import (
    Interval,
    earliest_fit,
    fmt_hm,
    intersect_two,
    normalize,
    overlaps,
    parse_hm,
    subtract,
    total_minutes,
)
from app.services.scheduling_models import (
    DAYLIGHT_END,
    DAYLIGHT_START,
    LOCATION_MOVE_BUFFER,
    SAME_LOCATION_BUFFER,
    AffectedScene,
    Assignment,
    CandidateSchedule,
    DayContext,
    ParsedDisruption,
    SceneData,
    ScheduleViolation,
)

MAX_PERMUTATIONS = 5000


# ---------------------------------------------------------------------------
# Context construction: load ORM data into plain, DB-independent dataclasses
# ---------------------------------------------------------------------------

def build_day_context(db: Session, shooting_day_id: int, disruptions: list[ParsedDisruption] | None = None) -> DayContext:
    day = db.get(m.ShootingDay, shooting_day_id)
    if day is None:
        raise ValueError(f"shooting day {shooting_day_id} not found")

    scene_rows = db.query(m.Scene).filter(m.Scene.shooting_day_id == shooting_day_id).all()
    scenes: list[SceneData] = []
    for row in scene_rows:
        actor_ids = [link.actor_id for link in row.cast_links]
        equipment_ids = [link.equipment_id for link in row.equipment_links]
        dep_ids = [d.depends_on_scene_id for d in row.dependencies]
        scenes.append(SceneData(
            id=row.id, scene_number=row.scene_number, title=row.title, int_ext=row.int_ext,
            location_id=row.location_id, duration_min=row.duration_min,
            original_start_min=row.original_start_min, original_end_min=row.original_end_min,
            weather_requirement=row.weather_requirement, daylight_required=row.daylight_required,
            priority=row.priority, actor_ids=actor_ids, equipment_ids=equipment_ids,
            depends_on_scene_ids=dep_ids,
        ))

    scene_ids = [s.id for s in scenes]
    day_start = parse_hm(day.day_start)
    day_end = parse_hm(day.day_end)

    actor_windows: dict[int, list[Interval]] = {}
    for row in db.query(m.ActorAvailability).filter(m.ActorAvailability.shooting_day_id == shooting_day_id):
        actor_windows.setdefault(row.actor_id, []).append((row.available_start_min, row.available_end_min))

    location_windows: dict[int, list[Interval]] = {}
    for row in db.query(m.LocationAvailability).filter(m.LocationAvailability.shooting_day_id == shooting_day_id):
        location_windows.setdefault(row.location_id, []).append((row.available_start_min, row.available_end_min))

    equipment_windows: dict[int, list[Interval]] = {}
    for row in db.query(m.EquipmentAvailability).filter(m.EquipmentAvailability.shooting_day_id == shooting_day_id):
        equipment_windows.setdefault(row.equipment_id, []).append((row.available_start_min, row.available_end_min))

    actor_names = {a.id: a.name for a in db.query(m.Actor).all()}
    location_names = {l.id: l.name for l in db.query(m.Location).all()}
    equipment_names = {e.id: e.name for e in db.query(m.Equipment).all()}

    context = DayContext(
        shooting_day_id=shooting_day_id, day_start=day_start, day_end=day_end, scenes=scenes,
        actor_windows=actor_windows, location_windows=location_windows, equipment_windows=equipment_windows,
        weather_blackouts=[], actor_names=actor_names, location_names=location_names,
        equipment_names=equipment_names, disruptions=disruptions or [],
    )
    if disruptions:
        apply_disruptions(context, disruptions)
    return context


def _find_id_by_name(name: str | None, names: dict[int, str]) -> int | None:
    if not name:
        return None
    needle = name.strip().lower()
    for entity_id, full_name in names.items():
        if needle == full_name.lower() or needle in full_name.lower():
            return entity_id
    return None


def apply_disruptions(context: DayContext, disruptions: list[ParsedDisruption]) -> None:
    """Mutates context in place: clips actor/location/equipment windows and adds
    weather blackout intervals based on the parsed disruptions."""
    for d in disruptions:
        if d.type == "weather":
            if d.start_time and d.end_time:
                context.weather_blackouts.append((parse_hm(d.start_time), parse_hm(d.end_time)))
        elif d.type == "actor_availability":
            actor_id = _find_id_by_name(d.actor_name, context.actor_names)
            if actor_id is None:
                continue
            base = context.actor_windows.get(actor_id, [(context.day_start, context.day_end)])
            if d.available_until:
                base = intersect_two(base, [(context.day_start, parse_hm(d.available_until))])
            if d.available_from:
                base = intersect_two(base, [(parse_hm(d.available_from), context.day_end)])
            context.actor_windows[actor_id] = base
        elif d.type == "equipment_delay":
            eq_id = _find_id_by_name(d.equipment_name, context.equipment_names)
            if eq_id is None or not d.available_after:
                continue
            base = context.equipment_windows.get(eq_id, [(context.day_start, context.day_end)])
            context.equipment_windows[eq_id] = intersect_two(base, [(parse_hm(d.available_after), context.day_end)])
        elif d.type == "location_unavailable":
            loc_id = _find_id_by_name(d.location_name, context.location_names)
            if loc_id is None:
                continue
            base = context.location_windows.get(loc_id, [(context.day_start, context.day_end)])
            if d.unavailable_start and d.unavailable_end:
                context.location_windows[loc_id] = subtract(base, [(parse_hm(d.unavailable_start), parse_hm(d.unavailable_end))])
            else:
                context.location_windows[loc_id] = []


# ---------------------------------------------------------------------------
# Constraint evaluation
# ---------------------------------------------------------------------------

def scene_allowed_windows(scene: SceneData, context: DayContext) -> list[Interval]:
    windows: list[Interval] = [(context.day_start, context.day_end)]
    for actor_id in scene.actor_ids:
        windows = intersect_two(windows, context.actor_windows.get(actor_id, [(context.day_start, context.day_end)]))
    windows = intersect_two(windows, context.location_windows.get(scene.location_id, [(context.day_start, context.day_end)]))
    for eq_id in scene.equipment_ids:
        windows = intersect_two(windows, context.equipment_windows.get(eq_id, [(context.day_start, context.day_end)]))
    if scene.weather_requirement == "dry" and context.weather_blackouts:
        windows = subtract(windows, context.weather_blackouts)
    if scene.daylight_required:
        windows = intersect_two(windows, [(max(context.day_start, DAYLIGHT_START), min(context.day_end, DAYLIGHT_END))])
    return windows


def detect_affected_scenes(context: DayContext, original_assignments: list[Assignment]) -> list[AffectedScene]:
    """Compare the ORIGINAL time slot for each scene against current (post-disruption)
    constraints and explain exactly why it no longer fits, if it doesn't."""
    affected: list[AffectedScene] = []
    for a in original_assignments:
        scene = context.scene_by_id(a.scene_id)
        reasons: list[tuple[str, str]] = []
        interval = (a.start_min, a.end_min)

        for actor_id in scene.actor_ids:
            win = context.actor_windows.get(actor_id, [(context.day_start, context.day_end)])
            if not any(w[0] <= interval[0] and interval[1] <= w[1] for w in win):
                name = context.actor_names.get(actor_id, f"actor {actor_id}")
                reasons.append(("actor", f"{name} is unavailable for the original {fmt_hm(a.start_min)}–{fmt_hm(a.end_min)} slot"))

        loc_win = context.location_windows.get(scene.location_id, [(context.day_start, context.day_end)])
        if not any(w[0] <= interval[0] and interval[1] <= w[1] for w in loc_win):
            loc_name = context.location_names.get(scene.location_id, "location")
            reasons.append(("location", f"{loc_name} is unavailable for the original {fmt_hm(a.start_min)}–{fmt_hm(a.end_min)} slot"))

        for eq_id in scene.equipment_ids:
            win = context.equipment_windows.get(eq_id, [(context.day_start, context.day_end)])
            if not any(w[0] <= interval[0] and interval[1] <= w[1] for w in win):
                eq_name = context.equipment_names.get(eq_id, f"equipment {eq_id}")
                reasons.append(("equipment", f"{eq_name} is not available until later in the day"))

        if scene.weather_requirement == "dry" and any(overlaps(interval, b) for b in context.weather_blackouts):
            reasons.append(("weather", "Exterior scene requires dry conditions; forecast conflicts with this slot"))

        for dep_id in scene.depends_on_scene_ids:
            dep_original = next((x for x in original_assignments if x.scene_id == dep_id), None)
            if dep_original and dep_original.end_min > a.start_min:
                dep_scene = context.scene_by_id(dep_id)
                reasons.append(("dependency", f"Must follow Scene {dep_scene.scene_number} ({dep_scene.title})"))

        if reasons:
            affected.append(AffectedScene(scene_id=scene.id, scene_number=scene.scene_number, title=scene.title, reasons=reasons))
    return affected


def validate_schedule(
    assignments: list[Assignment], context: DayContext, dropped_scene_ids: list[int] | None = None
) -> tuple[bool, list[ScheduleViolation], list[ScheduleViolation]]:
    dropped = set(dropped_scene_ids or [])
    violations: list[ScheduleViolation] = []
    warnings: list[ScheduleViolation] = []
    sorted_a = sorted(assignments, key=lambda a: a.start_min)

    for a in sorted_a:
        scene = context.scene_by_id(a.scene_id)
        windows = scene_allowed_windows(scene, context)
        if not any(w[0] <= a.start_min and a.end_min <= w[1] for w in windows):
            violations.append(ScheduleViolation(
                scene.id, "constraint",
                f"Scene {scene.scene_number} ({scene.title}) cannot run {fmt_hm(a.start_min)}–{fmt_hm(a.end_min)}: "
                f"violates actor, location, equipment, or weather availability",
            ))
        if a.start_min < context.day_start or a.end_min > context.day_end:
            violations.append(ScheduleViolation(
                scene.id, "day_bounds",
                f"Scene {scene.scene_number} falls outside the shooting day ({fmt_hm(context.day_start)}–{fmt_hm(context.day_end)})",
            ))

    for prev, curr in zip(sorted_a, sorted_a[1:]):
        if curr.start_min < prev.end_min:
            prev_scene = context.scene_by_id(prev.scene_id)
            curr_scene = context.scene_by_id(curr.scene_id)
            violations.append(ScheduleViolation(
                curr.scene_id, "overlap",
                f"Scene {curr_scene.scene_number} overlaps Scene {prev_scene.scene_number} in time",
            ))
        else:
            required = SAME_LOCATION_BUFFER if curr.location_id == prev.location_id else LOCATION_MOVE_BUFFER
            gap = curr.start_min - prev.end_min
            if gap < required:
                curr_scene = context.scene_by_id(curr.scene_id)
                prev_scene = context.scene_by_id(prev.scene_id)
                warnings.append(ScheduleViolation(
                    curr.scene_id, "tight_buffer",
                    f"Only {gap} min between Scene {prev_scene.scene_number} and Scene {curr_scene.scene_number}; recommend {required} min",
                ))

    for a in sorted_a:
        scene = context.scene_by_id(a.scene_id)
        for dep_id in scene.depends_on_scene_ids:
            if dep_id in dropped:
                continue
            dep_a = next((x for x in assignments if x.scene_id == dep_id), None)
            dep_scene = context.scene_by_id(dep_id)
            if dep_a is None:
                violations.append(ScheduleViolation(
                    scene.id, "dependency",
                    f"Scene {scene.scene_number} depends on Scene {dep_scene.scene_number}, which is not scheduled",
                ))
            elif dep_a.end_min > a.start_min:
                violations.append(ScheduleViolation(
                    scene.id, "dependency",
                    f"Scene {scene.scene_number} must be scheduled after Scene {dep_scene.scene_number} completes",
                ))

    for scene_id in dropped:
        scene = context.scene_by_id(scene_id)
        warnings.append(ScheduleViolation(
            scene_id, "dropped",
            f"Scene {scene.scene_number} ({scene.title}) could not be fit into today — recommend moving it to another shooting day",
        ))

    return len(violations) == 0, violations, warnings


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------

def _build_candidate_for_order(order: list[SceneData], context: DayContext) -> CandidateSchedule | None:
    assignments: list[Assignment] = []
    dropped: list[int] = []
    cursor = context.day_start
    prev_location: int | None = None

    for scene in order:
        windows = scene_allowed_windows(scene, context)
        if prev_location is None:
            lower_bound = cursor
        else:
            buffer = SAME_LOCATION_BUFFER if scene.location_id == prev_location else LOCATION_MOVE_BUFFER
            lower_bound = cursor + buffer
        for dep_id in scene.depends_on_scene_ids:
            dep_a = next((a for a in assignments if a.scene_id == dep_id), None)
            if dep_a:
                lower_bound = max(lower_bound, dep_a.end_min + SAME_LOCATION_BUFFER)

        start = earliest_fit(windows, lower_bound, scene.duration_min)
        if start is None or start + scene.duration_min > context.day_end:
            dropped.append(scene.id)
            continue

        end = start + scene.duration_min
        assignments.append(Assignment(scene.id, start, end, scene.location_id))
        cursor = end
        prev_location = scene.location_id

    if not assignments:
        return None
    return CandidateSchedule(assignments=assignments, dropped_scene_ids=dropped)


def generate_candidate_schedules(context: DayContext, max_permutations: int = MAX_PERMUTATIONS) -> list[CandidateSchedule]:
    """Exhaustive-with-pruning search: try scene orderings, greedily assign the
    earliest feasible start time to each scene in that order, and keep the
    distinct resulting schedules. Appropriate for small single-day schedules
    (documented MVP scope); would need a proper solver (e.g. OR-Tools) at
    much larger scene counts."""
    scenes = context.scenes
    dep_map = {s.id: set(s.depends_on_scene_ids) for s in scenes}
    seen_signatures: set[tuple] = set()
    candidates: list[CandidateSchedule] = []

    for count, order in enumerate(permutations(scenes)):
        if count >= max_permutations:
            break
        order_index = {s.id: i for i, s in enumerate(order)}
        if any(dep in order_index and order_index[dep] > order_index[s.id] for s in order for dep in dep_map[s.id]):
            continue  # dependency scheduled after its prerequisite in this ordering; skip without building it

        candidate = _build_candidate_for_order(list(order), context)
        if candidate is None:
            continue
        signature = tuple(sorted((a.scene_id, a.start_min) for a in candidate.assignments)) + tuple(sorted(candidate.dropped_scene_ids))
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)
        candidates.append(candidate)

    return candidates


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

SCORE_WEIGHTS = {
    "feasibility": 0.30,
    "downtime": 0.20,
    "cast": 0.15,
    "location": 0.15,
    "equipment": 0.10,
    "priority": 0.10,
}


def calculate_schedule_score(candidate: CandidateSchedule, context: DayContext) -> tuple[float, dict[str, float]]:
    total_scenes = len(context.scenes)
    scenes_included = len(candidate.assignments)
    day_span = max(context.day_end - context.day_start, 1)
    sorted_a = sorted(candidate.assignments, key=lambda a: a.start_min)

    # Feasibility: share of the day's scenes this candidate actually accommodates.
    feasibility = 100.0 * scenes_included / total_scenes if total_scenes else 100.0

    # Minimized downtime: idle gaps between scenes vs. the day's total slack.
    busy = sum(a.end_min - a.start_min for a in sorted_a)
    span = (sorted_a[-1].end_min - sorted_a[0].start_min) if sorted_a else 0
    idle = max(span - busy, 0)
    max_possible_idle = max(day_span - busy, 1)
    downtime = 100.0 * (1 - idle / max_possible_idle)

    # Cast compatibility: minimize idle gaps for each actor across their own scenes.
    actor_scene_times: dict[int, list[Interval]] = {}
    for a in sorted_a:
        scene = context.scene_by_id(a.scene_id)
        for actor_id in scene.actor_ids:
            actor_scene_times.setdefault(actor_id, []).append((a.start_min, a.end_min))
    total_actor_gap = 0
    for intervals in actor_scene_times.values():
        intervals.sort()
        busy_actor = sum(e - s for s, e in intervals)
        span_actor = intervals[-1][1] - intervals[0][0] if intervals else 0
        total_actor_gap += max(span_actor - busy_actor, 0)
    num_actors = max(len(actor_scene_times), 1)
    cast = 100.0 * (1 - total_actor_gap / max(day_span * num_actors, 1))

    # Location compatibility: penalize company moves beyond the minimum required
    # to visit every distinct location used by this candidate once.
    locations_in_order = [a.location_id for a in sorted_a]
    moves = sum(1 for prev, curr in zip(locations_in_order, locations_in_order[1:]) if prev != curr)
    distinct_locations = len(set(locations_in_order))
    minimal_moves = max(distinct_locations - 1, 0)
    extra_moves = max(moves - minimal_moves, 0)
    location = 100.0 * (1 - extra_moves / max(scenes_included - 1, 1))

    # Equipment compatibility: penalize idle time for equipment used across multiple scenes.
    equipment_scene_times: dict[int, list[Interval]] = {}
    for a in sorted_a:
        scene = context.scene_by_id(a.scene_id)
        for eq_id in scene.equipment_ids:
            equipment_scene_times.setdefault(eq_id, []).append((a.start_min, a.end_min))
    multi_use = {eq: ivals for eq, ivals in equipment_scene_times.items() if len(ivals) > 1}
    total_equipment_idle = 0
    for intervals in multi_use.values():
        intervals.sort()
        busy_eq = sum(e - s for s, e in intervals)
        span_eq = intervals[-1][1] - intervals[0][0]
        total_equipment_idle += max(span_eq - busy_eq, 0)
    equipment = 100.0 * (1 - total_equipment_idle / max(day_span * max(len(multi_use), 1), 1))

    # Production priority: share of total priority-weighted value this candidate
    # preserves. Weighted by total (not average of included scenes) so dropping
    # several scenes to make a handful trivially easy to schedule is penalized,
    # not rewarded.
    included_scenes = [context.scene_by_id(a.scene_id) for a in sorted_a]
    total_priority = sum(s.priority for s in context.scenes) or 1
    included_priority = sum(s.priority for s in included_scenes)
    priority = 100.0 * (included_priority / total_priority)

    breakdown = {
        "feasibility": round(feasibility, 1),
        "downtime": round(max(min(downtime, 100.0), 0.0), 1),
        "cast": round(max(min(cast, 100.0), 0.0), 1),
        "location": round(max(min(location, 100.0), 0.0), 1),
        "equipment": round(max(min(equipment, 100.0), 0.0), 1),
        "priority": round(max(min(priority, 100.0), 0.0), 1),
    }
    score = sum(breakdown[k] * SCORE_WEIGHTS[k] for k in SCORE_WEIGHTS)
    return round(max(min(score, 100.0), 0.0), 1), breakdown


def evaluate_candidates(context: DayContext, candidates: list[CandidateSchedule]) -> list[CandidateSchedule]:
    """Validate + score every candidate in place and return them sorted best-first."""
    for c in candidates:
        valid, violations, warnings = validate_schedule(c.assignments, context, c.dropped_scene_ids)
        c.valid = valid
        c.violations = violations
        c.warnings = warnings
        if valid:
            c.score, c.score_breakdown = calculate_schedule_score(c, context)
        else:
            c.score, c.score_breakdown = 0.0, {}
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates
