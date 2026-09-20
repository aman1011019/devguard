"""Code Agent — correlates the incident with recent Git history / diffs."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentType, EvidenceType
from app.models.models import Deployment, Evidence
from app.simulation import fixtures


class CodeAgent(Agent):
    agent_type = AgentType.CODE_AGENT
    emoji = "💻"
    label = "CODE AGENT"
    running_message = "Correlating recent deployment..."

    def analyze(self, incident, db: Session) -> AgentResult:
        # The most recent deployment before the incident is the prime suspect.
        latest_deploy = db.scalars(
            select(Deployment)
            .where(Deployment.incident_id == incident.id)
            .order_by(Deployment.timestamp.desc())
        ).first()
        git_evidence = db.scalars(
            select(Evidence).where(
                Evidence.incident_id == incident.id,
                Evidence.type == EvidenceType.GIT.value,
            )
        ).first()

        base = fixtures.AGENT_FINDINGS["code_agent"]
        detail = dict(base["detail"])
        if latest_deploy:
            detail["commit"] = latest_deploy.commit_sha
            detail["deployment"] = latest_deploy.version
            detail["author"] = latest_deploy.author
        if git_evidence:
            detail["evidence_ids"] = [git_evidence.key]

        finding = self._enrich(
            system="You are a code-change analysis agent. One concise sentence.",
            user=f"Suspicious change in {detail['file']}:{detail['line']} (deploy {detail.get('deployment')}).",
            fallback=base["finding"],
        )
        return AgentResult(
            finding=finding,
            detail=detail,
            confidence=base["confidence"],
            evidence_ids=detail.get("evidence_ids", []),
        )
