"""Telemetry Agent — detects anomalies and correlations in time-series metrics."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentType
from app.models.models import Metric
from app.simulation import fixtures


class TelemetryAgent(Agent):
    agent_type = AgentType.TELEMETRY_AGENT
    emoji = "📊"
    label = "TELEMETRY AGENT"
    running_message = "Analyzing service telemetry..."

    def analyze(self, incident, db: Session) -> AgentResult:
        points = db.scalars(
            select(Metric).where(Metric.incident_id == incident.id).order_by(Metric.t)
        ).all()

        base = fixtures.AGENT_FINDINGS["telemetry_agent"]
        detail = dict(base["detail"])

        if points:
            first, last = points[0], points[-1]
            # Real computed deltas from the persisted series (guards the fixture).
            if first.db_queries:
                detail["query_count_computed"] = (
                    f"+{round((last.db_queries - first.db_queries) / first.db_queries * 100)}%"
                )
            detail["peak_latency_ms"] = max(p.latency_ms for p in points)
            detail["peak_error_rate"] = max(p.error_rate for p in points)

        finding = self._enrich(
            system="You are a telemetry-correlation agent. One concise sentence.",
            user=f"Query count {detail['query_count']}, db latency {detail['db_latency']}, checkout latency {detail['checkout_latency']}.",
            fallback=base["finding"],
        )
        return AgentResult(
            finding=finding,
            detail=detail,
            confidence=base["confidence"],
            evidence_ids=detail.get("evidence_ids", []),
        )
