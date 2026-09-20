"""End-to-end smoke test of the DevGuard demo flow against a live server.

Exercises: health -> inject -> WS subscribe -> investigate -> root cause ->
approve -> run tests -> resolved, verifying the golden values along the way.
"""
import asyncio
import json
import sys

import httpx
import websockets

BASE = "http://127.0.0.1:8010"
WS = "ws://127.0.0.1:8010"

OK = "\033[92mPASS\033[0m"
BAD = "\033[91mFAIL\033[0m"
failures = []


def check(label, cond, extra=""):
    print(f"  [{OK if cond else BAD}] {label} {extra}")
    if not cond:
        failures.append(label)


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # 1. Health
        r = await c.get(f"{BASE}/api/health")
        h = r.json()
        print("HEALTH:", json.dumps(h))
        check("health 200", r.status_code == 200)
        check("demo_mode on", h["demo_mode"] is True)
        check("12 services monitored", h["services_monitored"] == 12)

        # 2. Inject incident
        r = await c.post(f"{BASE}/api/demo/inject-incident")
        inc = r.json()
        iid = inc["id"]
        print(f"INJECTED incident #{iid} status={inc['status']}")
        check("inject 200", r.status_code == 200)
        check("broken latency 4800", inc["latency_ms"] == 4800.0, f"got {inc['latency_ms']}")
        check("broken error 21.8", inc["error_rate"] == 21.8, f"got {inc['error_rate']}")
        check("db queries 25", inc["db_queries_per_request"] == 25, f"got {inc['db_queries_per_request']}")
        check("has timeline", len(inc["timeline"]) >= 5)
        check("has deployments", len(inc["deployments"]) >= 3)

        # 3. Subscribe WS + investigate
        events = []
        async with websockets.connect(f"{WS}/ws/incidents/{iid}") as ws:
            await c.post(f"{BASE}/api/incidents/{iid}/investigate")
            try:
                while True:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                    events.append(msg)
                    if msg["type"] == "investigation_completed":
                        break
            except asyncio.TimeoutError:
                pass
        types = [e["type"] for e in events]
        print("INVESTIGATION events:", types)
        check("investigation_started", "investigation_started" in types)
        check("5 agent_started", types.count("agent_started") == 5, f"got {types.count('agent_started')}")
        check("5 agent_completed", types.count("agent_completed") == 5)
        check("root_cause_found emitted", "root_cause_found" in types)
        check("fix_generated emitted", "fix_generated" in types)
        check("investigation_completed", "investigation_completed" in types)
        rc_evt = next((e for e in events if e["type"] == "root_cause_found"), {})
        check("RC is N+1", "N+1" in rc_evt.get("root_cause", ""), rc_evt.get("root_cause", ""))
        check("RC line 184", rc_evt.get("line") == 184, f"got {rc_evt.get('line')}")
        check("RC confidence 0.96", abs(rc_evt.get("confidence", 0) - 0.96) < 1e-6, f"got {rc_evt.get('confidence')}")

        # 4. Investigation snapshot
        r = await c.get(f"{BASE}/api/incidents/{iid}/investigation")
        investigation = r.json()
        check("investigation agents=5", len(investigation["agents"]) == 5)
        check("root_cause present", investigation["root_cause"] is not None)
        check("root_cause file OrderService.java",
              investigation["root_cause"]["file"] == "OrderService.java")
        check("fix present", investigation["fix"] is not None)

        # 5. Root cause endpoint
        r = await c.get(f"{BASE}/api/incidents/{iid}/root-cause")
        rc = r.json()
        check("root-cause 200", r.status_code == 200)
        check("has 6 reasons", len(rc["reasons"]) == 6, f"got {len(rc['reasons'])}")
        golden_ev = {"git_4", "metric_7", "log_12", "trace_2", "db_1"}
        check("golden evidence_ids present", golden_ev.issubset(set(rc["evidence_ids"])),
              f"got {rc['evidence_ids']}")
        check("has alternatives", len(rc["alternatives"]) >= 2)

        # 6. Evidence + graph
        r = await c.get(f"{BASE}/api/incidents/{iid}/evidence")
        ev = r.json()
        check("evidence items=8", len(ev["items"]) == 8, f"got {len(ev['items'])}")
        check("graph nodes", len(ev["graph"]["nodes"]) == 7)
        check("graph edges", len(ev["graph"]["edges"]) == 6)

        # 7. Metrics + logs
        r = await c.get(f"{BASE}/api/incidents/{iid}/metrics")
        m = r.json()
        check("metrics points", len(m["points"]) >= 10, f"got {len(m['points'])}")
        r = await c.get(f"{BASE}/api/incidents/{iid}/logs")
        check("logs 12", len(r.json()) == 12, f"got {len(r.json())}")

        # 8. Fix
        r = await c.get(f"{BASE}/api/incidents/{iid}/fix")
        fix = r.json()
        check("fix file", fix["file"] == "OrderService.java")
        check("fix risk LOW", fix["risk"] == "LOW")
        check("fix status PROPOSED", fix["status"] == "PROPOSED")
        check("fix has diff", "fetchProductsByIds" in fix["diff"])

        # 9. Human-approval gate: run-tests BEFORE approve must 409
        r = await c.post(f"{BASE}/api/incidents/{iid}/run-tests")
        check("run-tests blocked pre-approval (409)", r.status_code == 409, f"got {r.status_code}")

        # 10. Approve + run tests
        r = await c.post(f"{BASE}/api/incidents/{iid}/approve-fix")
        check("approve 200", r.status_code == 200, r.text[:120])
        check("status TESTING after approve", r.json()["status"] == "TESTING")

        test_events = []
        async with websockets.connect(f"{WS}/ws/incidents/{iid}") as ws:
            await c.post(f"{BASE}/api/incidents/{iid}/run-tests")
            try:
                while True:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                    test_events.append(msg)
                    if msg["type"] in ("incident_resolved", "incident_failed"):
                        break
            except asyncio.TimeoutError:
                pass
        ttypes = [e["type"] for e in test_events]
        print("TEST events:", ttypes)
        check("test_started", "test_started" in ttypes)
        check("4 suites started", ttypes.count("test_suite_started") == 4)
        check("test_completed", "test_completed" in ttypes)
        check("incident_resolved", "incident_resolved" in ttypes)
        tc = next((e for e in test_events if e["type"] == "test_completed"), {})
        check("tests passed", tc.get("passed") is True)
        check("headline 44/44", tc.get("total_passed") == 44 and tc.get("total") == 44,
              f"got {tc.get('total_passed')}/{tc.get('total')}")

        # 11. Final state recovered
        r = await c.get(f"{BASE}/api/incidents/{iid}")
        final = r.json()
        print(f"FINAL status={final['status']} latency={final['latency_ms']} "
              f"error={final['error_rate']} dbq={final['db_queries_per_request']}")
        check("RESOLVED", final["status"] == "RESOLVED")
        check("recovered latency 210", final["latency_ms"] == 210.0, f"got {final['latency_ms']}")
        check("recovered error 0.8", final["error_rate"] == 0.8, f"got {final['error_rate']}")
        check("recovered dbq 3", final["db_queries_per_request"] == 3, f"got {final['db_queries_per_request']}")
        check("duration set", final["duration_seconds"] == 402, f"got {final['duration_seconds']}")

        # 12. Tests snapshot + report
        r = await c.get(f"{BASE}/api/incidents/{iid}/tests")
        check("tests snapshot PASSED", r.json()["status"] == "PASSED")
        r = await c.get(f"{BASE}/api/incidents/{iid}/report.html")
        check("report.html 200", r.status_code == 200 and "DEVGUARD" in r.text.upper())

        # 13. Voice + office-kit + image
        r = await c.post(f"{BASE}/api/voice/command", json={"command": "simulate an incident"})
        check("voice intent", r.json()["intent"] == "simulate_incident", r.json()["intent"])
        r = await c.get(f"{BASE}/api/office-kit/status")
        check("office-kit status", r.json()["connected"] is True)
        r = await c.post(f"{BASE}/api/incidents/analyze-image")
        check("analyze-image", r.json()["detected_service"] == "Checkout API")

        # 14. List + reset
        r = await c.get(f"{BASE}/api/incidents")
        check("list includes seeded history", len(r.json()) >= 3, f"got {len(r.json())}")
        r = await c.post(f"{BASE}/api/demo/reset")
        check("reset 200", r.status_code == 200 and r.json()["status"] == "HEALTHY")

    print()
    if failures:
        print(f"\033[91m{len(failures)} CHECK(S) FAILED:\033[0m", failures)
        sys.exit(1)
    print("\033[92mALL CHECKS PASSED\033[0m")


if __name__ == "__main__":
    asyncio.run(main())
