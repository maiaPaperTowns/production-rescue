"""Seed script for Production Rescue demo data: Project Aurora, day 18 of 42.

Run with:  python seed.py
Wipes and recreates all tables, then inserts realistic production data sized
so the primary demo disruption (thunderstorm + Maya's 2pm departure + Camera B
delay) genuinely breaks the day-18 schedule and requires the solver to find
a feasible alternative.
"""
from datetime import date

from app.core.database import Base, SessionLocal, engine
import app.models as m

DAY_START = 7 * 60       # 07:00
DAY_END = 21 * 60        # 21:00


def hm(hour: int, minute: int = 0) -> int:
    return hour * 60 + minute


def run():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        production = m.Production(
            name="Project Aurora",
            total_shooting_days=42,
            current_day_number=18,
            daily_budget=120000,
        )
        db.add(production)
        db.flush()

        day17 = m.ShootingDay(production_id=production.id, day_number=17, shoot_date=date(2026, 8, 8),
                               day_start="07:00", day_end="21:00", status="completed")
        day18 = m.ShootingDay(production_id=production.id, day_number=18, shoot_date=date(2026, 8, 10),
                               day_start="07:00", day_end="21:00", status="on_track")
        day19 = m.ShootingDay(production_id=production.id, day_number=19, shoot_date=date(2026, 8, 11),
                               day_start="07:00", day_end="21:00", status="scheduled")
        db.add_all([day17, day18, day19])
        db.flush()

        actors = {
            "maya": m.Actor(name="Maya Chen", role="Lead - Detective Reyes", day_rate=15000),
            "daniel": m.Actor(name="Daniel Ortiz", role="Lead - Marcus Wells", day_rate=12000),
            "sarah": m.Actor(name="Sarah Kim", role="Supporting - Captain Reyes", day_rate=8000),
            "tom": m.Actor(name="Tom Bradley", role="Supporting - Detective Hale", day_rate=5000),
            "priya": m.Actor(name="Priya Nair", role="Supporting - Agent Shaw", day_rate=5000),
            "chris": m.Actor(name="Chris Duval", role="Supporting - Officer Reed", day_rate=3500),
        }
        for a in actors.values():
            db.add(a)
        db.flush()

        locations = {
            "riverside": m.Location(name="Riverside Park", location_type="exterior",
                                     address="Riverside Park, Bank St", permit_required=True),
            "downtown": m.Location(name="Downtown Street", location_type="exterior",
                                    address="5th & Main, Downtown", permit_required=True),
            "stage_b": m.Location(name="Stage B", location_type="stage", address="Aurora Studios, Building 2"),
            "stage_c": m.Location(name="Stage C", location_type="stage", address="Aurora Studios, Building 3"),
            "warehouse": m.Location(name="Warehouse District", location_type="exterior",
                                     address="Old Warehouse District, Dock 7", permit_required=True),
        }
        for l in locations.values():
            db.add(l)
        db.flush()

        equipment = {
            "camera_a": m.Equipment(name="Camera A", category="camera"),
            "camera_b": m.Equipment(name="Camera B", category="camera"),
            "drone": m.Equipment(name="Drone", category="aerial"),
            "vehicle_rig": m.Equipment(name="Vehicle Rig", category="rig"),
            "lighting_rig": m.Equipment(name="Lighting Rig", category="lighting"),
            "jib_arm": m.Equipment(name="Jib Arm", category="camera_support"),
            "steadicam": m.Equipment(name="Steadicam", category="camera_support"),
            "sound_cart": m.Equipment(name="Sound Cart", category="sound"),
        }
        for e in equipment.values():
            db.add(e)
        db.flush()

        def avail_all_day(entity_kind: str, entity, shooting_day):
            row_cls = {
                "actor": m.ActorAvailability,
                "location": m.LocationAvailability,
                "equipment": m.EquipmentAvailability,
            }[entity_kind]
            fk = {"actor": "actor_id", "location": "location_id", "equipment": "equipment_id"}[entity_kind]
            db.add(row_cls(**{fk: entity.id}, shooting_day_id=shooting_day.id,
                            available_start_min=DAY_START, available_end_min=DAY_END))

        # ---------- Day 18: the primary demo schedule ----------
        scene12 = m.Scene(shooting_day_id=day18.id, scene_number="12", title="Riverside confrontation",
                           int_ext="EXT", location_id=locations["riverside"].id,
                           original_start_min=hm(8), original_end_min=hm(10), duration_min=120,
                           weather_requirement="dry", daylight_required=True, priority=4)
        scene18 = m.Scene(shooting_day_id=day18.id, scene_number="18", title="Car chase",
                           int_ext="EXT", location_id=locations["downtown"].id,
                           original_start_min=hm(10, 30), original_end_min=hm(13), duration_min=150,
                           weather_requirement="dry", daylight_required=True, priority=5)
        scene24 = m.Scene(shooting_day_id=day18.id, scene_number="24", title="Apartment conversation",
                           int_ext="INT", location_id=locations["stage_b"].id,
                           original_start_min=hm(14), original_end_min=hm(16), duration_min=120,
                           weather_requirement=None, daylight_required=False, priority=3)
        scene25 = m.Scene(shooting_day_id=day18.id, scene_number="25", title="Apartment kitchen",
                           int_ext="INT", location_id=locations["stage_b"].id,
                           original_start_min=hm(16, 15), original_end_min=hm(17, 30), duration_min=75,
                           weather_requirement=None, daylight_required=False, priority=3)
        scene31 = m.Scene(shooting_day_id=day18.id, scene_number="31", title="Police office",
                           int_ext="INT", location_id=locations["stage_c"].id,
                           original_start_min=hm(18), original_end_min=hm(20), duration_min=120,
                           weather_requirement=None, daylight_required=False, priority=4)
        db.add_all([scene12, scene18, scene24, scene25, scene31])
        db.flush()

        # Scene 25 continues Maya's emotional arc from scene 24 on the same set -> ordering dependency
        db.add(m.SceneDependency(scene_id=scene25.id, depends_on_scene_id=scene24.id))

        cast_map = [
            (scene12, ["maya", "daniel"]),
            (scene18, ["daniel"]),
            (scene24, ["maya", "sarah"]),
            (scene25, ["maya"]),
            (scene31, ["daniel", "sarah"]),
        ]
        for scene, actor_keys in cast_map:
            for key in actor_keys:
                db.add(m.SceneCast(scene_id=scene.id, actor_id=actors[key].id))

        equip_map = [
            (scene12, ["camera_a", "drone"]),
            (scene18, ["camera_a", "camera_b", "vehicle_rig"]),
            (scene24, ["camera_a"]),
            (scene25, ["camera_a"]),
            (scene31, ["camera_b"]),
        ]
        for scene, equip_keys in equip_map:
            for key in equip_keys:
                db.add(m.SceneEquipment(scene_id=scene.id, equipment_id=equipment[key].id))

        for key in ["maya", "daniel", "sarah"]:
            avail_all_day("actor", actors[key], day18)
        for key in ["riverside", "downtown", "stage_b", "stage_c"]:
            avail_all_day("location", locations[key], day18)
        for key in ["camera_a", "camera_b", "drone", "vehicle_rig"]:
            avail_all_day("equipment", equipment[key], day18)

        # ---------- Day 17: completed, padding data ----------
        scene8 = m.Scene(shooting_day_id=day17.id, scene_number="8", title="Office briefing",
                          int_ext="INT", location_id=locations["stage_c"].id,
                          original_start_min=hm(9), original_end_min=hm(11), duration_min=120,
                          weather_requirement=None, daylight_required=False, priority=3)
        scene9 = m.Scene(shooting_day_id=day17.id, scene_number="9", title="Rooftop stakeout",
                          int_ext="EXT", location_id=locations["warehouse"].id,
                          original_start_min=hm(13), original_end_min=hm(15, 30), duration_min=150,
                          weather_requirement="dry", daylight_required=True, priority=3)
        db.add_all([scene8, scene9])
        db.flush()
        db.add(m.SceneCast(scene_id=scene8.id, actor_id=actors["daniel"].id))
        db.add(m.SceneCast(scene_id=scene8.id, actor_id=actors["chris"].id))
        db.add(m.SceneCast(scene_id=scene9.id, actor_id=actors["tom"].id))
        db.add(m.SceneCast(scene_id=scene9.id, actor_id=actors["priya"].id))
        db.add(m.SceneEquipment(scene_id=scene8.id, equipment_id=equipment["camera_b"].id))
        db.add(m.SceneEquipment(scene_id=scene9.id, equipment_id=equipment["camera_a"].id))
        db.add(m.SceneEquipment(scene_id=scene9.id, equipment_id=equipment["drone"].id))

        # ---------- Day 19: upcoming, padding data ----------
        scene40 = m.Scene(shooting_day_id=day19.id, scene_number="40", title="Hospital corridor",
                           int_ext="INT", location_id=locations["stage_b"].id,
                           original_start_min=hm(9), original_end_min=hm(11), duration_min=120,
                           weather_requirement=None, daylight_required=False, priority=3)
        scene41 = m.Scene(shooting_day_id=day19.id, scene_number="41", title="Warehouse shootout",
                           int_ext="EXT", location_id=locations["warehouse"].id,
                           original_start_min=hm(13), original_end_min=hm(16), duration_min=180,
                           weather_requirement="dry", daylight_required=True, priority=5)
        scene42 = m.Scene(shooting_day_id=day19.id, scene_number="42", title="Debrief",
                           int_ext="INT", location_id=locations["stage_c"].id,
                           original_start_min=hm(17), original_end_min=hm(18, 30), duration_min=90,
                           weather_requirement=None, daylight_required=False, priority=2)
        db.add_all([scene40, scene41, scene42])
        db.flush()
        db.add(m.SceneCast(scene_id=scene40.id, actor_id=actors["sarah"].id))
        db.add(m.SceneCast(scene_id=scene40.id, actor_id=actors["chris"].id))
        db.add(m.SceneCast(scene_id=scene41.id, actor_id=actors["tom"].id))
        db.add(m.SceneCast(scene_id=scene41.id, actor_id=actors["daniel"].id))
        db.add(m.SceneCast(scene_id=scene41.id, actor_id=actors["priya"].id))
        db.add(m.SceneCast(scene_id=scene42.id, actor_id=actors["maya"].id))
        db.add(m.SceneCast(scene_id=scene42.id, actor_id=actors["sarah"].id))
        db.add(m.SceneEquipment(scene_id=scene40.id, equipment_id=equipment["camera_a"].id))
        db.add(m.SceneEquipment(scene_id=scene41.id, equipment_id=equipment["camera_a"].id))
        db.add(m.SceneEquipment(scene_id=scene41.id, equipment_id=equipment["camera_b"].id))
        db.add(m.SceneEquipment(scene_id=scene41.id, equipment_id=equipment["vehicle_rig"].id))
        db.add(m.SceneEquipment(scene_id=scene42.id, equipment_id=equipment["camera_b"].id))

        # ---------- Active/current schedule version for day 18 ----------
        version1 = m.ScheduleVersion(shooting_day_id=day18.id, version_number=1, status="ACTIVE",
                                      created_by="system", label="Original Plan", score=100, is_current=True)
        db.add(version1)
        db.flush()
        for scene in [scene12, scene18, scene24, scene25, scene31]:
            db.add(m.ScheduleAssignment(schedule_version_id=version1.id, scene_id=scene.id,
                                         start_min=scene.original_start_min, end_min=scene.original_end_min,
                                         location_id=scene.location_id, status="scheduled"))

        db.commit()
        print("Seed complete.")
        print(f"Production: {production.name} (day {production.current_day_number}/{production.total_shooting_days})")
        print(f"Scenes: {db.query(m.Scene).count()}, Actors: {db.query(m.Actor).count()}, "
              f"Locations: {db.query(m.Location).count()}, Equipment: {db.query(m.Equipment).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
