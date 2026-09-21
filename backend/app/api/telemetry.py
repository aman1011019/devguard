"""Real-time telemetry ingestion and Prometheus integration endpoint for DevGuard."""
from __future__ import annotations

from datetime import datetime
import logging
from typing import Any, Dict, Optional
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Incident, Metric
from app.realtime.event_bus import event_bus

logger = logging.getLogger("devguard.telemetry")
router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

# In-memory tracking of recent telemetry ingestion
_LATEST_TELEMETRY: Optional[Dict[str, Any]] = None


class TelemetryIngestRequest(BaseModel):
    service: str = "checkout-api"
    timestamp: Optional[str] = None
    latency_ms: float
    error_rate: float
    request_rate: Optional[float] = 120.0
    db_queries: float
    db_latency_ms: Optional[float] = None
    incident_id: Optional[int] = None


@router.get("/source")
async def get_telemetry_source() -> Dict[str, Any]:
    """Determine the current telemetry source: LIVE PROMETHEUS, LIVE TELEMETRY, or DEMO ENGINE."""
    prom_url = getattr(settings, "prometheus_url", "")
    if prom_url:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{prom_url.rstrip('/')}/api/v1/status/buildinfo")
                if res.status_code == 200:
                    return {
                        "source": "LIVE PROMETHEUS",
                        "connected": True,
                        "url": prom_url,
                    }
        except Exception:
            pass

    if _LATEST_TELEMETRY is not None:
        return {
            "source": "LIVE TELEMETRY",
            "connected": True,
            "last_updated": _LATEST_TELEMETRY.get("timestamp"),
        }

    return {
        "source": "DEMO ENGINE",
        "connected": True,
        "detail": "Deterministic simulation telemetry",
    }


@router.post("")
@router.post("/")
async def ingest_telemetry(
    payload: TelemetryIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Ingest real telemetry metrics, store them, and broadcast metric_updated via WebSocket."""
    global _LATEST_TELEMETRY

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
        "request_rate": payload.request_rate or 120.0,
        "db_queries": payload.db_queries,
        "db_latency_ms": payload.db_latency_ms or (payload.latency_ms * 0.7),
        "incident_id": inc_id,
        "source": "LIVE TELEMETRY",
    }
    _LATEST_TELEMETRY = metric_event

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

    return {
        "ok": True,
        "message": "Telemetry ingested and broadcasted across WebSocket bus",
        "source": "LIVE TELEMETRY",
        "data": metric_event,
    }
