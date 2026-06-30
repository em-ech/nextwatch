"""Application settings, env-driven with safe dev fallbacks.

Override any field with a REVERIE_-prefixed env var, e.g. REVERIE_JWT_SECRET,
or a .env file in the repo root.
"""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

# A development-only secret. Real deployments MUST set REVERIE_JWT_SECRET.
_DEV_SECRET = "dev-insecure-change-me-set-REVERIE_JWT_SECRET-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="REVERIE_", env_file=".env", extra="ignore"
    )

    jwt_secret: str = _DEV_SECRET
    jwt_ttl_days: int = 7
    db_url: str = "sqlite:///./reverie.db"
    default_region: str = "US"
    tmdb_api_key: str | None = None
    # "modern" -> Letterboxd catalog served by the NCF model (post-2000 films);
    # "ml1m" -> the original MovieLens GRU demo.
    catalog_mode: str = "modern"


settings = Settings()

if settings.jwt_secret == _DEV_SECRET:
    logging.getLogger("reverie").warning(
        "Using the insecure development JWT secret. "
        "Set REVERIE_JWT_SECRET before any real deployment."
    )
