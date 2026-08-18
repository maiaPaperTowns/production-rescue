"""Tests for the minimal production-setup CRUD: creating a production from
scratch, adding shooting days, cast/location/equipment resources, and scenes
(which must materialize into the day's current schedule so they actually show
up), plus guardrails against deleting resources still in use."""
import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app


@pytest.fixture()
def client(seeded_day18):
    def _override_get_db():
        yield seeded_day18["db"]

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_create_production_from_scratch(client):
    r = client.post("/api/productions", json={"name": "New Show", "total_shooting_days": 10, "daily_budget": 50000})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "New Show"
    assert body["current_day_number"] == 1


def test_create_shooting_day_seeds_empty_active_version(client):
    r = client.post("/api/productions", json={"name": "New Show", "total_shooting_days": 10, "daily_budget": 50000})
    production_id = r.json()["id"]

    r = client.post(f"/api/productions/{production_id}/shooting-days",
                     json={"day_number": 1, "shoot_date": "2026-09-01"})
    assert r.status_code == 201
    day_id = r.json()["id"]

    r = client.get(f"/api/shooting-days/{day_id}/schedule")
    assert r.status_code == 200
    assert r.json()["current_version"]["status"] == "ACTIVE"
    assert r.json()["current_version"]["assignments"] == []


def test_create_actor_location_equipment(client):
    r = client.post("/api/actors", json={"name": "New Actor", "role": "Lead", "day_rate": 9000})
    assert r.status_code == 201
    assert r.json()["name"] == "New Actor"

    r = client.post("/api/locations", json={"name": "New Location", "location_type": "interior"})
    assert r.status_code == 201

    r = client.post("/api/equipment", json={"name": "New Camera", "category": "camera"})
    assert r.status_code == 201


def test_create_scene_materializes_into_current_schedule(client, seeded_day18):
    day_id = seeded_day18["day"].id
    location_id = seeded_day18["locations"]["stage_b"].id
    actor_id = seeded_day18["actors"]["maya"].id

    before = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    before_count = len(before["current_version"]["assignments"])

    r = client.post(f"/api/shooting-days/{day_id}/scenes", json={
        "scene_number": "50", "title": "New Scene", "int_ext": "INT", "location_id": location_id,
        "start": "12:00", "end": "13:00", "priority": 3, "actor_ids": [actor_id], "equipment_ids": [],
    })
    assert r.status_code == 201
    scene_id = r.json()["id"]
    assert r.json()["cast"][0]["name"] == "Maya Chen"

    after = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    assert len(after["current_version"]["assignments"]) == before_count + 1
    assert any(a["scene_number"] == "50" for a in after["current_version"]["assignments"])

    # Clean up: deleting it should remove the assignment too.
    assert client.delete(f"/api/scenes/{scene_id}").status_code == 204
    final = client.get(f"/api/shooting-days/{day_id}/schedule").json()
    assert len(final["current_version"]["assignments"]) == before_count


def test_create_scene_rejects_unknown_location(client, seeded_day18):
    day_id = seeded_day18["day"].id
    r = client.post(f"/api/shooting-days/{day_id}/scenes", json={
        "scene_number": "51", "title": "Bad Scene", "int_ext": "INT", "location_id": 999999,
        "start": "12:00", "end": "13:00",
    })
    assert r.status_code == 422


def test_create_scene_rejects_end_before_start(client, seeded_day18):
    day_id = seeded_day18["day"].id
    location_id = seeded_day18["locations"]["stage_b"].id
    r = client.post(f"/api/shooting-days/{day_id}/scenes", json={
        "scene_number": "52", "title": "Backwards Scene", "int_ext": "INT", "location_id": location_id,
        "start": "13:00", "end": "12:00",
    })
    assert r.status_code == 422


def test_cannot_delete_actor_in_use(client, seeded_day18):
    maya_id = seeded_day18["actors"]["maya"].id
    r = client.delete(f"/api/actors/{maya_id}")
    assert r.status_code == 409


def test_cannot_delete_location_in_use(client, seeded_day18):
    stage_b_id = seeded_day18["locations"]["stage_b"].id
    r = client.delete(f"/api/locations/{stage_b_id}")
    assert r.status_code == 409


def test_cannot_delete_equipment_in_use(client, seeded_day18):
    camera_a_id = seeded_day18["equipment"]["camera_a"].id
    r = client.delete(f"/api/equipment/{camera_a_id}")
    assert r.status_code == 409


def test_can_delete_unused_actor(client):
    r = client.post("/api/actors", json={"name": "Unused Actor"})
    actor_id = r.json()["id"]
    assert client.delete(f"/api/actors/{actor_id}").status_code == 204
