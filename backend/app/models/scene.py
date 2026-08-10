from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Scene(Base):
    """A schedulable production scene. All times are stored as minutes-since-midnight
    for arithmetic simplicity in the constraint solver."""

    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(primary_key=True)
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    scene_number: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    int_ext: Mapped[str] = mapped_column(String(3))  # "INT" | "EXT"
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    original_start_min: Mapped[int] = mapped_column(Integer)
    original_end_min: Mapped[int] = mapped_column(Integer)
    duration_min: Mapped[int] = mapped_column(Integer)
    weather_requirement: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "dry" | None
    daylight_required: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=3)  # 1 (low) - 5 (critical)

    shooting_day: Mapped["ShootingDay"] = relationship(back_populates="scenes")
    location: Mapped["Location"] = relationship(back_populates="scenes")
    cast_links: Mapped[list["SceneCast"]] = relationship(back_populates="scene", cascade="all, delete-orphan")
    equipment_links: Mapped[list["SceneEquipment"]] = relationship(back_populates="scene", cascade="all, delete-orphan")
    dependencies: Mapped[list["SceneDependency"]] = relationship(
        foreign_keys="SceneDependency.scene_id", back_populates="scene", cascade="all, delete-orphan"
    )


class SceneCast(Base):
    __tablename__ = "scene_cast"

    id: Mapped[int] = mapped_column(primary_key=True)
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("actors.id"))

    scene: Mapped["Scene"] = relationship(back_populates="cast_links")
    actor: Mapped["Actor"] = relationship(back_populates="scene_links")


class SceneEquipment(Base):
    __tablename__ = "scene_equipment"

    id: Mapped[int] = mapped_column(primary_key=True)
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"))
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))

    scene: Mapped["Scene"] = relationship(back_populates="equipment_links")
    equipment: Mapped["Equipment"] = relationship(back_populates="scene_links")


class SceneDependency(Base):
    """scene_id must be scheduled after depends_on_scene_id completes."""

    __tablename__ = "scene_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"))
    depends_on_scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"))

    scene: Mapped["Scene"] = relationship(foreign_keys=[scene_id], back_populates="dependencies")
