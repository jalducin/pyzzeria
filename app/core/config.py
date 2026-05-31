from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "pos-retail"
    environment: str = Field(default="local")

    database_url: str = Field(default="postgresql+psycopg://pos:pos@localhost:5432/pos")
    redis_url: str = Field(default="redis://localhost:6379/0")

    jwt_secret: str = Field(default="change-me-in-prod")
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 8

    bcrypt_rounds: int = 12

    timezone: str = "America/Mexico_City"
    iva_rate: float = 0.16


@lru_cache
def get_settings() -> Settings:
    return Settings()
