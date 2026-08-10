from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "sqlite:///./production_rescue.db"

    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    google_genai_use_vertexai: bool = False
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"

    parallel_api_key: str = ""
    parallel_api_base: str = "https://api.parallel.ai"

    cors_origins: str = "http://localhost:3000"
    rate_limit_per_minute: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def gemini_configured(self) -> bool:
        return bool(self.google_api_key) or (self.google_genai_use_vertexai and bool(self.google_cloud_project))

    @property
    def parallel_configured(self) -> bool:
        return bool(self.parallel_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
