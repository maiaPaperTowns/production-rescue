"""Unit tests for the deterministic constraint solver (app/services/scheduling_service.py
and impact_service.py). No LLM involved anywhere in this file — these are pure
constraint-logic and arithmetic tests.

NOTE: the "approval required before mutation" requirement is tested at the API
layer in tests/test_rescue_api.py (Phase 8), since there is no mutation to guard
at the solver level — the solver only ever produces proposals.
"""
from app.services.impact_service import calculate_impact
from app.services.scheduling_models import Assignment, ParsedDisruption
from app.services.scheduling_service import (
    build_day_context,
    detect_affected_scenes,
    evaluate_candidates,
    generate_candidate_schedules,
    scene_allowed_windows,
    validate_schedule,
)

DEMO_DISRUPTIONS = [
    ParsedDisruption(type="weather", condition="thunderstorm", start_time="11:00", end_time="17:00"),
    ParsedDisruption(type="actor_availability", actor_name="Maya", available_until="14:00"),
    ParsedDisruption(type="equipment_delay", equipment_name="Camera B", available_after="15:00"),
]


def _original_assignments(fixture):
    return [Assignment(a.scene_id, a.start_min, a.end_min, a.location_id) for a in fixture["version"].assignments]


# --------------------------------------------------------------------------
# 1. Actor conflict detection
# --------------------------------------------------------------------------

def test_actor_conflict_detection(seeded_day18):
    disruptions = [ParsedDisruption(type="actor_availability", actor_name="Maya", available_until="09:00")]
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, disruptions)
    original = _original_assignments(seeded_day18)

    affected = detect_affected_scenes(context, original)
    affected_ids = {a.scene_id for a in affected}
    assert seeded_day18["scenes"]["24"].id in affected_ids  # Maya's 2pm scene now unreachable
    assert any(code == "actor" for a in affected for code, _ in a.reasons if a.scene_id == seeded_day18["scenes"]["24"].id)

    valid, violations, _ = validate_schedule(original, context)
    assert not valid
    assert any(v.scene_id == seeded_day18["scenes"]["24"].id for v in violations)


# --------------------------------------------------------------------------
# 2. Location conflict detection
# --------------------------------------------------------------------------

def test_location_conflict_detection(seeded_day18):
    disruptions = [ParsedDisruption(type="location_unavailable", location_name="Stage B")]
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, disruptions)
    scene24 = seeded_day18["scenes"]["24"]

    windows = scene_allowed_windows(context.scene_by_id(scene24.id), context)
    assert windows == []  # Stage B fully blacked out -> no window can satisfy the scene

    original = _original_assignments(seeded_day18)
    valid, violations, _ = validate_schedule(original, context)
    assert not valid
    assert any(v.scene_id == scene24.id and v.code == "constraint" for v in violations)


# --------------------------------------------------------------------------
# 3. Equipment conflict detection
# --------------------------------------------------------------------------

def test_equipment_conflict_detection(seeded_day18):
    disruptions = [ParsedDisruption(type="equipment_delay", equipment_name="Camera B", available_after="15:00")]
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, disruptions)
    scene18 = seeded_day18["scenes"]["18"]  # 10:30-13:00, needs Camera B

    original = _original_assignments(seeded_day18)
    affected = detect_affected_scenes(context, original)
    scene18_affected = next(a for a in affected if a.scene_id == scene18.id)
    assert any(code == "equipment" for code, _ in scene18_affected.reasons)


# --------------------------------------------------------------------------
# 4. Weather conflict detection
# --------------------------------------------------------------------------

def test_weather_conflict_detection(seeded_day18):
    disruptions = [ParsedDisruption(type="weather", condition="thunderstorm", start_time="08:00", end_time="12:00")]
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, disruptions)
    scene12 = seeded_day18["scenes"]["12"]  # 8-10, exterior, requires dry

    original = _original_assignments(seeded_day18)
    affected = detect_affected_scenes(context, original)
    scene12_affected = next(a for a in affected if a.scene_id == scene12.id)
    assert any(code == "weather" for code, _ in scene12_affected.reasons)

    # Interior scenes must never be affected by weather.
    scene24 = seeded_day18["scenes"]["24"]
    assert not any(a.scene_id == scene24.id for a in affected)


# --------------------------------------------------------------------------
# 5. Dependency validation
# --------------------------------------------------------------------------

def test_dependency_violation_detected(seeded_day18):
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, [])
    scene24, scene25 = seeded_day18["scenes"]["24"], seeded_day18["scenes"]["25"]

    # Deliberately schedule scene 25 (depends on 24) to start before scene 24 ends.
    bad_assignments = [
        Assignment(scene24.id, 600, 720, scene24.location_id),
        Assignment(scene25.id, 650, 725, scene25.location_id),  # starts mid-scene-24
    ]
    valid, violations, _ = validate_schedule(bad_assignments, context)
    assert not valid
    assert any(v.code == "dependency" for v in violations)


# --------------------------------------------------------------------------
# 6. Valid schedule generation (the primary demo scenario)
# --------------------------------------------------------------------------

