"""Response serialization helpers (ordered relationships etc.)."""
from __future__ import annotations

from app.models.models import Incident
from app.schemas.schemas import (
    DeploymentOut,
    IncidentDetail,
    IncidentSummary,
    TimelineEventOut,
)


def to_summary(inc: Incident) -> IncidentSummary:
    return IncidentSummary.model_validate(inc)


def to_detail(inc: Incident) -> IncidentDetail:
    detail = IncidentDetail.model_validate(inc)
    detail.timeline = [
        TimelineEventOut.model_validate(t)
        for t in sorted(inc.timeline, key=lambda x: x.order_index)
    ]
    detail.deployments = [
        DeploymentOut.model_validate(d)
        for d in sorted(inc.deployments, key=lambda x: x.timestamp)
    ]
    return detail
