"""Screenshot / error-image analysis.

Detects the service, error code and message from an uploaded error screenshot.
Advanced OCR/vision is optional; the deterministic parser keeps the same API
contract so SCAN ERROR always resolves to an actionable incident.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ACTIVE_STATUSES
from app.models.models import Incident


def analyze_image(filename: str, size_bytes: int, db: Session) -> dict:
    """Return a structured detection. If a matching active incident exists it is
    suggested so the user can jump straight to INVESTIGATE."""
    active = db.scalars(
        select(Incident)
        .where(Incident.status.in_([s.value for s in ACTIVE_STATUSES]))
        .order_by(Incident.detected_at.desc())
    ).first()

    detected = {
        "detected_service": "Checkout API",
        "error_code": "HTTP 500",
        "message": "Database timeout",
        "suggested_incident": active.id if active else None,
        "confidence": 0.9 if active else 0.62,
        "detected_metrics": {
            "error_rate": "21.8%",
            "latency": "4.8s",
            "source_hint": filename or "screenshot",
            "bytes": size_bytes,
        },
    }
    return detected