def test_generates_valid_rescue_schedule_for_demo_scenario(seeded_day18):
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, DEMO_DISRUPTIONS)
    candidates = evaluate_candidates(context, generate_candidate_schedules(context))

    valid_candidates = [c for c in candidates if c.valid]
    assert len(valid_candidates) > 0, "solver must find at least one feasible rescue schedule"

    best = valid_candidates[0]
    # Re-validate independently to make sure the generator's own output holds up.
    valid, violations, _ = validate_schedule(best.assignments, context, best.dropped_scene_ids)
    assert valid
    assert violations == []

    # Scene 18 (car chase) genuinely cannot fit: dry+daylight window after the
    # storm clears is 17:00-19:00 (2h) but the scene needs 2.5h.
    scene18 = seeded_day18["scenes"]["18"]
    assert scene18.id in best.dropped_scene_ids

    # Maya's two remaining scenes must both complete before her 14:00 departure.
    for scene_key in ["24", "25"]:
        scene = seeded_day18["scenes"][scene_key]
        assignment = best.assignment_for(scene.id)
        assert assignment is not None
        assert assignment.end_min <= 14 * 60


# --------------------------------------------------------------------------
# 7. Impossible schedule handling
# --------------------------------------------------------------------------

def test_impossible_schedule_reports_blocking_constraint(seeded_day18):
    # Maya becomes unavailable for the entire day -> every scene needing her is unsatisfiable.
    disruptions = [ParsedDisruption(type="actor_availability", actor_name="Maya", available_until="07:00")]
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, disruptions)

    scene12, scene24, scene25 = (seeded_day18["scenes"][k] for k in ["12", "24", "25"])
    for scene in (scene12, scene24, scene25):
        assert scene_allowed_windows(context.scene_by_id(scene.id), context) == []

    candidates = evaluate_candidates(context, generate_candidate_schedules(context))
    valid_candidates = [c for c in candidates if c.valid]
    assert len(valid_candidates) > 0  # a partial schedule (without Maya's scenes) is still feasible
    for c in valid_candidates:
        dropped = set(c.dropped_scene_ids)
        assert {scene12.id, scene24.id, scene25.id}.issubset(dropped)


# --------------------------------------------------------------------------
# 8. Scoring
# --------------------------------------------------------------------------

def test_scoring_prefers_more_complete_schedules(seeded_day18):
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, DEMO_DISRUPTIONS)
    candidates = evaluate_candidates(context, generate_candidate_schedules(context))
    valid_candidates = [c for c in candidates if c.valid]
    assert len(valid_candidates) >= 2

    scenes_included = [len(c.assignments) for c in valid_candidates]
    # Best-scored candidate (index 0, since evaluate_candidates sorts descending)
    # must include at least as many scenes as any lower-scored candidate that
    # dropped strictly more.
    best = valid_candidates[0]
    worst = min(valid_candidates, key=lambda c: len(c.assignments))
    if len(best.assignments) != len(worst.assignments):
        assert best.score > worst.score


def test_invalid_candidate_scores_zero(seeded_day18):
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, [])
    scene12, scene18 = seeded_day18["scenes"]["12"], seeded_day18["scenes"]["18"]
    overlapping = [
        Assignment(scene12.id, 480, 600, scene12.location_id),
        Assignment(scene18.id, 500, 650, scene18.location_id),  # overlaps scene12
    ]
    from app.services.scheduling_models import CandidateSchedule
    candidate = CandidateSchedule(assignments=overlapping)
    evaluate_candidates(context, [candidate])
    assert candidate.valid is False
    assert candidate.score == 0.0


# --------------------------------------------------------------------------
# 9. Impact calculations
# --------------------------------------------------------------------------

def test_impact_calculation_for_demo_scenario(seeded_day18):
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, DEMO_DISRUPTIONS)
    original = _original_assignments(seeded_day18)
    candidates = evaluate_candidates(context, generate_candidate_schedules(context))
    best = next(c for c in candidates if c.valid)

    impact = calculate_impact(context, original, best, float(seeded_day18["production"].daily_budget))

    assert impact.downtime_hours_avoided > 0
    assert impact.scenes_saved >= 1  # Maya's scenes recovered vs. the do-nothing baseline
    assert impact.scenes_preserved_of_total == (4, 5)
    assert impact.estimated_cost_avoided > 0


def test_impact_is_zero_when_proposed_equals_naive(seeded_day18):
    """Sanity check: if the 'rescue' plan is identical to doing nothing, it
    should claim no downtime avoided and no scenes saved."""
    context = build_day_context(seeded_day18["db"], seeded_day18["day"].id, [])
    original = _original_assignments(seeded_day18)
    from app.services.scheduling_models import CandidateSchedule
    identical = CandidateSchedule(assignments=list(original), dropped_scene_ids=[])
    impact = calculate_impact(context, original, identical, float(seeded_day18["production"].daily_budget))
    assert impact.downtime_hours_avoided == 0
    assert impact.scenes_saved == 0
