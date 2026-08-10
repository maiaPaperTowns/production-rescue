from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Disruption(Base):
    __tablename__ = "disruptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    raw_text: Mapped[str] = mapped_column(Text)
    disruption_type: Mapped[str] = mapped_column(String(30))  # weather | actor_availability | equipment_delay | location_lost
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    shooting_day: Mapped["ShootingDay"] = relationship(back_populates="disruptions")
