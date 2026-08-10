from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Actor(Base):
    __tablename__ = "actors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120), default="")
    day_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    scene_links: Mapped[list["SceneCast"]] = relationship(back_populates="actor")
    availability: Mapped[list["ActorAvailability"]] = relationship(back_populates="actor", cascade="all, delete-orphan")


class ActorAvailability(Base):
    __tablename__ = "actor_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("actors.id"))
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    available_start_min: Mapped[int] = mapped_column(Integer)
    available_end_min: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(String(200), default="")

    actor: Mapped["Actor"] = relationship(back_populates="availability")
