from pathlib import Path
from fastapi.testclient import TestClient

from app.services.codebase_scanner import scan_directory


def test_codebase_scanner_on_demo_service():
    demo_dir = Path(__file__).resolve().parents[2] / "demo" / "checkout-service"
    assert demo_dir.exists()

    result = scan_directory(demo_dir)
    assert result.total_files >= 1
    assert result.health_score < 100
    # Should detect N+1 in OrderService.java
    nplus1_issues = [i for i in result.issues if i.category == "Database Performance"]
    assert len(nplus1_issues) >= 1
    assert any("OrderService.java" in i.file for i in nplus1_issues)
    assert any(i.patch_diff is not None for i in nplus1_issues)


def test_codebase_scan_local_api(client: TestClient):
    demo_dir = str(Path(__file__).resolve().parents[2] / "demo" / "checkout-service")
    r = client.post("/api/codebase/scan-local", json={"path": demo_dir})
    assert r.status_code == 200
    data = r.json()
    assert "scan_id" in data
    assert data["total_files"] >= 1
    assert len(data["issues"]) >= 1

    scan_id = data["scan_id"]
    r_get = client.get(f"/api/codebase/scans/{scan_id}")
    assert r_get.status_code == 200
    assert r_get.json()["scan_id"] == scan_id
