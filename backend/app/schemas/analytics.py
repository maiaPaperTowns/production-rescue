from pydantic import BaseModel


class AnalyticsOut(BaseModel):
    rescue_events: int
    production_hours_saved: float
    estimated_cost_avoided: float
    most_common_disruption: str
    average_response_time_ms: float
    rescue_success_rate: float
    disruptions_by_type: dict[str, int]
    hours_saved_series: list[dict]
