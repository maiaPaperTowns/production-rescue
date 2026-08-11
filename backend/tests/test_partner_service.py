"""Tests for the Parallel partner integration. No PARALLEL_API_KEY is set in
the test environment, so these exercise the mock fallback path — the adapter
must degrade cleanly rather than fabricate a 'real' result."""
from app.agents.orchestrator import run_rescue_analysis
from app.services.partner_service import PartnerService, get_partner_service


def test_unconfigured_service_returns_clearly_labeled_mock():
    service = PartnerService()
    assert service.configured is False
    result = service.research_context("Riverside Park permit status")
    assert result.source == "mock"
    assert result.results
    assert "mock" in result.results[0].title.lower() or "unavailable" in result.results[0].title.lower()


def test_get_partner_service_is_a_singleton():
    assert get_partner_service() is get_partner_service()


def test_location_disruption_triggers_partner_research_in_orchestrator(seeded_day18):
    db = seeded_day18["db"]
    text = "Riverside Park lost its permit for today."
    run = run_rescue_analysis(db, seeded_day18["day"].id, text)

    partner_actions = [a for a in run.actions if a.tool_name == "research_external_context"]
    assert len(partner_actions) == 1
    assert "Riverside Park" in partner_actions[0].input_json["query"]
    assert partner_actions[0].output_json["source"] == "mock"
