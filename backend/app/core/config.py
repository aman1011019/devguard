"""Application configuration.

All settings are environment-driven (see ``.env.example``) but every value has a
sensible default so DevGuard boots with zero configuration in Demo Mode.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "DevGuard"
    app_env: str = "development"

    # ── Database ─────────────────────────────────────────────────────────────
    # SQLite by default (zero-config). For PostgreSQL set e.g.
    #   DATABASE_URL=postgresql+psycopg2://devguard:devguard@localhost:5432/devguard
    database_url: str = "sqlite:///./devguard.db"

    # ── AI provider ──────────────────────────────────────────────────────────
    # One of: demo | gemini | openai | ollama
    llm_provider: str = "auto"
    llm_api_key: str = ""
    model_name: str = ""
    llm_base_url: str = ""  # OpenAI-compatible base URL / Ollama host
    demo_mode: bool = False

    # ── Office Kit bridge ────────────────────────────────────────────────────
    office_kit_url: str = ""

    # ── HTTP / CORS ──────────────────────────────────────────────────────────
    cors_origins: str = "*"

    # ── GitHub Integration ───────────────────────────────────────────────────
    github_token: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    github_api_url: str = "https://api.github.com"
    github_webhook_secret: str = ""
    github_default_repo: str = ""

    # ── Telemetry / Prometheus ───────────────────────────────────────────────
    prometheus_url: str = ""

    # ── Codebase & ZIP Security Limits ───────────────────────────────────────
    max_upload_mb: int = 100
    max_extracted_mb: int = 500
    max_files: int = 10000

    # ── Demo timing (seconds) — tuned so the investigation feels alive but the
    #    end-to-end demo stays under ~15s. Override for slower/faster runs. ────
    agent_step_seconds: float = 1.3
    test_step_seconds: float = 0.28

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_enabled(self) -> bool:
        """True when a real LLM provider is configured with credentials."""
        return (
            not self.demo_mode
            and self.llm_provider.lower() != "demo"
            and bool(self.llm_api_key or self.llm_base_url)
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
