"""Reconnection and event catch-up endpoints.

Allows clients that were briefly disconnected or switched tabs to retrieve
missed events without losing any phase of the investigation or activity log.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query

from app.realtime.event_store import event_store

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events")
async def get_system_events(
    after: Optional[str] = Query(None, description="Last seen event_id (e.g. evt_000042)"),
    limit: int = Query(100, ge=1, le=500),
) -> List[Dict[str, Any]]:
    """Retrieve global system events occurred after the given event_id."""
    return event_store.get_events(incident_id=None, after_id=after, limit=limit)


@router.get("/incidents/{incident_id}/events")
async def get_incident_events(
    incident_id: str,
    after: Optional[str] = Query(None, description="Last seen event_id"),
    limit: int = Query(100, ge=1, le=500),
) -> List[Dict[str, Any]]:
    """Retrieve events for a specific incident occurred after the given event_id."""
    return event_store.get_events(incident_id=incident_id, after_id=after, limit=limit)
