"""WebSocket endpoint for the live investigation event stream.

Clients subscribe per incident id. Channel ``0`` is the global dashboard
channel that receives incident-detected / system-reset notifications. On
connect the manager replays buffered history so a late subscriber still sees
the whole investigation animate.
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import ws_manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/{incident_id}")
@router.websocket("/ws/incidents/{incident_id}")
async def incident_ws(websocket: WebSocket, incident_id: str) -> None:
    try:
        raw_id = str(incident_id).strip()
        if raw_id.upper().startswith("INC-"):
            chan_id = int(raw_id.split("-")[-1])
        else:
            chan_id = int(raw_id)
    except (ValueError, TypeError):
        chan_id = 0
    await ws_manager.connect(chan_id, websocket)
    try:
        while True:
            # We don't require inbound messages; receiving keeps the socket
            # open and lets us detect disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(chan_id, websocket)
    except Exception:  # pragma: no cover - defensive cleanup
        ws_manager.disconnect(chan_id, websocket)
