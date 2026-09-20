"""Verification test script for real-time backend endpoints."""
from fastapi.testclient import TestClient
from main import app
from app.core.database import init_db

def test_all():
    init_db()
    with TestClient(app) as client:
        print("Testing /api/health...")
        res = client.get("/api/health")
        assert res.status_code == 200, res.text
        data = res.json()
        print("Health response:", data)
        assert data["version"] == "2.0.0"
        assert "websocket" in data
        assert "github" in data

        print("\nTesting /api/services...")
        res = client.get("/api/services")
        assert res.status_code == 200, res.text
        services = res.json()
        print(f"Retrieved {len(services)} services: {[s['name'] for s in services]}")
        assert len(services) >= 5

        print("\nTesting /api/search...")
        res = client.get("/api/search?q=checkout")
        assert res.status_code == 200, res.text
        search_res = res.json()
        print("Search results keys:", search_res["results"].keys())

        print("\nTesting /api/logs/ingest...")
        log_res = client.post("/api/logs/ingest", json={
            "service": "checkout-api",
            "level": "ERROR",
            "message": "Test connection timeout",
        })
        assert log_res.status_code == 200, log_res.text
        print("Log ingest OK:", log_res.json())

        print("\nTesting /api/telemetry...")
        telem_res = client.post("/api/telemetry", json={
            "service": "checkout-api",
            "latency_ms": 4800,
            "error_rate": 21.8,
            "db_queries": 25,
        })
        assert telem_res.status_code == 200, telem_res.text
        print("Telemetry ingest OK:", telem_res.json())

        print("\nTesting /api/events...")
        events_res = client.get("/api/events")
        assert events_res.status_code == 200, events_res.text
        events = events_res.json()
        print(f"Retrieved {len(events)} events from EventStore")
        assert len(events) >= 2
        assert "event_id" in events[-1]

        print("\nTesting /api/webhooks/github/test-fail...")
        wh_res = client.post("/api/webhooks/github/test-fail")
        assert wh_res.status_code == 200, wh_res.text
        print("Webhook failure simulation OK:", wh_res.json())

        print("\nALL REALTIME BACKEND ENDPOINTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all()
