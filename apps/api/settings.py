"""Centralized application settings loaded from environment variables.

Uses pydantic-settings so every secret and config knob is:
  - documented in one place
  - validated at startup (fail-fast on missing required values)
  - overridable via .env file or real env vars
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────
    APP_NAME: str = "NexLedger API"
    APP_VERSION: str = "0.6.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./app.db"

    # ── JWT / Auth ───────────────────────────────────────────────────
    SECRET_KEY: str  # required — startup crashes if missing
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # ── Rate limiting ────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # ── Plaid ────────────────────────────────────────────────────────
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"

    # ── Encryption (Fernet key for Plaid tokens at rest) ─────────────
    ENCRYPTION_KEY: str = ""  # generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # ── AI providers ─────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton so env is read once at startup."""
    return Settings()  # type: ignore[call-arg]
