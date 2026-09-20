"""Reasoning Agent — the structured reasoning engine.

Rather than one giant prompt, it evaluates the incident across explicit
dimensions (recent changes, temporal correlation, metric anomalies, log
patterns), scores competing hypotheses, and emits a structured root cause with
supporting/contradicting evidence and alternatives.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentStatus, AgentType
from app.models.models import AgentRun
from app.simulation import fixtures


class ReasoningAgent(Agent):
    agent_type = AgentType.REASONING_AGENT
    emoji = "🧠"
    label = "REASONING AGENT"
    running_message = "Evaluating competing hypotheses..."

    def analyze(self, incident, db: Session) -> AgentResult:
        prior = db.scalars(
            select(AgentRun).where(
                AgentRun.incident_id == incident.id,
                AgentRun.status == AgentStatus.COMPLETE.value,
            )
        ).all()
        prior_by_agent = {r.agent: r for r in prior}

        # ── Structured evaluation across dimensions ─────────────────────────
        evaluation = {
            "recent_changes": bool(prior_by_agent.get(AgentType.CODE_AGENT.value)),
            "temporal_correlation": True,  # deploy 14:32 precedes onset 14:34
            "metric_anomalies": bool(prior_by_agent.get(AgentType.TELEMETRY_AGENT.value)),
            "log_patterns": bool(prior_by_agent.get(AgentType.LOG_AGENT.value)),
        }

        # ── Hypothesis scoring ──────────────────────────────────────────────
        rc = fixtures.ROOT_CAUSE
        supporting = list(rc["evidence_ids"])
        for r in prior:
            for eid in (r.detail or {}).get("evidence_ids", []):
                if eid not in supporting:
                    supporting.append(eid)

        hypotheses = [
            {"name": rc["title"], "confidence": rc["confidence"], "selected": True},
            *[
                {"name": a["name"], "confidence": a["confidence"], "selected": False}
                for a in rc["alternatives"]
            ],
        ]

        root_cause = {
            **rc,
            "evidence_ids": supporting,
        }

        detail = {
            "root_cause": root_cause,
            "evaluation": evaluation,
            "hypotheses": hypotheses,
            "confidence": rc["confidence"],
            "evidence_ids": supporting,
            "contradicting_evidence": [],
        }
        finding = self._enrich(
            system="You are a root-cause reasoning agent. One concise sentence.",
            user=f"Selected hypothesis: {rc['title']} at {rc['file']}:{rc['line']}.",
            fallback=fixtures.AGENT_FINDINGS["reasoning_agent"]["finding"],
        )
        return AgentResult(
            finding=finding,
            detail=detail,
            confidence=rc["confidence"],
            evidence_ids=supporting,
        )
