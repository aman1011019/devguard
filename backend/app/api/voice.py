"""Voice command endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.schemas import VoiceCommandRequest, VoiceCommandResponse
from app.services.voice import interpret

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/command", response_model=VoiceCommandResponse)
def voice_command(payload: VoiceCommandRequest, db: Session = Depends(get_db)) -> VoiceCommandResponse:
    return VoiceCommandResponse(**interpret(payload.command, db))
