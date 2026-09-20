"""Health / meta endpoint tests."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    assert d["demo_mode"] is True
    assert d["services_monitored"] == 12
    assert d["ai_provider"]  # a label is always present


def test_agent_catalog(client):
    r = client.get("/api/meta/agents")
    assert r.status_code == 200
    catalog = r.json()
    assert len(catalog) == 5
    assert [a["agent"] for a in catalog] == [
        "log_agent",
        "code_agent",
        "telemetry_agent",
        "reasoning_agent",
        "fix_agent",
    ]


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["app"] == "DevGuard"
