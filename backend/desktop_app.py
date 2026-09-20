"""DevGuard Desktop Application Entrypoint.

Runs FastAPI backend on an internal localhost port and embeds it
in a native Windows desktop GUI window powered by pywebview.
Also supports headless/server mode with `--headless` or `--server-only`,
as well as a direct CLI scan with `--scan <path>`.
"""
from __future__ import annotations

import argparse
import logging
import os
import socket
import sys
import threading
import time
from pathlib import Path

# Ensure backend root is on sys.path
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("devguard.desktop")


def find_free_port(preferred: int = 8000) -> int:
    """Check if preferred port is open, otherwise find an available free port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_server(host: str, port: int, timeout: float = 12.0) -> bool:
    """Poll the API health endpoint until server is responsive."""
    import urllib.request
    url = f"http://{host}:{port}/api/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DevGuard-Desktop"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.2)
    return False


class DesktopAPI:
    """Python API methods exposed to JavaScript in pywebview via window.pywebview.api."""

    def __init__(self, window_holder: list, port: int):
        self._window_holder = window_holder
        self.port = port

    def get_info(self) -> dict:
        return {
            "app": "DevGuard",
            "version": "1.0.0",
            "is_desktop": True,
            "port": self.port,
        }

    def select_folder(self) -> str | None:
        """Open native Windows directory picker and return chosen path."""
        try:
            import webview
            if self._window_holder and self._window_holder[0]:
                win = self._window_holder[0]
                result = win.create_file_dialog(webview.FOLDER_DIALOG)
                if result and len(result) > 0:
                    return result[0]
        except Exception as exc:
            logger.error("Error opening folder dialog: %s", exc)
        return None


def run_cli_scan(path: str):
    """Perform a standalone scan on the command line without opening GUI."""
    print("=" * 60)
    print(" DevGuard Autonomous Codebase Scanner (CLI Mode)")
    print("=" * 60)
    p = Path(path).resolve()
    if not p.exists():
        print(f"[!] Error: Directory does not exist: {p}")
        sys.exit(1)

    print(f"[*] Target Directory: {p}")
    from app.services.codebase_scanner import scan_directory
    res = scan_directory(p)
    print(f"[*] Scan Complete:")
    print(f"    - Health Score:  {res.health_score}/100")
    print(f"    - Files Scanned: {res.total_files} ({res.total_lines} lines)")
    print(f"    - Total Issues:  {len(res.issues)} (Summary: {res.summary})")
    print("-" * 60)
    for idx, issue in enumerate(res.issues, 1):
        print(f"\n[{idx}] [{issue.severity.upper()}] {issue.title}")
        print(f"    File:        {issue.file}:{issue.line}")
        print(f"    Category:    {issue.category}")
        print(f"    Explanation: {issue.explanation}")
        print(f"    Solution:    {issue.recommendation}")
        if issue.patch_diff:
            print("    Diff Patch Preview:")
            for line in issue.patch_diff.splitlines()[:6]:
                print(f"      {line}")
            if len(issue.patch_diff.splitlines()) > 6:
                print("      ...")
    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="DevGuard - AI Production Incident Investigator & Codebase Scanner")
    parser.add_argument("--host", default="127.0.0.1", help="Host address to bind backend server")
    parser.add_argument("--port", type=int, default=None, help="Port to bind backend server (default: 8000 or next free)")
    parser.add_argument("--headless", "--server-only", dest="headless", action="store_true", help="Run backend API only without opening GUI window")
    parser.add_argument("--scan", type=str, default=None, help="Scan a local folder via CLI and exit")
    args = parser.parse_args()

    if args.scan:
        run_cli_scan(args.scan)
        return

    port = args.port or find_free_port(8000)
    host = args.host

    logger.info("Starting DevGuard internal server on http://%s:%s", host, port)

    from main import app

    server_config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(server_config)

    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    logger.info("Waiting for DevGuard backend to become ready...")
    if not wait_for_server(host, port, timeout=15.0):
        logger.error("Failed to start internal backend server in time.")
        sys.exit(1)

    url = f"http://{host}:{port}/"
    logger.info("DevGuard server is live at %s", url)

    if args.headless:
        print(f"[*] DevGuard running in headless/server mode at {url}")
        print("[*] Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down DevGuard...")
            server.should_exit = True
            return

    try:
        import webview
    except ImportError:
        logger.error("pywebview is not installed. Running in browser mode.")
        import webbrowser
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            server.should_exit = True
            return

    window_holder = [None]
    api = DesktopAPI(window_holder, port)

    window = webview.create_window(
        title="DevGuard · AI Production Incident Investigator & Codebase Scanner",
        url=url,
        width=1440,
        height=920,
        min_size=(1024, 640),
        js_api=api,
        text_select=True,
    )
    window_holder[0] = window

    # Start pywebview main event loop
    webview.start(debug=False)

    logger.info("Window closed. Stopping DevGuard backend...")
    server.should_exit = True


if __name__ == "__main__":
    main()
