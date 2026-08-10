from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as m
from app.agents.orchestrator import get_known_names
from app.core.database import get_db
from app.schemas.disruption import DisruptionExtractionResult, DisruptionParseRequest
from app.services.gemini_service import parse_disruption_text

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])


@router.post("/parse", response_model=DisruptionExtractionResult)
def parse_disruption(payload: DisruptionParseRequest, db: Session = Depends(get_db)):
    day = db.get(m.ShootingDay, payload.shooting_day_id)
    if day is None:
        raise HTTPException(404, "Shooting day not found")
    known_names = get_known_names(db, payload.shooting_day_id)
    return parse_disruption_text(payload.raw_text, known_names)
