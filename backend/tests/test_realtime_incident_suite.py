import hashlib
import hmac
import io
import json
import zipfile
from fastapi.testclient import TestClient

from app.core.config import settings
from app.integrations.github import parse_repo_identifier, GitHubError
from app.services.codebase_scanner import safe_extract_zip, ZipSecurityError


def test_parse_repo_identifier():
    assert parse_repo_identifier("octocat/Hello-World") == ("octocat", "Hello-World")
    assert parse_repo_identifier("https://github.com/torvalds/linux") == ("torvalds", "linux")
    assert parse_repo_identifier("git@github.com:facebook/react.git") == ("facebook", "react")


def test_zip_security_path_traversal(tmp_path):
    """Ensure safe_extract_zip rejects zip files containing directory traversal '../'."""
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("../../etc/passwd", "malicious_content")
    zip_buf.seek(0)

    dest = tmp_path / "extract_dest"
    dest.mkdir()

    try:
        safe_extract_zip(zip_buf.read(), dest)
        assert False, "Should have raised ZipSecurityError for path traversal"
    except ZipSecurityError as e:
        assert "traversal" in str(e).lower()


def test_zip_security_secrets_ignored(tmp_path):
    """Ensure sensitive files like .env and private keys are ignored during indexing."""
    from app.services.codebase_scanner import build_code_index

    proj_dir = tmp_path / "safe_proj"
    proj_dir.mkdir()
    (proj_dir / ".env").write_text("SECRET_KEY=supersecret", encoding="utf-8")
    (proj_dir / "id_rsa").write_text("PRIVATE KEY DATA", encoding="utf-8")
    (proj_dir / "app.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")

    index = build_code_index(proj_dir)
    file_paths = [f["path"] for f in index.get("files", [])]
    assert any("app.py" in p for p in file_paths)
    assert not any(".env" in p for p in file_paths)
    assert not any("id_rsa" in p for p in file_paths)


def test_webhook_hmac_verification(client: TestClient):
    """Test GitHub Actions workflow_run failure webhook with HMAC-SHA256 signature."""
    secret = settings.github_webhook_secret or "devguard-webhook-token"
    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 884422,
            "name": "CI",
            "conclusion": "failure",
            "head_branch": "main",
            "head_sha": "c0ffee1",
            "head_commit": {
                "message": "fix: race condition in checkout",
                "author": {"name": "Test Engineer"},
            },
            "html_url": "https://github.com/test-org/test-repo/actions/runs/884422",
        },
        "repository": {
            "full_name": "test-org/test-repo",
            "name": "test-repo",
        },
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    headers = {
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": sig,
        "Content-Type": "application/json",
    }
    r = client.post("/api/webhooks/github", data=body_bytes, headers=headers)
    assert r.status_code == 200
    res_data = r.json()
    assert res_data["ok"] is True
    assert "incident_id" in res_data
    assert res_data["conclusion"] == "failure"


def test_telemetry_ingestion_and_source(client: TestClient):
    """Test live telemetry ingestion and prometheus connectivity status."""
    # Ingest live telemetry first
    r_ingest = client.post(
        "/api/telemetry",
        json={
            "service": "checkout-api",
            "latency_ms": 1250,
            "error_rate": 4.5,
            "db_queries": 12,
            "request_rate": 840,
        },
    )
    assert r_ingest.status_code == 200
    assert r_ingest.json()["ok"] is True
    assert r_ingest.json()["source"] in ("LIVE TELEMETRY", "LIVE PROMETHEUS")

    # Source check after live telemetry is ingested
    r_src = client.get("/api/telemetry/source")
    assert r_src.status_code == 200
    src_data = r_src.json()
    assert "source" in src_data
    assert src_data["source"] in ("LIVE PROMETHEUS", "LIVE TELEMETRY")



def test_global_search_endpoint(client: TestClient):
    """Test global search across incidents, services, evidence, and code index."""
    r = client.get("/api/search?q=checkout")
    assert r.status_code == 200
    data = r.json()
    assert "results" in data
    assert "services" in data["results"]
    assert any("checkout" in s["id"].lower() for s in data["results"]["services"])
