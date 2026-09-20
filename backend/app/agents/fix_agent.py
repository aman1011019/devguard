"""Fix Agent — turns a root cause + source into a concrete, reviewable patch."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentType
from app.simulation import fixtures


class FixAgent(Agent):
    agent_type = AgentType.FIX_AGENT
    emoji = "🔧"
    label = "FIX AGENT"
    running_message = "Generating reviewable patch..."

    def build_fix(self) -> dict:
        """Deterministic patch for the N+1 root cause."""
        return {
            "file": fixtures.SOURCE_FILE,
            "language": "java",
            "risk": fixtures.FIX_RISK,
            "expected_impact": fixtures.FIX_EXPECTED_IMPACT,
            "summary": fixtures.FIX_SUMMARY,
            "explanation": self._enrich(
                system="You are a fix-generation agent. Explain the patch in 2 sentences.",
                user=fixtures.FIX_EXPLANATION,
                fallback=fixtures.FIX_EXPLANATION,
            ),
            "before_code": fixtures.BUGGY_METHOD,
            "after_code": fixtures.FIXED_METHOD,
            "diff": fixtures.FIX_DIFF,
        }

    def analyze(self, incident, db: Session) -> AgentResult:
        fix = self.build_fix()
        base = fixtures.AGENT_FINDINGS["fix_agent"]
        return AgentResult(
            finding=base["finding"],
            detail={**base["detail"], "fix": fix},
            confidence=base["confidence"],
            evidence_ids=[],
        )
