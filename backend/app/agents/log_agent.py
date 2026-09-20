"""Log Agent — mines application logs for error/timeout patterns."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentType
from app.models.models import LogEntry
from app.simulation import fixtures


class LogAgent(Agent):
    agent_type = AgentType.LOG_AGENT
    emoji = "🔍"
    label = "LOG AGENT"
    running_message = "Mining application logs..."

    def analyze(self, incident, db: Session) -> AgentResult:
        logs = db.scalars(
            select(LogEntry).where(LogEntry.incident_id == incident.id)
        ).all()
        errors = [l for l in logs if l.level == "ERROR"]
        timeouts = [l for l in logs if "timeout" in l.message.lower()]

        base = fixtures.AGENT_FINDINGS["log_agent"]
        detail = dict(base["detail"])
        detail["error_entries"] = len(errors)
        detail["timeout_entries"] = len(timeouts)
        # `relevant_entries` represents the full backing log store (37), while
        # the incident view surfaces the most relevant slice.
        finding = self._enrich(
            system="You are a log-analysis agent. One concise sentence.",
            user=f"Errors seen: {[l.message for l in errors][:6]}",
            fallback=base["finding"],
        )
        return AgentResult(
            finding=finding,
            detail=detail,
            confidence=base["confidence"],
            evidence_ids=detail.get("evidence_ids", []),
        )
