"""WebSocket connection manager.

Channels are keyed by incident id. Channel ``0`` is a global channel the
dashboard subscribes to for incident-detected notifications.

Every broadcast is also appended to a per-channel history buffer so a client
that connects mid-investigation immediately receives the events it missed.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

GLOBAL_CHANNEL = 0


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._history: dict[int, list[dict[str, Any]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def connect(self, channel: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[channel].add(ws)
        # Replay history so late subscribers see the full investigation.
        for event in list(self._history.get(channel, [])):
            try:
                await ws.send_json(event)
            except Exception:
                break

    def disconnect(self, channel: int, ws: WebSocket) -> None:
        conns = self._connections.get(channel)
        if conns and ws in conns:
            conns.discard(ws)

    async def broadcast(self, channel: int, message: dict[str, Any]) -> None:
        # Guarantee both 'event' and 'type' keys exist for all consumers
        ev_type = message.get("event") or message.get("type") or "event"
        message["event"] = ev_type
        message["type"] = ev_type
        self._history[channel].append(message)
        # Keep history bounded.
        if len(self._history[channel]) > 200:
            self._history[channel] = self._history[channel][-200:]

        dead: list[WebSocket] = []
        for ws in list(self._connections.get(channel, set())):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel, ws)

    async def broadcast_global(self, message: dict[str, Any]) -> None:
        await self.broadcast(GLOBAL_CHANNEL, message)

    def clear_history(self, channel: int) -> None:
        self._history.pop(channel, None)


ws_manager = WebSocketManager()
