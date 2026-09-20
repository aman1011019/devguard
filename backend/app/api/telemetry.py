"""Real-time telemetry ingestion endpoint for DevGuard."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Incident, Metric
from app.realtime.event_bus import event_bus

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


class TelemetryIngestRequest(BaseModel):
    service: str = "checkout-api"
    timestamp: Optional[str] = None
    latency_ms: float
    error_rate: float
    db_queries: float
    db_latency_ms: Optional[float] = None
    incident_id: Optional[int] = None


@router.post("")
@router.post("/")
async def ingest_telemetry(
    payload: TelemetryIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    inc_id = payload.incident_id
    if inc_id is None:
        active_inc = db.scalars(
            select(Incident).where(Incident.status != "RESOLVED").order_by(Incident.id.desc())
        ).first()
        if active_inc:
            inc_id = active_inc.id

    ts = payload.timestamp or datetime.utcnow().strftime("%H:%M:%S")

    incident = db.get(Incident, inc_id) if inc_id else None
    if incident:
        incident.latency_ms = payload.latency_ms
        incident.error_rate = payload.error_rate
        incident.db_queries_per_request = int(payload.db_queries)
        if payload.db_latency_ms:
            incident.db_latency_ms = payload.db_latency_ms

        # Record metric point
        count = len(incident.metrics)
        m = Metric(
            incident_id=incident.id,
            t=count + 1,
            label=ts,
            phase="after" if incident.status == "RESOLVED" else "before",
            latency_ms=payload.latency_ms,
            error_rate=payload.error_rate,
            db_queries=payload.db_queries,
            db_latency_ms=payload.db_latency_ms or (payload.latency_ms * 0.7),
        )
        db.add(m)
        db.commit()

    metric_event = {
        "service": payload.service,
        "timestamp": ts,
        "latency_ms": payload.latency_ms,
        "error_rate": payload.error_rate,
        "db_queries": payload.db_queries,
        "incident_id": inc_id,
    }
    await event_bus.publish("metric_updated", metric_event, incident_id=inc_id)

    # Check for recovery thresholds
    if payload.latency_ms <= 300 and payload.error_rate <= 2.0 and payload.db_queries <= 5:
        await event_bus.publish(
            "service_healthy",
            {
                "service": payload.service,
                "latency_ms": payload.latency_ms,
                "error_rate": payload.error_rate,
                "incident_id": inc_id,
                "status": "HEALTHY",
            },
            incident_id=inc_id,
        )

    return {"ok": True, "message": "Telemetry processed and broadcast", "data": metric_event}
