from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as m
from app.core.database import get_db
from app.schemas.production import ProductionOut, ShootingDayOut
from app.schemas.setup import ProductionCreate, ShootingDayCreate

router = APIRouter(prefix="/api/productions", tags=["productions"])


@router.get("", response_model=list[ProductionOut])
def list_productions(db: Session = Depends(get_db)):
    return db.query(m.Production).all()


@router.post("", response_model=ProductionOut, status_code=201)
def create_production(payload: ProductionCreate, db: Session = Depends(get_db)):
    production = m.Production(
        name=payload.name, total_shooting_days=payload.total_shooting_days,
        current_day_number=1, daily_budget=payload.daily_budget,
    )
    db.add(production)
    db.commit()
    db.refresh(production)
    return production


@router.get("/{production_id}", response_model=ProductionOut)
def get_production(production_id: int, db: Session = Depends(get_db)):
    production = db.get(m.Production, production_id)
    if production is None:
        raise HTTPException(404, "Production not found")
    return production


@router.get("/{production_id}/shooting-days", response_model=list[ShootingDayOut])
def list_shooting_days(production_id: int, db: Session = Depends(get_db)):
    return db.query(m.ShootingDay).filter(m.ShootingDay.production_id == production_id).order_by(m.ShootingDay.day_number).all()


@router.post("/{production_id}/shooting-days", response_model=ShootingDayOut, status_code=201)
def create_shooting_day(production_id: int, payload: ShootingDayCreate, db: Session = Depends(get_db)):
    production = db.get(m.Production, production_id)
    if production is None:
        raise HTTPException(404, "Production not found")
    day = m.ShootingDay(
        production_id=production_id, day_number=payload.day_number, shoot_date=payload.shoot_date,
        day_start=payload.day_start, day_end=payload.day_end, status="scheduled",
    )
    db.add(day)
    db.flush()
    # An empty ACTIVE version so the schedule page has something to render
    # into as soon as the first scene is added.
    db.add(m.ScheduleVersion(
        shooting_day_id=day.id, version_number=1, status="ACTIVE",
        created_by="user", label="Original Plan", is_current=True,
    ))
    db.commit()
    db.refresh(day)
    return day
