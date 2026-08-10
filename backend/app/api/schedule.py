from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as m
from app.core.database import get_db
from app.schemas.production import ActorOut, EquipmentOut, LocationOut, SceneOut
from app.schemas.schedule import AssignmentOut, ScheduleOut, ScheduleVersionOut
from app.services.interval_utils import fmt_hm

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


@router.get("/scenes/{scene_id}", response_model=SceneOut)
def get_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.get(m.Scene, scene_id)
    if scene is None:
        raise HTTPException(404, "Scene not found")
    return scene_to_out(scene, db)


@router.get("/actors", response_model=list[ActorOut])
def list_actors(db: Session = Depends(get_db)):
    return db.query(m.Actor).all()


@router.get("/locations", response_model=list[LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.query(m.Location).all()


@router.get("/equipment", response_model=list[EquipmentOut])
def list_equipment(db: Session = Depends(get_db)):
    return db.query(m.Equipment).all()
