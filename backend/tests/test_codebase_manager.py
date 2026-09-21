import io
import zipfile
from fastapi.testclient import TestClient


def test_active_codebase_api(client: TestClient):
    r = client.get("/api/codebase/active")
    assert r.status_code == 200
    data = r.json()
    assert "repository" in data
    assert "health_score" in data
    assert "total_files" in data


def test_scan_local_workspace(client: TestClient):
    r = client.post("/api/codebase/scan-local", json={})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "codebase" in data
    assert data["codebase"]["total_files"] >= 1
    assert "incidents" in data


def test_upload_zip_codebase(client: TestClient):
    # Create in-memory test zip containing a sample buggy file
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        sample_code = (
            "public class SampleService {\n"
            "    public void run(List<Item> items) {\n"
            "        for (Item item : items) {\n"
            "            repository.fetch(item.getId());\n"
            "        }\n"
            "    }\n"
            "}\n"
        )
        zf.writestr("my-service/src/SampleService.java", sample_code)

    zip_buffer.seek(0)
    files = {"file": ("my-service.zip", zip_buffer, "application/zip")}
    r = client.post("/api/codebase/upload-zip", files=files)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["codebase"]["type"] == "zip"
    assert data["codebase"]["total_files"] == 1


def test_patch_download_and_apply(client: TestClient):
    # Trigger local scan to create an incident with patch
    r_scan = client.post("/api/codebase/scan-local", json={})
    assert r_scan.status_code == 200
    data = r_scan.json()
    incidents = data.get("incidents", [])

    if incidents:
        target_inc = incidents[0]
        inc_id = target_inc["id"]

        # Check patch download
        if target_inc.get("patch_available"):
            r_patch = client.get(f"/api/incidents/{inc_id}/patch")
            assert r_patch.status_code == 200
            assert len(r_patch.text) > 0

        # Check patch application
        r_apply = client.post(f"/api/incidents/{inc_id}/apply-patch")
        assert r_apply.status_code == 200
        assert r_apply.json()["ok"] is True
