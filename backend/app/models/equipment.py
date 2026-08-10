from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(50), default="")

    scene_links: Mapped[list["SceneEquipment"]] = relationship(back_populates="equipment")
    availability: Mapped[list["EquipmentAvailability"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")


class EquipmentAvailability(Base):
    __tablename__ = "equipment_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    available_start_min: Mapped[int] = mapped_column(Integer)
    available_end_min: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(String(200), default="")

    equipment: Mapped["Equipment"] = relationship(back_populates="availability")
