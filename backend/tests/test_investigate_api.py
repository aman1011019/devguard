"""Tests for DevGuard Canonical Investigation API endpoints and method matching."""
import pytest
from sqlalchemy import select

from app.core.database import session_scope
from app.models.models import Incident


@pytest.fixture
def test_incident(client):
    """Ensure at least one test incident exists in the DB."""
    with session_scope() as db:
        inc = db.scalars(select(Incident)).first()
        if not inc:
            inc = Incident(
                service="Test API",
                title="Test Incident",
                severity="HIGH",
                status="DETECTED",
                error_rate=1.0,
                latency_ms=200.0,
                requests_per_min="1.0K/min",
                db_queries_per_request=2,
                db_latency_ms=20.0,
                deployment_version="v1.0.0",
                recovery_version="v1.0.0-patched",
                root_cause_summary="Unit test incident",
                confidence=0.9,
            )
            db.add(inc)
            db.commit()
            db.refresh(inc)
        return inc.id


def test_post_investigate_canonical(client, test_incident):
    """Test valid POST /api/incidents/{id}/investigate request."""
    payload = {
        "investigation_type": "autonomous_swarm",
        "repository_id": 1,
        "repository": {
            "owner": "test-org",
            "name": "test-repo",
            "branch": "main",
            "commit_sha": "30d23d53e3f877c78ac6fbdd5e6076eb7b627e99",
        },
    }
    resp = client.post(f"/api/incidents/{test_incident}/investigate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "started"
    assert "investigation_id" in data
    assert data["incident_id"] == test_incident


def test_investigation_types_supported(client, test_incident):
    """Ensure all 4 supported investigation types work."""
    for inv_type in ["autonomous_swarm", "regression", "performance", "cicd"]:
        payload = {"investigation_type": inv_type}
        resp = client.post(f"/api/incidents/{test_incident}/investigate", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["status"] == "started"


def test_invalid_investigation_type(client, test_incident):
    """Invalid investigation type must be rejected with 400 Bad Request."""
    payload = {"investigation_type": "unknown_bad_type"}
    resp = client.post(f"/api/incidents/{test_incident}/investigate", json=payload)
    assert resp.status_code == 400
    data = resp.json()
    assert "Supported" in str(data)


def test_investigate_missing_incident(client):
    """Missing incident returns 404."""
    resp = client.post("/api/incidents/9999999/investigate", json={"investigation_type": "autonomous_swarm"})
    assert resp.status_code == 404


def test_investigate_wrong_method_get_returns_405(client, test_incident):
    """GET /api/incidents/{id}/investigate must return 405 Method Not Allowed with standard error JSON."""
    resp = client.get(f"/api/incidents/{test_incident}/investigate")
    assert resp.status_code == 405
    data = resp.json()
    assert data["success"] is False
    assert data["error"]["code"] == "METHOD_NOT_ALLOWED"
    assert "Expected POST" in data["error"]["details"] or "Expected POST" in data["error"]["message"]


def test_standalone_investigate_endpoint(client, test_incident):
    """POST /api/incidents/investigate works cleanly."""
    payload = {
        "investigation_type": "regression",
        "repository": {
            "owner": "test-owner",
            "name": "test-app",
            "branch": "main",
        },
    }
    resp = client.post("/api/incidents/investigate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "started"
