from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as m
from app.core.database import get_db
from app.schemas.production import ProductionOut, ShootingDayOut

router = APIRouter(prefix="/api/productions", tags=["productions"])


@router.get("", response_model=list[ProductionOut])
def list_productions(db: Session = Depends(get_db)):
    return db.query(m.Production).all()


@router.get("/{production_id}", response_model=ProductionOut)
def get_production(production_id: int, db: Session = Depends(get_db)):
    production = db.get(m.Production, production_id)
    if production is None:
        raise HTTPException(404, "Production not found")
    return production


@router.get("/{production_id}/shooting-days", response_model=list[ShootingDayOut])
def list_shooting_days(production_id: int, db: Session = Depends(get_db)):
    return db.query(m.ShootingDay).filter(m.ShootingDay.production_id == production_id).order_by(m.ShootingDay.day_number).all()
