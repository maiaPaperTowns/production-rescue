"""API-level tests for the rescue workflow, run against a real FastAPI TestClient
with the DB dependency overridden to the isolated seeded_day18 fixture. This is
where "approval required before schedule mutation" (spec section 28, #10) is
verified end-to-end: through HTTP, not just at the solver layer."""
import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app

DEMO_TEXT = "Thunderstorms are expected 11am-5pm and Maya must leave by 2pm. Camera B delivery is delayed until 3pm."


@pytest.fixture()
def client(seeded_day18):
    def _override_get_db():
        yield seeded_day18["db"]

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_read_endpoints(client, seeded_day18):
    day_id = seeded_day18["day"].id
    assert client.get(f"/api/shooting-days/{day_id}/schedule").status_code == 200
    assert client.get("/api/actors").status_code == 200
    assert client.get("/api/locations").status_code == 200
    assert client.get("/api/equipment").status_code == 200
    scene_id = seeded_day18["scenes"]["12"].id
    assert client.get(f"/api/scenes/{scene_id}").status_code == 200


def test_analyze_endpoint_returns_proposed_plans(client, seeded_day18):
    r = client.post("/api/rescue/analyze", json={"shooting_day_id": seeded_day18["day"].id, "raw_text": DEMO_TEXT})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "proposed"
    assert len(body["plans"]) >= 1
    assert any(p["recommended"] for p in body["plans"])


def test_schedule_is_unchanged_until_approved(client, seeded_day18):
    """The core requirement: analyzing (even generating a highly-scored plan)
    must never touch what the shooting day is actively running."""
    day_id = seeded_day18["day"].id
    before = client.get(f"/api/shooting-days/{day_id}/schedule").json()

    r = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": DEMO_TEXT})
    assert r.status_code == 200

    after = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    assert after["current_version"]["id"] == before["current_version"]["id"]
    assert after["current_version"]["status"] == "ACTIVE"
    assert [a["start"] for a in after["current_version"]["assignments"]] == [a["start"] for a in before["current_version"]["assignments"]]


def test_approval_applies_the_schedule_change(client, seeded_day18):
    day_id = seeded_day18["day"].id
    run = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": DEMO_TEXT}).json()
    run_id = run["id"]

    approval = client.post(f"/api/rescue/{run_id}/approve", json={"decided_by": "Test AD"})
    assert approval.status_code == 200
    assert approval.json()["status"] == "APPROVED"

    after = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    assert after["current_version"]["label"] == "Plan A"
    assert after["current_version"]["status"] == "APPROVED"
    assert after["current_version"]["is_current"] is True


def test_cannot_approve_twice(client, seeded_day18):
    day_id = seeded_day18["day"].id
    run = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": DEMO_TEXT}).json()
    run_id = run["id"]

    first = client.post(f"/api/rescue/{run_id}/approve", json={"decided_by": "A"})
    assert first.status_code == 200
    second = client.post(f"/api/rescue/{run_id}/approve", json={"decided_by": "B"})
    assert second.status_code == 409


def test_reject_leaves_active_schedule_untouched(client, seeded_day18):
    day_id = seeded_day18["day"].id
    before = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    run = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": DEMO_TEXT}).json()

    rejection = client.post(f"/api/rescue/{run['id']}/reject", json={"decided_by": "Test AD", "notes": "not now"})
    assert rejection.status_code == 200
    assert rejection.json()["status"] == "REJECTED"

    after = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    assert after["current_version"]["id"] == before["current_version"]["id"]
    assert after["current_version"]["status"] == "ACTIVE"


def test_infeasible_run_has_nothing_to_approve(client, seeded_day18):
    day_id = seeded_day18["day"].id
    text = "Maya is unavailable all day. Riverside Park, Downtown Street, Stage B, and Stage C are all closed today."
    run = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": text}).json()
    assert run["status"] == "infeasible"
    assert run["recommended_schedule_version_id"] is None

    approval = client.post(f"/api/rescue/{run['id']}/approve", json={"decided_by": "A"})
    assert approval.status_code == 409


def test_alternatives_endpoint_returns_the_same_plans(client, seeded_day18):
    day_id = seeded_day18["day"].id
    run = client.post("/api/rescue/analyze", json={"shooting_day_id": day_id, "raw_text": DEMO_TEXT}).json()
    alternatives = client.get(f"/api/rescue/{run['id']}/alternatives").json()
    assert [a["label"] for a in alternatives] == [p["label"] for p in run["plans"]]


def test_disruption_parse_endpoint(client, seeded_day18):
    r = client.post("/api/disruptions/parse", json={"shooting_day_id": seeded_day18["day"].id, "raw_text": DEMO_TEXT})
    assert r.status_code == 200
    body = r.json()
    assert len(body["disruptions"]) == 3
