"""Real-time WebSocket connection manager for DevGuard.

Supports:
- Global system channel (`/ws/system` or channel 0) for command center alerts,
  service health updates, and live event streams.
- Incident-specific channels (`/ws/{incident_id}`) for streaming agent diagnostics,
  metrics, and verification test suites.
- Automatic integration with the EventBus.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket

from app.realtime.event_bus import event_bus
from app.realtime.event_store import event_store

logger = logging.getLogger("devguard.realtime.websocket_manager")

GLOBAL_CHANNEL = 0


class RealtimeWebSocketManager:
    def __init__(self) -> None:
        # Channels: 0 = global, others = incident_id
        self._connections: Dict[Any, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()
        # Wire EventBus to automatically broadcast incoming events
        event_bus.subscribe(self.handle_event)

    def _normalize_channel(self, channel: Any) -> Any:
        if channel in (0, "0", "system", "global", None):
            return GLOBAL_CHANNEL
        raw = str(channel).strip()
        if raw.upper().startswith("INC-"):
            try:
                return int(raw.split("-")[-1])
            except ValueError:
                return raw
        try:
            return int(raw)
        except ValueError:
            return raw

    async def connect(self, raw_channel: Any, ws: WebSocket) -> None:
        await ws.accept()
        channel = self._normalize_channel(raw_channel)
        async with self._lock:
            self._connections[channel].add(ws)

        # Catch up newly connected client with recent events
        if channel == GLOBAL_CHANNEL:
            recent = event_store.get_recent_activity(limit=40)
        else:
            recent = event_store.get_events(incident_id=channel, limit=100)

        for ev in recent:
            try:
                await ws.send_json(ev)
            except Exception:
                break

    def disconnect(self, raw_channel: Any, ws: WebSocket) -> None:
        channel = self._normalize_channel(raw_channel)
        conns = self._connections.get(channel)
        if conns and ws in conns:
            conns.discard(ws)

    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Invoked by EventBus whenever an event is published."""
        inc_id = event.get("incident_id")
        # Broadcast to incident channel if present
        if inc_id is not None:
            norm_inc = self._normalize_channel(inc_id)
            await self._send_to_channel(norm_inc, event)

        # Always broadcast to the global system channel so Command Center updates
        await self._send_to_channel(GLOBAL_CHANNEL, event)

    async def _send_to_channel(self, channel: Any, message: Dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        conns = list(self._connections.get(channel, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(channel, ws)

    async def broadcast_system(self, message: Dict[str, Any]) -> None:
        await self._send_to_channel(GLOBAL_CHANNEL, message)


rt_ws_manager = RealtimeWebSocketManager()
