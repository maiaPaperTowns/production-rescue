from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    location_type: Mapped[str] = mapped_column(String(20))  # "exterior" | "interior" | "stage"
    address: Mapped[str] = mapped_column(String(250), default="")
    permit_required: Mapped[bool] = mapped_column(default=False)

    scenes: Mapped[list["Scene"]] = relationship(back_populates="location")
    availability: Mapped[list["LocationAvailability"]] = relationship(back_populates="location", cascade="all, delete-orphan")


class LocationAvailability(Base):
    __tablename__ = "location_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    shooting_day_id: Mapped[int] = mapped_column(ForeignKey("shooting_days.id"))
    available_start_min: Mapped[int] = mapped_column(Integer)
    available_end_min: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(String(200), default="")

    location: Mapped["Location"] = relationship(back_populates="availability")
