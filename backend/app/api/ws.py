"""WebSocket router for DevGuard real-time event streams.

Endpoints:
- `/ws/system`: Global command center event feed, service health changes,
  new incident alerts.
- `/ws/{incident_id}`: Incident-specific agent diagnostics, telemetry streams,
  and verification pipelines.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime.websocket_manager import rt_ws_manager, GLOBAL_CHANNEL

logger = logging.getLogger("devguard.api.ws")
router = APIRouter(tags=["ws"])


@router.websocket("/ws/system")
@router.websocket("/ws/global")
async def system_ws(websocket: WebSocket) -> None:
    await rt_ws_manager.connect(GLOBAL_CHANNEL, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        rt_ws_manager.disconnect(GLOBAL_CHANNEL, websocket)
    except Exception as e:
        logger.debug(f"system_ws closed: {e}")
        rt_ws_manager.disconnect(GLOBAL_CHANNEL, websocket)


@router.websocket("/ws/{incident_id}")
@router.websocket("/ws/incidents/{incident_id}")
async def incident_ws(websocket: WebSocket, incident_id: str) -> None:
    raw_id = str(incident_id).strip()
    if raw_id.lower() in ("system", "global"):
        chan_id = GLOBAL_CHANNEL
    elif raw_id.upper().startswith("INC-"):
        try:
            chan_id = int(raw_id.split("-")[-1])
        except ValueError:
            chan_id = raw_id
    else:
        try:
            chan_id = int(raw_id)
        except ValueError:
            chan_id = raw_id

    await rt_ws_manager.connect(chan_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        rt_ws_manager.disconnect(chan_id, websocket)
    except Exception as e:
        logger.debug(f"incident_ws {chan_id} closed: {e}")
        rt_ws_manager.disconnect(chan_id, websocket)
