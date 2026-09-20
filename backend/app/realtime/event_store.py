"""In-memory and persistent event store for catch-up and replay.

Tracks all events with their sequential event_id, allowing clients
reconnecting over WebSocket to fetch missed events via:
    GET /api/incidents/{id}/events?after=<last_event_id>
    GET /api/events?after=<last_event_id>
"""
from __future__ import annotations

from collections import deque
import logging
from typing import Any, Dict, List, Optional

from app.realtime.event_bus import event_bus

logger = logging.getLogger("devguard.realtime.event_store")


class EventStore:
    def __init__(self, max_capacity: int = 1500) -> None:
        self._max_capacity = max_capacity
        self._events: deque[Dict[str, Any]] = deque(maxlen=max_capacity)
        # Register self with the global event bus
        event_bus.subscribe(self.record)

    def record(self, event: Dict[str, Any]) -> None:
        self._events.append(event)

    def get_events(
        self,
        incident_id: Optional[Any] = None,
        after_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        all_events = list(self._events)
        
        # Filter by after_id if specified
        if after_id:
            found_idx = -1
            for idx, ev in enumerate(all_events):
                if ev.get("event_id") == after_id:
                    found_idx = idx
                    break
            if found_idx != -1:
                all_events = all_events[found_idx + 1 :]

        # Filter by incident_id if specified
        if incident_id is not None:
            raw_target = str(incident_id).strip().upper()
            if raw_target.startswith("INC-"):
                try:
                    num_target = int(raw_target.split("-")[-1])
                except ValueError:
                    num_target = None
            else:
                try:
                    num_target = int(raw_target)
                except ValueError:
                    num_target = None

            def matches(ev: Dict[str, Any]) -> bool:
                ev_inc = ev.get("incident_id")
                if ev_inc is None:
                    return False
                if str(ev_inc).strip().upper() == raw_target:
                    return True
                if num_target is not None:
                    try:
                        return int(str(ev_inc).split("-")[-1]) == num_target
                    except (ValueError, TypeError):
                        return False
                return False

            all_events = [ev for ev in all_events if matches(ev)]

        return all_events[-limit:] if limit > 0 else all_events

    def get_recent_activity(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return the most recent events across the whole system."""
        return list(self._events)[-limit:]


event_store = EventStore()
