"""Investigation report — self-contained, printable HTML."""
from __future__ import annotations

import html

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import (
    AgentRun,
    Deployment,
    Evidence,
    Fix,
    Incident,
    RootCause,
    TestRun,
    TimelineEvent,
)
from app.simulation import fixtures


def _e(text) -> str:
    return html.escape(str(text if text is not None else ""))


def render_report_html(db: Session, incident_id: int) -> str | None:
    incident = db.get(Incident, incident_id)
    if incident is None:
        return None

    rc = db.scalars(select(RootCause).where(RootCause.incident_id == incident_id)).first()
    fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
    test_run = db.scalars(select(TestRun).where(TestRun.incident_id == incident_id)).first()
    agents = db.scalars(
        select(AgentRun).where(AgentRun.incident_id == incident_id).order_by(AgentRun.order_index)
    ).all()
    timeline = db.scalars(
        select(TimelineEvent).where(TimelineEvent.incident_id == incident_id).order_by(TimelineEvent.order_index)
    ).all()
    evidence = db.scalars(
        select(Evidence).where(Evidence.incident_id == incident_id).order_by(Evidence.relevance.desc())
    ).all()
    deployments = db.scalars(
        select(Deployment).where(Deployment.incident_id == incident_id).order_by(Deployment.timestamp)
    ).all()

    before = incident.metrics_before or fixtures.HEALTHY_METRICS
    after = incident.metrics_after or fixtures.RECOVERED_METRICS

    def metric_rows() -> str:
        rows = [
            ("Latency", f"{before.get('latency_ms')}ms", f"{after.get('latency_ms')}ms"),
            ("Error rate", f"{before.get('error_rate')}%", f"{after.get('error_rate')}%"),
            ("DB queries / request", before.get("db_queries_per_request"), after.get("db_queries_per_request")),
            ("DB latency", f"{before.get('db_latency_ms')}ms", f"{after.get('db_latency_ms')}ms"),
        ]
        return "".join(
            f"<tr><td>{_e(n)}</td><td class='bad'>{_e(b)}</td><td class='good'>{_e(a)}</td></tr>"
            for n, b, a in rows
        )

    timeline_html = "".join(
        f"<li><span class='t'>{_e(ev.time_label)}</span> <b>{_e(ev.title)}</b>"
        f"<div class='muted'>{_e(ev.detail)}</div></li>"
        for ev in timeline
    )
    agents_html = "".join(
        f"<tr><td>{_e(a.agent)}</td><td>{_e(a.finding)}</td>"
        f"<td>{_e(round((a.confidence or 0) * 100))}%</td></tr>"
        for a in agents
    )
    reasons_html = "".join(f"<li>✓ {_e(r)}</li>" for r in (rc.reasons if rc else []))
    evidence_html = "".join(
        f"<tr><td>{_e(ev.key)}</td><td>{_e(ev.type)}</td><td>{_e(ev.title)}</td>"
        f"<td>{_e(round(ev.relevance * 100))}%</td></tr>"
        for ev in evidence
    )
    deploy_html = "".join(
        f"<tr><td>{_e(d.version)}</td><td>{_e(d.commit_sha)}</td><td>{_e(d.author)}</td>"
        f"<td>{_e(d.description)}</td></tr>"
        for d in deployments
    )
    suites_html = ""
    if test_run:
        suites_html = "".join(
            f"<tr><td>{_e(s.get('name'))}</td>"
            f"<td>{_e(s.get('passed'))}/{_e(s.get('total'))}</td>"
            f"<td>{_e(s.get('status'))}</td></tr>"
            for s in (test_run.suites or [])
        )

    confidence_pct = round((incident.confidence or (rc.confidence if rc else 0)) * 100)
    duration = incident.duration_seconds or fixtures.RECOVERY_DURATION_SECONDS
    dur_str = f"{duration // 60}m {duration % 60}s"

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DevGuard Report — Incident #{incident.id}</title>
<style>
  :root {{ --ink:#0b1220; --muted:#5b6472; --line:#e5e9f0; --bad:#dc2626; --good:#16a34a;
           --brand:#4f46e5; --bg:#f7f8fb; --card:#ffffff; }}
  * {{ box-sizing:border-box; }}
  body {{ font-family: ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial; color:var(--ink);
          background:var(--bg); margin:0; padding:40px; line-height:1.5; }}
  .wrap {{ max-width:900px; margin:0 auto; }}
  header {{ display:flex; justify-content:space-between; align-items:flex-start;
            border-bottom:2px solid var(--ink); padding-bottom:16px; margin-bottom:24px; }}
  .brand {{ font-weight:800; letter-spacing:-0.02em; font-size:22px; }}
  .brand span {{ color:var(--brand); }}
  .tag {{ display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:700; }}
  .crit {{ background:#fee2e2; color:#991b1b; }}
  .ok {{ background:#dcfce7; color:#166534; }}
  h1 {{ font-size:26px; margin:0 0 4px; }}
  h2 {{ font-size:15px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
        margin:32px 0 12px; border-bottom:1px solid var(--line); padding-bottom:6px; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }}
  .grid {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }}
  .kpi {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; }}
  .kpi .l {{ font-size:11px; text-transform:uppercase; color:var(--muted); letter-spacing:0.06em; }}
  .kpi .v {{ font-size:22px; font-weight:800; margin-top:4px; }}
  table {{ width:100%; border-collapse:collapse; font-size:14px; background:var(--card);
           border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
  th,td {{ text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); }}
  th {{ background:#f1f3f8; font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); }}
  .bad {{ color:var(--bad); font-weight:700; }}
  .good {{ color:var(--good); font-weight:700; }}
  .muted {{ color:var(--muted); font-size:13px; }}
  ul {{ padding-left:18px; }}
  ol.timeline {{ list-style:none; padding:0; }}
  ol.timeline li {{ padding:8px 0; border-bottom:1px dashed var(--line); }}
  ol.timeline .t {{ display:inline-block; width:52px; font-variant-numeric:tabular-nums;
                    color:var(--brand); font-weight:700; }}
  pre {{ background:#0b1220; color:#e2e8f0; padding:16px; border-radius:12px; overflow:auto;
         font-size:12.5px; line-height:1.55; }}
  pre .add {{ color:#86efac; }} pre .del {{ color:#fca5a5; }}
  .foot {{ margin-top:40px; color:var(--muted); font-size:12px; text-align:center; }}
  @media print {{ body {{ background:#fff; padding:0; }} .card,.kpi,table {{ break-inside:avoid; }} }}
</style></head>
<body><div class="wrap">
  <header>
    <div>
      <div class="brand">DEV<span>GUARD</span></div>
      <div class="muted">AI Production Incident Investigator — Report</div>
    </div>
    <div style="text-align:right">
      <div class="tag {'ok' if incident.status == 'RESOLVED' else 'crit'}">{_e(incident.status)}</div>
      <div class="muted" style="margin-top:6px">Incident #{incident.id}</div>
    </div>
  </header>

  <h1>{_e(incident.title)}</h1>
  <div class="muted">{_e(incident.service)} · Severity {_e(incident.severity)} · Deployment {_e(incident.deployment_version)}</div>

  <h2>Impact</h2>
  <div class="grid">
    <div class="kpi"><div class="l">Peak latency</div><div class="v">{_e(before.get('latency_ms'))}ms → {_e(after.get('latency_ms'))}ms</div></div>
    <div class="kpi"><div class="l">Peak error rate</div><div class="v">{_e(fixtures.BROKEN_METRICS['error_rate'])}%</div></div>
    <div class="kpi"><div class="l">Confidence</div><div class="v">{confidence_pct}%</div></div>
    <div class="kpi"><div class="l">Time to resolve</div><div class="v">{_e(dur_str)}</div></div>
  </div>

  <h2>Before / After</h2>
  <table><tr><th>Metric</th><th>During incident</th><th>After fix</th></tr>{metric_rows()}</table>

  <h2>Timeline</h2>
  <div class="card"><ol class="timeline">{timeline_html}</ol></div>

  <h2>Agent findings</h2>
  <table><tr><th>Agent</th><th>Finding</th><th>Confidence</th></tr>{agents_html}</table>

  <h2>Root cause</h2>
  <div class="card">
    <div style="font-size:18px;font-weight:800">{_e(rc.title) if rc else 'N/A'}
      <span class="muted">· {_e(rc.file) if rc else ''}:{_e(rc.line) if rc else ''} · {confidence_pct}% confidence</span></div>
    <p>{_e(rc.explanation) if rc else ''}</p>
    <ul>{reasons_html}</ul>
  </div>

  <h2>Deployments</h2>
  <table><tr><th>Version</th><th>Commit</th><th>Author</th><th>Description</th></tr>{deploy_html}</table>

  <h2>Proposed fix</h2>
  <div class="card">
    <div class="muted">File: {_e(fix.file) if fix else ''} · Risk: {_e(fix.risk) if fix else ''} · {_e(fix.expected_impact) if fix else ''}</div>
    <p>{_e(fix.explanation) if fix else ''}</p>
    <pre>{_diff_html(fix.diff) if fix else ''}</pre>
  </div>

  <h2>Evidence</h2>
  <table><tr><th>ID</th><th>Type</th><th>Title</th><th>Relevance</th></tr>{evidence_html}</table>

  <h2>Verification</h2>
  <table><tr><th>Suite</th><th>Passed</th><th>Status</th></tr>{suites_html}</table>
  <p class="muted">Total: {_e(test_run.total_passed) if test_run else 0}/{_e(test_run.total) if test_run else 0} passed ·
     Recovery deployment {_e(incident.recovery_version or fixtures.RECOVERY_DEPLOYMENT)}</p>

  <div class="foot">Generated by DevGuard · This report is deterministic and reproducible.</div>
</div></body></html>"""


def _diff_html(diff: str) -> str:
    lines = []
    for line in (diff or "").splitlines():
        esc = _e(line)
        if line.startswith("+") and not line.startswith("+++"):
            lines.append(f"<span class='add'>{esc}</span>")
        elif line.startswith("-") and not line.startswith("---"):
            lines.append(f"<span class='del'>{esc}</span>")
        else:
            lines.append(esc)
    return "\n".join(lines)
