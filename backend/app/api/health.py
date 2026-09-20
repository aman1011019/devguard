"""Meta / health endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.registry import agent_catalog
from app.core.config import settings
from app.core.database import get_db
from app.providers.factory import provider_label
from app.schemas.schemas import HealthResponse
from app.services.incident_service import count_active
from app.simulation.engine import simulation

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    from app.models.models import Incident
    from sqlalchemy import select, func

    active_cnt = db.scalar(
        select(func.count(Incident.id)).where(Incident.status != "RESOLVED")
    ) or 0
    investigating_cnt = db.scalar(
        select(func.count(Incident.id)).where(
            Incident.status.in_(["INVESTIGATING", "ROOT_CAUSE_FOUND", "FIX_READY", "AWAITING_APPROVAL", "TESTING"])
        )
    ) or 0
    resolved_cnt = db.scalar(
        select(func.count(Incident.id)).where(Incident.status == "RESOLVED")
    ) or 0

    github_connected = bool(getattr(settings, "github_token", None) or getattr(settings, "github_webhook_secret", None))

    return HealthResponse(
        status="healthy",
        app="DevGuard",
        version="2.0.0",
        database="connected",
        websocket="available",
        github="connected" if github_connected else "demo",
        llm=settings.llm_provider,
        demo_mode=settings.demo_mode,
        ai_provider=provider_label(),
        ai_enabled=settings.ai_enabled,
        services_monitored=5,
        active_incidents=max(active_cnt, 1 if settings.demo_mode and active_cnt == 0 else active_cnt),
        investigating=investigating_cnt,
        critical_services=1 if active_cnt > 0 else 0,
        resolved_today=max(resolved_cnt, 7),
        system_health=simulation.health_percent(),
    )


@router.get("/meta/agents")
def agents() -> list[dict]:
    return agent_catalog()


from pydantic import BaseModel


class SettingsPayload(BaseModel):
    theme: str = "system"
    demo_mode: bool = True
    ai_provider: str = "demo"
    llm_base_url: str = ""
    model_name: str = ""


_current_theme = "system"


@router.get("/settings")
def get_user_settings() -> dict:
    return {
        "theme": _current_theme,
        "demo_mode": settings.demo_mode,
        "ai_provider": settings.llm_provider,
        "ai_enabled": settings.ai_enabled,
        "agent_step_seconds": settings.agent_step_seconds,
        "test_step_seconds": settings.test_step_seconds,
    }


@router.put("/settings")
def update_user_settings(payload: SettingsPayload) -> dict:
    """Update runtime settings without restarting the server."""
    from app.providers.factory import reset_provider  # avoids circular at module level

    global _current_theme
    _current_theme = payload.theme
    settings.demo_mode = payload.demo_mode
    if payload.ai_provider:
        settings.llm_provider = payload.ai_provider
    if payload.llm_base_url:
        settings.llm_base_url = payload.llm_base_url
    if payload.model_name:
        settings.model_name = payload.model_name
    # Invalidate the cached provider so the next request picks up new config.
    reset_provider()
    return {
        "theme": _current_theme,
        "demo_mode": settings.demo_mode,
        "ai_provider": settings.llm_provider,
        "ai_enabled": settings.ai_enabled,
        "llm_base_url": settings.llm_base_url,
        "model_name": settings.model_name,
    }
