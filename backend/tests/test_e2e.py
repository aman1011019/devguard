"""End-to-end incident lifecycle test (the required E2E test).

Drives the full flagship flow through the public API exactly as the frontend
does: BREAK -> INVESTIGATE -> EXPLAIN -> (human approval) -> VERIFY -> RECOVER,
asserting the golden root cause and the recovered metrics.
"""
import time

import pytest


def _wait(client, url, predicate, timeout=10.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = client.get(url)
        if last.status_code == 200 and predicate(last.json()):
            return last.json()
        time.sleep(0.05)
    raise AssertionError(
        f"timed out waiting on {url} (last status {last.status_code if last else '-'})"
    )


def test_full_incident_lifecycle(client):
    # BREAK ────────────────────────────────────────────────────────────────
    r = client.post("/api/demo/inject-incident")
    assert r.status_code == 200
    inc = r.json()
    iid = inc["id"]
    assert inc["latency_ms"] == 4800.0
    assert inc["error_rate"] == 21.8
    assert inc["db_queries_per_request"] == 25

    # INVESTIGATE ───────────────────────────────────────────────────────────
    assert client.post(f"/api/incidents/{iid}/investigate").status_code == 200
    inv = _wait(
        client,
        f"/api/incidents/{iid}/investigation",
        lambda d: d.get("root_cause") is not None and d.get("fix") is not None,
    )
    assert len(inv["agents"]) == 5

    # EXPLAIN ───────────────────────────────────────────────────────────────
    rc = inv["root_cause"]
    assert rc["title"] == "N+1 Database Query"
    assert rc["file"] == "OrderService.java"
    assert rc["line"] == 184
    assert abs(rc["confidence"] - 0.94) < 1e-6

    # Human-approval gate: verification cannot run before approval.
    assert client.post(f"/api/incidents/{iid}/run-tests").status_code == 409

    # FIX + approve ─────────────────────────────────────────────────────────
    r = client.post(f"/api/incidents/{iid}/approve-fix")
    assert r.status_code == 200
    assert r.json()["status"] == "TESTING"

    # VERIFY ────────────────────────────────────────────────────────────────
    assert client.post(f"/api/incidents/{iid}/run-tests").status_code == 200
    final = _wait(
        client,
        f"/api/incidents/{iid}",
        lambda d: d["status"] in ("RESOLVED", "FAILED"),
    )

    # RECOVER ───────────────────────────────────────────────────────────────
    assert final["status"] == "RESOLVED"
    assert final["latency_ms"] == 210.0
    assert final["error_rate"] == 0.8
    assert final["db_queries_per_request"] == 3
    assert final["duration_seconds"] == 402

    tests = client.get(f"/api/incidents/{iid}/tests").json()
    assert tests["status"] == "PASSED"
    assert tests["total_passed"] == 44
    assert tests["total"] == 44

    # Report renders.
    rep = client.get(f"/api/incidents/{iid}/report.html")
    assert rep.status_code == 200
    assert "DEVGUARD" in rep.text.upper()


def test_evidence_and_graph(client):
    r = client.post("/api/demo/inject-incident")
    iid = r.json()["id"]
    ev = client.get(f"/api/incidents/{iid}/evidence").json()
    assert len(ev["items"]) == 8
    assert len(ev["graph"]["nodes"]) == 7
    assert len(ev["graph"]["edges"]) == 6


def test_reset_returns_to_healthy(client):
    client.post("/api/demo/inject-incident")
    r = client.post("/api/demo/reset")
    assert r.status_code == 200
    assert r.json()["status"] == "HEALTHY"
    # No active incident remains.
    assert client.get("/api/incidents/active").json() is None
