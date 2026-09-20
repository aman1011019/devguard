"""Demo control endpoints — SIMULATE INCIDENT and RESET.

These drive the flagship deterministic demo: injecting the broken-checkout
incident and resetting the controlled service back to a healthy baseline.
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.serialize import to_detail
from app.core.enums import ACTIVE_STATUSES, IncidentStatus
from app.core.database import get_db
from app.models.models import Incident
from app.schemas.schemas import ActionResponse, IncidentDetail
from app.services.incident_service import create_demo_incident
from app.services.ws_manager import GLOBAL_CHANNEL, ws_manager
from app.simulation import fixtures
from app.simulation.engine import simulation

router = APIRouter(prefix="/api/demo", tags=["demo"])


def _active_checkout(db: Session) -> Incident | None:
    return db.scalars(
        select(Incident)
        .where(Incident.service == fixtures.SERVICE)
        .where(Incident.status.in_([s.value for s in ACTIVE_STATUSES]))
        .order_by(Incident.detected_at.desc())
    ).first()


@router.post("/inject-incident", response_model=IncidentDetail)
async def inject_incident(db: Session = Depends(get_db)) -> IncidentDetail:
    """Break the checkout service (idempotent — reuses an open incident)."""
    incident = _active_checkout(db)
    created = False
    if incident is None:
        incident = create_demo_incident(db)
        created = True
    else:
        # Ensure the controlled service is in its broken state.
        simulation.break_service(incident.id)

    db.refresh(incident)
    detail = to_detail(incident)

    await ws_manager.broadcast_global(
        {
            "type": "incident_detected",
            "incident_id": incident.id,
            "service": incident.service,
            "title": incident.title,
            "severity": incident.severity,
            "status": incident.status,
            "created": created,
        }
    )
    return detail


@router.post("/reset", response_model=ActionResponse)
async def reset_demo(db: Session = Depends(get_db)) -> ActionResponse:
    """Return the controlled service to a healthy baseline.

    Removes still-open incidents (keeps resolved history) and clears the
    WebSocket replay buffers so a fresh demo run starts clean.
    """
    active = db.scalars(
        select(Incident).where(Incident.status.in_([s.value for s in ACTIVE_STATUSES]))
    ).all()
    removed = 0
    for inc in active:
        ws_manager.clear_history(inc.id)
        db.delete(inc)
        removed += 1
    db.commit()

    simulation.reset()
    ws_manager.clear_history(GLOBAL_CHANNEL)

    await ws_manager.broadcast_global({"type": "system_reset", "removed": removed})
    return ActionResponse(
        ok=True,
        status=IncidentStatus.HEALTHY.value,
        message=f"System reset to healthy ({removed} active incident(s) cleared)",
    )
