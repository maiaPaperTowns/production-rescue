"""Integration tests for the agent orchestrator. No GOOGLE_API_KEY is set in
the test environment, so these always exercise the deterministic tool
pipeline — the same code path used for NEXT_PUBLIC_DEMO_MODE. This is also
where the "approval required before mutation" requirement lives: the
orchestrator must never set a schedule version's status to ACTIVE, and must
never touch the shooting day's currently-active schedule on its own.
"""
from app.agents.orchestrator import run_rescue_analysis
import app.models as m


DEMO_TEXT = "Thunderstorms are expected 11am-5pm and Maya must leave by 2pm. Camera B delivery is delayed until 3pm."


def test_full_rescue_run_produces_proposed_plans(seeded_day18):
    db = seeded_day18["db"]
    run = run_rescue_analysis(db, seeded_day18["day"].id, DEMO_TEXT)

    assert run.status == "proposed"
    assert run.candidates_generated > 0
    assert run.candidates_valid > 0
    assert run.recommended_schedule_version_id is not None
    assert len(run.actions) > 0
    assert run.actions[-1].tool_name == "propose_schedule_change"
    assert run.explanation  # Gemini (or the mock fallback) must produce something


def test_recommended_plan_matches_solver_output(seeded_day18):
    db = seeded_day18["db"]
    run = run_rescue_analysis(db, seeded_day18["day"].id, DEMO_TEXT)

    versions = db.query(m.ScheduleVersion).filter_by(agent_run_id=run.id).all()
    assert 1 <= len(versions) <= 3
    for v in versions:
        assert v.status == "PROPOSED"
        assert v.label.startswith("Plan ")

    best = next(v for v in versions if v.id == run.recommended_schedule_version_id)
    scene18 = seeded_day18["scenes"]["18"]
    dropped = [a for a in best.assignments if a.scene_id == scene18.id]
    assert dropped and dropped[0].status == "dropped"


def test_agent_never_mutates_the_active_schedule(seeded_day18):
    """The core safety guarantee: proposing a rescue plan must never change
    what the shooting day is currently running, regardless of how confident
    the recommendation is. Only a separate, explicit approval step may do that."""
    db = seeded_day18["db"]
    original_version = seeded_day18["version"]
    assert original_version.status == "ACTIVE"
    assert original_version.is_current is True

    run_rescue_analysis(db, seeded_day18["day"].id, DEMO_TEXT)

    db.refresh(original_version)
    assert original_version.status == "ACTIVE"
    assert original_version.is_current is True
    # No agent-created version may ever mark itself current.
    proposed = db.query(m.ScheduleVersion).filter(m.ScheduleVersion.created_by == "agent").all()
    assert all(v.is_current is False for v in proposed)
    assert all(v.status == "PROPOSED" for v in proposed)


def test_infeasible_scenario_reports_blocking_constraints_without_hallucinating(seeded_day18):
    """When no valid plan exists, the agent must say so and explain why —
    never invent a schedule that doesn't actually satisfy constraints."""
    db = seeded_day18["db"]
    # Maya is needed for 3 of the 5 scenes; making her unavailable all day,
    # plus removing Stage B entirely, leaves nothing schedulable for her arc,
    # and Stage C only scene (31) still needs equipment not in play here —
    # but scene 18 alone can still work, so this remains a *partial* feasibility
    # case at the solver level. For a true no-plan-possible case we also block
    # every location.
    text = "Maya is unavailable all day. Riverside Park, Downtown Street, Stage B, and Stage C are all closed today."
    run = run_rescue_analysis(db, seeded_day18["day"].id, text)

    assert run.status == "infeasible"
    assert run.recommended_schedule_version_id is None
    assert run.blocking_constraints
    assert "No conflict-free rescue plan" in run.explanation
    # No schedule versions should be created for an infeasible run.
    versions = db.query(m.ScheduleVersion).filter_by(agent_run_id=run.id).all()
    assert versions == []
