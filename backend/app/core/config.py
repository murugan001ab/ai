from typing import Any, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # =========================
    # App
    # =========================

    APP_NAME: str
    APP_VERSION: str
    DEBUG: bool = False
    API_V1_STR: str

    # =========================
    # Security
    # =========================

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # =========================
    # Database
    # =========================

    DATABASE_URL: str
    DB_ECHO: bool = False

    # =========================
    # Kafka
    # =========================

    KAFKA_BOOTSTRAP_SERVERS: str
    KAFKA_TOPIC_AI_EVENTS: str
    KAFKA_TOPIC_ALERTS: str
    KAFKA_CONSUMER_GROUP: str

    # =========================
    # CORS
    # =========================

    BACKEND_CORS_ORIGINS: List[str]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:

        if isinstance(v, str):
            import json
            return json.loads(v)

        return v

    # =========================
    # File Storage
    # =========================

    UPLOAD_DIR: str
    MAX_UPLOAD_SIZE: int


settings = Settings()