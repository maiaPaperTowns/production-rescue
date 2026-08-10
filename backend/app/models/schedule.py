from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE | PROPOSED | APPROVED | REJECTED
    created_by: Mapped[str] = mapped_column(String(20), default="system")  # "agent" | "human" | "system"
    label: Mapped[str] = mapped_column(String(50), default="")  # "Plan A", "Plan B"...
    score: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    is_current: Mapped[bool] = mapped_column(default=False)
    agent_run_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agent_runs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    shooting_day: Mapped["ShootingDay"] = relationship(back_populates="schedule_versions")
    assignments: Mapped[list["ScheduleAssignment"]] = relationship(back_populates="schedule_version", cascade="all, delete-orphan")


class ScheduleAssignment(Base):
    __tablename__ = "schedule_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_version_id: Mapped[int] = mapped_column(ForeignKey("schedule_versions.id"))
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"))
    start_min: Mapped[int] = mapped_column(Integer)
    end_min: Mapped[int] = mapped_column(Integer)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled | delayed | dropped
    change_reason: Mapped[str] = mapped_column(String(300), default="")

    schedule_version: Mapped["ScheduleVersion"] = relationship(back_populates="assignments")
