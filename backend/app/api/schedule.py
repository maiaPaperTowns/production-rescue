from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as m
from app.core.database import get_db
from app.schemas.production import ActorOut, EquipmentOut, LocationOut, SceneOut
from app.schemas.schedule import AssignmentOut, ScheduleOut, ScheduleVersionOut
from app.schemas.setup import ActorCreate, EquipmentCreate, LocationCreate, SceneCreate
from app.services.interval_utils import fmt_hm, parse_hm

router = APIRouter(prefix="/api", tags=["schedule"])


def scene_to_out(scene: m.Scene, db: Session) -> SceneOut:
    return SceneOut(
        id=scene.id, scene_number=scene.scene_number, title=scene.title, int_ext=scene.int_ext,
        duration_min=scene.duration_min, original_start=fmt_hm(scene.original_start_min),
        original_end=fmt_hm(scene.original_end_min), weather_requirement=scene.weather_requirement,
        daylight_required=scene.daylight_required, priority=scene.priority,
        location=LocationOut.model_validate(scene.location),
        cast=[ActorOut.model_validate(link.actor) for link in scene.cast_links],
        equipment=[EquipmentOut.model_validate(link.equipment) for link in scene.equipment_links],
        depends_on=[db.get(m.Scene, dep.depends_on_scene_id).scene_number for dep in scene.dependencies],
    )


def assignment_to_out(a: m.ScheduleAssignment, db: Session) -> AssignmentOut:
    scene = db.get(m.Scene, a.scene_id)
    location = db.get(m.Location, a.location_id)
    return AssignmentOut(
        scene_id=a.scene_id, scene_number=scene.scene_number, title=scene.title,
        start=fmt_hm(a.start_min), end=fmt_hm(a.end_min), location_id=a.location_id,
        location_name=location.name if location else "", status=a.status, change_reason=a.change_reason,
    )


def version_to_out(version: m.ScheduleVersion, db: Session) -> ScheduleVersionOut:
    return ScheduleVersionOut(
        id=version.id, version_number=version.version_number, status=version.status, label=version.label,
        score=float(version.score), is_current=version.is_current, created_by=version.created_by,
        created_at=version.created_at,
        assignments=[assignment_to_out(a, db) for a in sorted(version.assignments, key=lambda x: x.start_min)],
    )


@router.get("/shooting-days/{shooting_day_id}/schedule", response_model=ScheduleOut)
def get_schedule(shooting_day_id: int, db: Session = Depends(get_db)):
    day = db.get(m.ShootingDay, shooting_day_id)
    if day is None:
        raise HTTPException(404, "Shooting day not found")
    current = db.query(m.ScheduleVersion).filter_by(shooting_day_id=shooting_day_id, is_current=True).first()
    return ScheduleOut(
        shooting_day_id=day.id, day_number=day.day_number, shoot_date=str(day.shoot_date), status=day.status,
        current_version=version_to_out(current, db) if current else None,
    )


@router.get("/shooting-days/{shooting_day_id}/schedule-versions", response_model=list[ScheduleVersionOut])
def list_schedule_versions(shooting_day_id: int, db: Session = Depends(get_db)):
    """Every schedule version ever created for this day, oldest first. Version 1
    is always the original plan before any rescue was applied; the frontend uses
    this to power the Original vs Current comparison toggle."""
    day = db.get(m.ShootingDay, shooting_day_id)
    if day is None:
        raise HTTPException(404, "Shooting day not found")
    versions = (
        db.query(m.ScheduleVersion)
        .filter_by(shooting_day_id=shooting_day_id)
        .order_by(m.ScheduleVersion.version_number)
        .all()
    )
    return [version_to_out(v, db) for v in versions]


@router.get("/scenes/{scene_id}", response_model=SceneOut)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(m.Scene, scene_id)
    if scene is None:
        raise HTTPException(404, "Scene not found")
    return scene_to_out(scene, db)


@router.get("/actors", response_model=list[ActorOut])
def list_actors(db: Session = Depends(get_db)):
    return db.query(m.Actor).all()


@router.post("/actors", response_model=ActorOut, status_code=201)
def create_actor(payload: ActorCreate, db: Session = Depends(get_db)):
    actor = m.Actor(name=payload.name, role=payload.role, day_rate=payload.day_rate)
    db.add(actor)
    db.commit()
    db.refresh(actor)
    return actor


@router.delete("/actors/{actor_id}", status_code=204)
def delete_actor(actor_id: int, db: Session = Depends(get_db)):
    actor = db.get(m.Actor, actor_id)
    if actor is None:
        raise HTTPException(404, "Actor not found")
    if db.query(m.SceneCast).filter_by(actor_id=actor_id).first():
        raise HTTPException(409, "Actor is cast in one or more scenes; remove them from those scenes first")
    db.delete(actor)
    db.commit()


