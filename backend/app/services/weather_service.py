"""Weather abstraction. In production this would call a real provider (or the
Parallel partner API for broader situational context); for the MVP it derives
a structured forecast from any weather disruption already reported for the
day, and otherwise returns a clear/dry default. Isolated behind this function
so swapping in a real provider later touches only this file."""
from __future__ import annotations

from typing import Optional

from app.services.scheduling_models import ParsedDisruption


def get_weather(location: str, date: str, disruptions: Optional[list] = None) -> dict:
    disruptions = disruptions or []
    weather_disruption = next((d for d in disruptions if isinstance(d, ParsedDisruption) and d.type == "weather"), None)
    if weather_disruption:
        return {
            "location": location,
            "date": date,
            "condition": weather_disruption.condition or "adverse",
            "dry": False,
            "blackout_window": f"{weather_disruption.start_time}-{weather_disruption.end_time}",
            "source": "reported",
        }
    return {
        "location": location,
        "date": date,
        "condition": "clear",
        "dry": True,
        "blackout_window": None,
        "source": "forecast_mock",
    }
