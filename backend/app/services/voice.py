"""Voice command interpretation.

Maps a natural-language command (from browser speech recognition or the text
fallback) to a structured intent + a spoken response. Deterministic, works
fully offline.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ACTIVE_STATUSES
from app.models.models import Incident


def _latest_active(db: Session) -> Incident | None:
    statuses = [s.value for s in ACTIVE_STATUSES]
    return db.scalars(
        select(Incident).where(Incident.status.in_(statuses)).order_by(Incident.detected_at.desc())
    ).first()


def interpret(command: str, db: Session) -> dict:
    text = (command or "").lower().strip()
    active = _latest_active(db)
    inc_id = active.id if active else None
    service = active.service if active else "Checkout API"

    def r(intent: str, response: str, action: str | None = None, incident_id: int | None = inc_id) -> dict:
        return {"intent": intent, "incident_id": incident_id, "response": response, "action": action}

    if any(w in text for w in ("simulate", "break", "trigger", "inject")):
        return r("simulate_incident", "Simulating a production incident on the Checkout API now.",
                 action="simulate", incident_id=None)

    if any(w in text for w in ("investigate", "look into", "diagnose", "what happened", "why")):
        if inc_id:
            return r("investigate_incident",
                     f"Starting investigation of {service} incident #{inc_id}.", action="investigate")
        return r("investigate_incident", "There are no active incidents to investigate right now.",
                 action=None, incident_id=None)

    if any(w in text for w in ("generate fix", "fix", "patch", "repair")):
        return r("generate_fix", "Generating a proposed fix for review.", action="generate_fix")

    if any(w in text for w in ("approve", "accept", "apply")):
        return r("approve_fix", "Please confirm approval on screen — I never deploy without a human.",
                 action="approve_fix")

    if any(w in text for w in ("test", "verify", "run tests")):
        return r("run_tests", "Running the verification suite against the proposed fix.", action="run_tests")

    if any(w in text for w in ("status", "health", "how are", "everything ok")):
        if inc_id:
            return r("system_status",
                     f"There is an active {active.severity} incident on {service}, incident #{inc_id}.")
        return r("system_status", "All systems are healthy. No active incidents.", incident_id=None)

    if any(w in text for w in ("report", "summary", "summarise", "summarize")):
        return r("view_report", "Opening the investigation report.", action="view_report")

    return r(
        "unknown",
        "I can simulate an incident, investigate, generate a fix, run tests, or report status. "
        "Try: \"DevGuard, investigate the checkout failure.\"",
        action=None,
    )
