"""Quantifies what a rescue plan is actually worth, by diffing it against a
naive "keep the original scene order, wait out every conflict" baseline. Pure
arithmetic — no LLM involved."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.interval_utils import earliest_fit
from app.services.scheduling_models import (
    LOCATION_MOVE_BUFFER,
    SAME_LOCATION_BUFFER,
    Assignment,
    CandidateSchedule,
    DayContext,
)
from app.services.scheduling_service import scene_allowed_windows

OVERTIME_MULTIPLIER = 1.5


@dataclass
class ImpactResult:
    downtime_hours_avoided: float
    scenes_saved: int
    scenes_preserved_of_total: tuple[int, int]
    scenes_delayed: int
    changed_call_times: int
    company_moves_change: int
    overtime_change_minutes: int
    estimated_cost_avoided: float
    naive_dropped_scene_ids: list[int] = field(default_factory=list)
    proposed_dropped_scene_ids: list[int] = field(default_factory=list)


def _idle_minutes(assignments: list[Assignment]) -> int:
    if not assignments:
        return 0
    sorted_a = sorted(assignments, key=lambda a: a.start_min)
    busy = sum(a.end_min - a.start_min for a in sorted_a)
    span = sorted_a[-1].end_min - sorted_a[0].start_min
    return max(span - busy, 0)


def _company_moves(assignments: list[Assignment]) -> int:
    sorted_a = sorted(assignments, key=lambda a: a.start_min)
    locs = [a.location_id for a in sorted_a]
    return sum(1 for prev, curr in zip(locs, locs[1:]) if prev != curr)


def build_naive_baseline(context: DayContext, original_assignments: list[Assignment]) -> CandidateSchedule:
    """What happens with no AI Assistant Director: the crew keeps the original
    scene order AND never starts a scene before its originally-planned call
    time (nobody thinks to pull a later scene earlier), so they simply idle
    until each scene's own constraints clear at or after its original slot."""
    order_ids = [a.scene_id for a in sorted(original_assignments, key=lambda a: a.start_min)]
    assignments: list[Assignment] = []
    dropped: list[int] = []
    cursor = context.day_start
    prev_location: int | None = None

    for scene_id in order_ids:
        scene = context.scene_by_id(scene_id)
        windows = scene_allowed_windows(scene, context)
        if prev_location is None:
            lower_bound = cursor
        else:
            buffer = SAME_LOCATION_BUFFER if scene.location_id == prev_location else LOCATION_MOVE_BUFFER
            lower_bound = cursor + buffer
        lower_bound = max(lower_bound, scene.original_start_min)

        start = earliest_fit(windows, lower_bound, scene.duration_min)
        if start is None or start + scene.duration_min > context.day_end:
            dropped.append(scene_id)
            continue

        end = start + scene.duration_min
        assignments.append(Assignment(scene.id, start, end, scene.location_id))
        cursor = end
        prev_location = scene.location_id

    return CandidateSchedule(assignments=assignments, dropped_scene_ids=dropped)


def calculate_impact(
    context: DayContext,
    original_assignments: list[Assignment],
    proposed: CandidateSchedule,
    daily_budget: float,
) -> ImpactResult:
    naive = build_naive_baseline(context, original_assignments)

    wasted_naive = _idle_minutes(naive.assignments) + sum(
        context.scene_by_id(sid).duration_min for sid in naive.dropped_scene_ids
    )
    wasted_proposed = _idle_minutes(proposed.assignments) + sum(
        context.scene_by_id(sid).duration_min for sid in proposed.dropped_scene_ids
    )
    downtime_avoided_minutes = max(wasted_naive - wasted_proposed, 0)

    scenes_saved = len([sid for sid in naive.dropped_scene_ids if sid not in proposed.dropped_scene_ids])

    original_by_scene = {a.scene_id: a for a in original_assignments}
    scenes_delayed = 0
    changed_call_times = 0
    for a in proposed.assignments:
        orig = original_by_scene.get(a.scene_id)
        if orig and a.start_min != orig.start_min:
            changed_call_times += 1
            if a.start_min > orig.start_min:
                scenes_delayed += 1

    company_moves_change = _company_moves(proposed.assignments) - _company_moves(original_assignments)

    original_last_end = max((a.end_min for a in original_assignments), default=context.day_start)
    naive_last_end = max((a.end_min for a in naive.assignments), default=context.day_start)
    proposed_last_end = max((a.end_min for a in proposed.assignments), default=context.day_start)
    naive_overtime = max(naive_last_end - original_last_end, 0)
    proposed_overtime = max(proposed_last_end - original_last_end, 0)
    overtime_change_minutes = proposed_overtime - naive_overtime  # negative = less overtime than doing nothing

    day_length_min = max(context.day_end - context.day_start, 1)
    burn_rate_per_min = float(daily_budget) / day_length_min
    overtime_savings = max(naive_overtime - proposed_overtime, 0)
    estimated_cost_avoided = (
        (downtime_avoided_minutes / 60.0) * (burn_rate_per_min * 60.0)
        + (overtime_savings / 60.0) * (burn_rate_per_min * 60.0) * OVERTIME_MULTIPLIER
    )

    return ImpactResult(
        downtime_hours_avoided=round(downtime_avoided_minutes / 60.0, 1),
        scenes_saved=scenes_saved,
        scenes_preserved_of_total=(len(proposed.assignments), len(context.scenes)),
        scenes_delayed=scenes_delayed,
        changed_call_times=changed_call_times,
        company_moves_change=company_moves_change,
        overtime_change_minutes=overtime_change_minutes,
        estimated_cost_avoided=round(estimated_cost_avoided, -2),
        naive_dropped_scene_ids=naive.dropped_scene_ids,
        proposed_dropped_scene_ids=proposed.dropped_scene_ids,
    )
