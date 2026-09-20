"""Real-time log ingestion endpoint for DevGuard."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Incident, LogEntry
from app.realtime.event_bus import event_bus

router = APIRouter(prefix="/api/logs", tags=["logs"])


class LogIngestRequest(BaseModel):
    service: str = "checkout-api"
    timestamp: Optional[str] = None
    level: str = "ERROR"
    message: str
    trace_id: Optional[str] = None
    request_id: Optional[str] = None
    incident_id: Optional[int] = None


@router.post("/ingest")
async def ingest_log(
    payload: LogIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Determine incident association if not explicitly passed
    inc_id = payload.incident_id
    if inc_id is None:
        active_inc = db.scalars(
            select(Incident).where(Incident.status != "RESOLVED").order_by(Incident.id.desc())
        ).first()
        if active_inc:
            inc_id = active_inc.id

    ts = payload.timestamp or datetime.utcnow().strftime("%H:%M:%S")

    # Persist log entry if associated with an incident
    if inc_id is not None:
        entry = LogEntry(
            incident_id=inc_id,
            timestamp=ts,
            level=payload.level.upper(),
            service=payload.service,
            message=payload.message,
        )
        db.add(entry)
        db.commit()

    # Broadcast log_received across event bus
    log_event = {
        "service": payload.service,
        "timestamp": ts,
        "level": payload.level.upper(),
        "message": payload.message,
        "trace_id": payload.trace_id,
        "request_id": payload.request_id,
        "incident_id": inc_id,
    }
    await event_bus.publish("log_received", log_event, incident_id=inc_id)

    return {"ok": True, "message": "Log ingested and broadcast", "data": log_event}