@router.get("/locations", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.query(m.Location).all()


@router.post("/locations", response_model=LocationOut, status_code=201)
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    location = m.Location(
        name=payload.name, location_type=payload.location_type,
        address=payload.address, permit_required=payload.permit_required,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=204)
def delete_location(location_id: int, db: Session = Depends(get_db)):
    location = db.get(m.Location, location_id)
    if location is None:
        raise HTTPException(404, "Location not found")
    if db.query(m.Scene).filter_by(location_id=location_id).first():
        raise HTTPException(409, "Location is used by one or more scenes; remove or reassign them first")
    db.delete(location)
    db.commit()


@router.get("/equipment", response_model=list[EquipmentOut])
def list_equipment(db: Session = Depends(get_db)):
    return db.query(m.Equipment).all()


@router.post("/equipment", response_model=EquipmentOut, status_code=201)
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db)):
    equipment = m.Equipment(name=payload.name, category=payload.category)
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.delete("/equipment/{equipment_id}", status_code=204)
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.get(m.Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(404, "Equipment not found")
    if db.query(m.SceneEquipment).filter_by(equipment_id=equipment_id).first():
        raise HTTPException(409, "Equipment is used by one or more scenes; remove it from those scenes first")
    db.delete(equipment)
    db.commit()


@router.post("/shooting-days/{shooting_day_id}/scenes", response_model=SceneOut, status_code=201)
def create_scene(shooting_day_id: int, payload: SceneCreate, db: Session = Depends(get_db)):
    day = db.get(m.ShootingDay, shooting_day_id)
    if day is None:
        raise HTTPException(404, "Shooting day not found")
    location = db.get(m.Location, payload.location_id)
    if location is None:
        raise HTTPException(422, "location_id does not exist")
    start_min, end_min = parse_hm(payload.start), parse_hm(payload.end)
    if end_min <= start_min:
        raise HTTPException(422, "end must be after start")
    for actor_id in payload.actor_ids:
        if db.get(m.Actor, actor_id) is None:
            raise HTTPException(422, f"actor_id {actor_id} does not exist")
    for equipment_id in payload.equipment_ids:
        if db.get(m.Equipment, equipment_id) is None:
            raise HTTPException(422, f"equipment_id {equipment_id} does not exist")
    for dep_id in payload.depends_on_scene_ids:
        if db.get(m.Scene, dep_id) is None:
            raise HTTPException(422, f"depends_on_scene_ids contains {dep_id}, which does not exist")

    scene = m.Scene(
        shooting_day_id=shooting_day_id, scene_number=payload.scene_number, title=payload.title,
        int_ext=payload.int_ext, location_id=payload.location_id, original_start_min=start_min,
        original_end_min=end_min, duration_min=end_min - start_min,
        weather_requirement=payload.weather_requirement, daylight_required=payload.daylight_required,
        priority=payload.priority,
    )
    db.add(scene)
    db.flush()
    for actor_id in payload.actor_ids:
        db.add(m.SceneCast(scene_id=scene.id, actor_id=actor_id))
    for equipment_id in payload.equipment_ids:
        db.add(m.SceneEquipment(scene_id=scene.id, equipment_id=equipment_id))
    for dep_id in payload.depends_on_scene_ids:
        db.add(m.SceneDependency(scene_id=scene.id, depends_on_scene_id=dep_id))

    version = db.query(m.ScheduleVersion).filter_by(shooting_day_id=shooting_day_id, is_current=True).first()
    if version is None:
        version = m.ScheduleVersion(
            shooting_day_id=shooting_day_id, version_number=1, status="ACTIVE",
            created_by="user", label="Original Plan", is_current=True,
        )
        db.add(version)
        db.flush()
    db.add(m.ScheduleAssignment(
        schedule_version_id=version.id, scene_id=scene.id, start_min=start_min, end_min=end_min,
        location_id=payload.location_id, status="scheduled",
    ))

    db.commit()
    db.refresh(scene)
    return scene_to_out(scene, db)


@router.delete("/scenes/{scene_id}", status_code=204)
def delete_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(m.Scene, scene_id)
    if scene is None:
        raise HTTPException(404, "Scene not found")
    db.query(m.ScheduleAssignment).filter_by(scene_id=scene_id).delete()
    db.query(m.SceneDependency).filter_by(depends_on_scene_id=scene_id).delete()
    db.delete(scene)
    db.commit()
