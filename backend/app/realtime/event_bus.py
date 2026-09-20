"""Real-time EventBus for DevGuard.

Provides a unified asynchronous pub/sub event bus.
All investigation components, webhooks, and telemetry handlers publish events
through this bus. Every event is tagged with a sequential event_id, UTC timestamp,
and broadcast to connected WebSockets.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Callable, Dict, List, Optional
import uuid

logger = logging.getLogger("devguard.realtime.event_bus")


class EventBus:
    def __init__(self) -> None:
        self._seq: int = 0
        self._lock = asyncio.Lock()
        self._subscribers: List[Callable[[Dict[str, Any]], Any]] = []

    def next_event_id(self) -> str:
        self._seq += 1
        return f"evt_{self._seq:06d}"

    def subscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        if callback not in self._subscribers:
            self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Dict[str, Any]], Any]) -> None:
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    async def publish(
        self,
        event_type: str,
        payload: Optional[Dict[str, Any]] = None,
        incident_id: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Format an event with sequential ID and timestamp, then notify subscribers."""
        async with self._lock:
            event_id = self.next_event_id()

        ts = datetime.now(timezone.utc).isoformat()
        event_dict: Dict[str, Any] = {
            "event_id": event_id,
            "timestamp": ts,
            "event": event_type,
            "type": event_type,  # Dual-field compatibility
            "incident_id": incident_id,
        }
        if payload:
            event_dict.update(payload)

        # Notify internal subscribers (e.g. event store, websocket manager)
        for sub in list(self._subscribers):
            try:
                if asyncio.iscoroutinefunction(sub):
                    asyncio.create_task(sub(event_dict))
                else:
                    sub(event_dict)
            except Exception as e:
                logger.error(f"Error in EventBus subscriber callback: {e}", exc_info=True)

        return event_dict


event_bus = EventBus()
