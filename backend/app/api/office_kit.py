"""Office Kit bridge endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.office_kit.bridge import bridge
from app.schemas.schemas import OfficeKitStatus, OfficeKitSyncResponse

router = APIRouter(prefix="/api/office-kit", tags=["office-kit"])


class OfficeKitSyncRequest(BaseModel):
    action: str
    payload: dict = {}


@router.get("/status", response_model=OfficeKitStatus)
def office_kit_status() -> OfficeKitStatus:
    return OfficeKitStatus(**bridge.status())


@router.post("/sync", response_model=OfficeKitSyncResponse)
def office_kit_sync(req: OfficeKitSyncRequest) -> OfficeKitSyncResponse:
    return OfficeKitSyncResponse(**bridge.sync(req.action, req.payload))
