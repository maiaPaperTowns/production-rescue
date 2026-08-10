from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Production(Base):
    __tablename__ = "productions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    total_shooting_days: Mapped[int] = mapped_column(Integer, default=1)
    current_day_number: Mapped[int] = mapped_column(Integer, default=1)
    daily_budget: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    shooting_days: Mapped[list["ShootingDay"]] = relationship(back_populates="production", cascade="all, delete-orphan")


class ShootingDay(Base):
    __tablename__ = "shooting_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_id: Mapped[int] = mapped_column(ForeignKey("productions.id"))
    day_number: Mapped[int] = mapped_column(Integer)
    shoot_date: Mapped[date] = mapped_column(Date)
    day_start: Mapped[str] = mapped_column(String(5), default="07:00")
    day_end: Mapped[str] = mapped_column(String(5), default="20:00")
    status: Mapped[str] = mapped_column(String(30), default="on_track")

    production: Mapped["Production"] = relationship(back_populates="shooting_days")
    scenes: Mapped[list["Scene"]] = relationship(back_populates="shooting_day", cascade="all, delete-orphan")
    disruptions: Mapped[list["Disruption"]] = relationship(back_populates="shooting_day", cascade="all, delete-orphan")
    schedule_versions: Mapped[list["ScheduleVersion"]] = relationship(back_populates="shooting_day", cascade="all, delete-orphan")
