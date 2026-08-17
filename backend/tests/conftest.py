from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models as m
from app.core.database import Base


def hm(h: int, mi: int = 0) -> int:
    return h * 60 + mi


@pytest.fixture(autouse=True)
def _isolate_from_local_credentials(monkeypatch):
    """Tests must always exercise the deterministic mock/fallback path,
    regardless of whatever GOOGLE_API_KEY / PARALLEL_API_KEY a developer has
    configured in their local .env for manual testing against the real APIs.
    Settings is an lru_cache'd singleton that every service module captured a
    reference to at import time, so patching its attributes here is visible
    everywhere without needing to touch os.environ or re-import anything."""
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "google_api_key", "")
    monkeypatch.setattr(settings, "parallel_api_key", "")


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture()
def seeded_day18(db_session):
    """Minimal, self-contained rebuild of the Project Aurora day-18 demo schedule,
    independent of backend/seed.py so solver tests don't break if seed data changes."""
    db = db_session
    production = m.Production(name="Project Aurora", total_shooting_days=42, current_day_number=18, daily_budget=120000)
    db.add(production)
    db.flush()
    day = m.ShootingDay(production_id=production.id, day_number=18, shoot_date=date(2026, 8, 10),
                         day_start="07:00", day_end="21:00", status="on_track")
    db.add(day)
    db.flush()

    actor_defs = {"maya": ("Maya Chen", 15000), "daniel": ("Daniel Ortiz", 12000), "sarah": ("Sarah Kim", 8000)}
    actors = {k: m.Actor(name=n, day_rate=r) for k, (n, r) in actor_defs.items()}
    db.add_all(actors.values())
    db.flush()

    location_defs = {"riverside": ("Riverside Park", "exterior"), "downtown": ("Downtown Street", "exterior"),
                      "stage_b": ("Stage B", "stage"), "stage_c": ("Stage C", "stage")}
    locations = {k: m.Location(name=n, location_type=t) for k, (n, t) in location_defs.items()}
    db.add_all(locations.values())
    db.flush()

    equipment_defs = {"camera_a": "Camera A", "camera_b": "Camera B", "drone": "Drone", "vehicle_rig": "Vehicle Rig"}
    equipment = {k: m.Equipment(name=n) for k, n in equipment_defs.items()}
    db.add_all(equipment.values())
    db.flush()

    scene12 = m.Scene(shooting_day_id=day.id, scene_number="12", title="Riverside confrontation", int_ext="EXT",
                       location_id=locations["riverside"].id, original_start_min=hm(8), original_end_min=hm(10),
                       duration_min=120, weather_requirement="dry", daylight_required=True, priority=4)
    scene18 = m.Scene(shooting_day_id=day.id, scene_number="18", title="Car chase", int_ext="EXT",
                       location_id=locations["downtown"].id, original_start_min=hm(10, 30), original_end_min=hm(13),
                       duration_min=150, weather_requirement="dry", daylight_required=True, priority=5)
    scene24 = m.Scene(shooting_day_id=day.id, scene_number="24", title="Apartment conversation", int_ext="INT",
                       location_id=locations["stage_b"].id, original_start_min=hm(14), original_end_min=hm(16),
                       duration_min=120, weather_requirement=None, daylight_required=False, priority=3)
    scene25 = m.Scene(shooting_day_id=day.id, scene_number="25", title="Apartment kitchen", int_ext="INT",
                       location_id=locations["stage_b"].id, original_start_min=hm(16, 15), original_end_min=hm(17, 30),
                       duration_min=75, weather_requirement=None, daylight_required=False, priority=3)
    scene31 = m.Scene(shooting_day_id=day.id, scene_number="31", title="Police office", int_ext="INT",
                       location_id=locations["stage_c"].id, original_start_min=hm(18), original_end_min=hm(20),
                       duration_min=120, weather_requirement=None, daylight_required=False, priority=4)
    db.add_all([scene12, scene18, scene24, scene25, scene31])
    db.flush()
    db.add(m.SceneDependency(scene_id=scene25.id, depends_on_scene_id=scene24.id))

    cast_map = [(scene12, ["maya", "daniel"]), (scene18, ["daniel"]), (scene24, ["maya", "sarah"]),
                (scene25, ["maya"]), (scene31, ["daniel", "sarah"])]
    for scene, keys in cast_map:
        for k in keys:
            db.add(m.SceneCast(scene_id=scene.id, actor_id=actors[k].id))

    equip_map = [(scene12, ["camera_a", "drone"]), (scene18, ["camera_a", "camera_b", "vehicle_rig"]),
                 (scene24, ["camera_a"]), (scene25, ["camera_a"]), (scene31, ["camera_b"])]
    for scene, keys in equip_map:
        for k in keys:
            db.add(m.SceneEquipment(scene_id=scene.id, equipment_id=equipment[k].id))

    for k in ["maya", "daniel", "sarah"]:
        db.add(m.ActorAvailability(actor_id=actors[k].id, shooting_day_id=day.id,
                                    available_start_min=hm(7), available_end_min=hm(21)))
    for k in ["riverside", "downtown", "stage_b", "stage_c"]:
        db.add(m.LocationAvailability(location_id=locations[k].id, shooting_day_id=day.id,
                                       available_start_min=hm(7), available_end_min=hm(21)))
    for k in ["camera_a", "camera_b", "drone", "vehicle_rig"]:
        db.add(m.EquipmentAvailability(equipment_id=equipment[k].id, shooting_day_id=day.id,
                                        available_start_min=hm(7), available_end_min=hm(21)))

    version = m.ScheduleVersion(shooting_day_id=day.id, version_number=1, status="ACTIVE",
                                 created_by="system", label="Original Plan", is_current=True)
    db.add(version)
    db.flush()
    for scene in [scene12, scene18, scene24, scene25, scene31]:
        db.add(m.ScheduleAssignment(schedule_version_id=version.id, scene_id=scene.id,
                                     start_min=scene.original_start_min, end_min=scene.original_end_min,
                                     location_id=scene.location_id))
    db.commit()

    return {
        "db": db, "production": production, "day": day,
        "scenes": {"12": scene12, "18": scene18, "24": scene24, "25": scene25, "31": scene31},
        "actors": actors, "locations": locations, "equipment": equipment, "version": version,
    }
