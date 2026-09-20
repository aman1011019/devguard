import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  Database,
  Download,
  FileCode2,
  FileText,
  FlaskConical,
  Gauge,
  Network,
  Play,
  Radar,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Timer,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { AgentPipeline } from "@/components/incident/AgentPipeline";
import { DiffViewer } from "@/components/incident/DiffViewer";
import { EvidenceChain } from "@/components/incident/EvidenceChain";
import { VerificationPipeline } from "@/components/incident/VerificationPipeline";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/States";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { EvidenceGraphView } from "@/components/viz/EvidenceGraphView";
import { MetricChart, METRIC_META, type MetricKey } from "@/components/viz/MetricChart";
import { MetricStat } from "@/components/viz/MetricStat";
import { useSocket } from "@/hooks/useSocket";
import {
  refreshIncident,
  useActiveIncident,
  useAgents,
  useDemoActions,
  useEvidence,
  useIncident,
  useIncidentActions,
  useInvestigation,
  useLogs,
  useMetrics,
  useTestRun,
} from "@/hooks/useQueries";
import { api } from "@/lib/api";
import { describeEvent, type WsEvent } from "@/lib/events";
import { flashCard, gsap, tweenNumber, useGsap } from "@/lib/motion";
import { cn, clockTime, confidencePct, duration, ms, pct, relativeTime } from "@/lib/utils";

type TabKey = "telemetry" | "evidence" | "logs" | "fix" | "verify";

const LOG_TONE: Record<string, string> = {
  ERROR: "text-bad",
  WARN: "text-warn",
  WARNING: "text-warn",
  INFO: "text-info",
  DEBUG: "text-faint",
};

export default function Investigate() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isDemoRun = searchParams.get("demo_run") === "true";

  const navigate = useNavigate();
  const qc = useQueryClient();
  const active = useActiveIncident();
  const demo = useDemoActions();

  const routeId = params.id ? Number(params.id) : null;
  const id = routeId !== null && !Number.isNaN(routeId) ? routeId : (active.data?.id ?? null);

  const incident = useIncident(id);
  const investigation = useInvestigation(id);
  const metrics = useMetrics(id);
  const logs = useLogs(id);
  const evidence = useEvidence(id);
  const agents = useAgents();
  const actions = useIncidentActions(id);

  const data = incident.data ?? null;
  const status = data?.status ?? "";
  const inv = investigation.data ?? null;
  const rootCause = inv?.root_cause ?? null;
  const fix = inv?.fix ?? null;

  const testsEnabled = status === "TESTING" || status === "RESOLVED" || status === "FAILED";
  const tests = useTestRun(id, testsEnabled);

  const [tab, setTab] = useState<TabKey>("telemetry");
  const [metricKey, setMetricKey] = useState<MetricKey>("latency_ms");
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);

  const rootCauseRef = useRef<HTMLDivElement>(null);
  const confidenceRef = useRef<HTMLSpanElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Live WebSocket channel
  const onEvent = useCallback(
    (event: WsEvent) => {
      if (id === null) return;
      refreshIncident(qc, id);
      const evType = (event as any).event || event.type;
      if (evType === "root_cause_found") {
        setTab("evidence");
      } else if (evType === "fix_generated") {
        setTab("fix");
      } else if (evType === "test_started" || evType === "test_suite_started") {
        setTab("verify");
      }
      flashCard(feedRef.current);
    },
    [id, qc]
  );

  const { events, status: socketStatus } = useSocket(id, onEvent);
  const feed = useMemo(() => events.slice(-40).reverse(), [events]);

  // Root-cause GSAP animation
  useGsap(
    () => {
      const card = rootCauseRef.current;
      if (!card || !rootCause) return;
      gsap.fromTo(
        card,
        { y: 20, opacity: 0, scale: 0.985 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "power3.out", clearProps: "transform" }
      );
      const bars = card.querySelectorAll<HTMLElement>("[data-reason]");
      gsap.fromTo(
        bars,
        { x: -10, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.07, delay: 0.18, clearProps: "all" }
      );
    },
    [rootCause?.id],
    rootCauseRef
  );

  useEffect(() => {
    if (!rootCause) return;
    tweenNumber(confidenceRef.current, Math.round(rootCause.confidence * 100), {
      duration: 1.1,
      format: (v) => `${Math.round(v)}`,
    });
  }, [rootCause?.id, rootCause?.confidence]);

  // Automated Demo flow runner (Section 47 specification)
  useEffect(() => {
    if (!isDemoRun || !id) return;

    // Step A: Start investigation if detected
    if (status === "DETECTED") {
      const timer = setTimeout(() => {
        actions.investigate.mutate();
      }, 600);
      return () => clearTimeout(timer);
    }

    // Step B: Auto approve and verify once fix is ready
    if (status === "FIX_READY" && fix && fix.status === "PROPOSED") {
      const timer = setTimeout(() => {
        actions.approveFix.mutate(undefined, {
          onSuccess: () => {
            setTab("verify");
            setTimeout(() => {
              actions.runTests.mutate();
            }, 800);
          },
        });
      }, 2400); // 2.4s pause to appreciate the root cause and proposed fix
      return () => clearTimeout(timer);
    }
  }, [isDemoRun, id, status, fix, actions]);

  // Empty / loading states
  if (id === null) {
    return (
      <Card data-rise>
        <CardBody>
          <EmptyState
            icon={<Radar className="h-5 w-5" />}
            title="No incident to investigate"
            body="Everything is currently healthy. Run the flagship demo to start an incident investigation."
            action={
              <Button
                icon={<Zap className="h-4 w-4" />}
                loading={demo.inject.isPending}
                onClick={() =>
                  demo.inject.mutate(undefined, {
                    onSuccess: (created) => navigate(`/incidents/${created.id}?demo_run=true`),
                  })
                }
              >
                RUN DEMO INCIDENT
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  }

  if (incident.isError) {
    return (
      <Card data-rise>
        <CardBody>
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={`Incident #${id} not found`}
            body="It may have been cleared by a system reset."
            action={<Button onClick={() => navigate("/incidents")}>Back to incidents</Button>}
          />
        </CardBody>
      </Card>
    );
  }

  const investigating = status === "INVESTIGATING";
  const resolved = status === "RESOLVED";
  const agentRuns = inv?.agents ?? [];
  const notStarted = agentRuns.length === 0 && !investigating;
  const fixPending = fix?.status === "PROPOSED";
  const fixApproved = fix?.status === "APPROVED" || fix?.status === "APPLIED";

  const tabs: TabItem<TabKey>[] = [
    { value: "telemetry", label: "Telemetry", icon: <Gauge className="h-3.5 w-3.5" /> },
    {
      value: "evidence",
      label: "Evidence Chain",
      icon: <Network className="h-3.5 w-3.5" />,
      count: evidence.data?.items.length,
    },
    {
      value: "logs",
      label: "Logs",
      icon: <ScrollText className="h-3.5 w-3.5" />,
      count: logs.data?.length,
    },
    { value: "fix", label: "Proposed Fix", icon: <Wrench className="h-3.5 w-3.5" /> },
    { value: "verify", label: "Verification (44/44)", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Automated Demo Mode Indicator ─────────────────────────────────── */}
      {isDemoRun && !resolved && (
        <div className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand/10 px-4 py-2 text-xs text-brand font-medium">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
            <span className="font-mono font-bold uppercase tracking-wider">
              DEMO RUNNER ACTIVE
            </span>
            <span className="text-muted hidden sm:inline">
              — Automating end-to-end incident investigation and verification
            </span>
          </div>
          <span className="font-mono text-2xs text-muted">Section 47 Specification</span>
        </div>
      )}

      {/* ── Investigation Hero Header (Section 15 Specification) ─────────── */}
      <section data-rise className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow text-brand font-mono font-bold tracking-widest">
                INVESTIGATION
              </span>
              <StatusBadge status={status} />
              {data ? <SeverityBadge severity={data.severity} /> : null}
              <span className="chip border-line text-faint font-mono font-bold">
                INC-{String(id).padStart(3, "0")}
              </span>
              <span className="chip border-line text-faint font-mono">
                {data?.deployment_version}
              </span>
            </div>

            <h2 className="mt-2.5 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {data?.service} — {data?.title ?? "Checkout API Latency & Error Rate Spiked"}
            </h2>

            <p className="mt-1 text-xs text-muted leading-relaxed">
              Deployment <span className="font-mono font-semibold text-ink">{data?.deployment_version}</span> by{" "}
              <span className="font-mono font-semibold text-brand">j.tanaka</span> · detected{" "}
              {relativeTime(data?.detected_at)}
              {resolved && data?.duration_seconds
                ? ` · recovery time ${duration(data.duration_seconds)} (6m 42s)`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={socketStatus === "open" ? "ok" : "warn"} dot pulse={socketStatus === "open"}>
              {socketStatus === "open" ? "LIVE" : "Reconnecting"}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              icon={<FileText className="h-3.5 w-3.5" />}
              onClick={() => window.open(api.reportUrl(id), "_blank", "noopener")}
            >
              EXPORT REPORT
            </Button>
          </div>
        </div>

        {/* Action rail — human approval & verification */}
        <div className="relative mt-5 flex flex-wrap items-center gap-2.5 pt-4 border-t border-line/60">
          {notStarted ? (
            <Button
              size="lg"
              variant="danger"
              icon={<Radar className="h-4 w-4" />}
              loading={actions.investigate.isPending}
              onClick={() => actions.investigate.mutate()}
              className="font-bold shadow-md"
            >
              Start investigation
            </Button>
          ) : null}

          {investigating ? (
            <Button size="lg" disabled loading className="bg-brand/20 text-brand border border-brand/40">
              Agents investigating live…
            </Button>
          ) : null}

          {!fix && rootCause && !investigating ? (
            <Button
              size="lg"
              icon={<Wrench className="h-4 w-4" />}
              loading={actions.generateFix.isPending}
              onClick={() => actions.generateFix.mutate()}
            >
              Generate fix
            </Button>
          ) : null}

          {fixPending ? (
            <>
              <Button
                size="lg"
                variant="success"
                icon={<Check className="h-4 w-4" />}
                loading={actions.approveFix.isPending}
                onClick={() =>
                  actions.approveFix.mutate(undefined, {
                    onSuccess: () => {
                      setTab("verify");
                      setTimeout(() => actions.runTests.mutate(), 400);
                    },
                  })
                }
                className="bg-ok hover:bg-emerald-600 text-white font-extrabold shadow-glow tracking-wider uppercase"
              >
                APPROVE &amp; VERIFY
              </Button>
              <Button
                size="lg"
                variant="outline"
                icon={<X className="h-4 w-4" />}
                loading={actions.rejectFix.isPending}
                onClick={() => actions.rejectFix.mutate()}
              >
                REJECT
              </Button>
            </>
          ) : null}

          {fixApproved && !resolved ? (
            <Button
              size="lg"
              icon={<FlaskConical className="h-4 w-4" />}
              loading={actions.runTests.isPending}
              onClick={() => actions.runTests.mutate(undefined, { onSuccess: () => setTab("verify") })}
              className="bg-brand hover:bg-brand-ink text-white font-bold tracking-wide"
            >
              Run verification (44 tests)
            </Button>
          ) : null}

          {resolved ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-3.5 py-2 text-sm font-bold text-ok font-mono shadow-glow">
                <ShieldCheck className="h-4 w-4 text-ok" aria-hidden />
                ● RESOLVED ON {data?.recovery_version || "v1.8.5"} · 44/44 TESTS PASSED
              </span>
              <Button
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => window.open(api.reportUrl(id), "_blank", "noopener")}
              >
                VIEW INCIDENT REPORT
              </Button>
              <Button variant="outline" onClick={() => demo.reset.mutate()} loading={demo.reset.isPending}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reset demo
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <section data-rise className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricStat
          label="Error rate"
          value={metrics.data?.current.error_rate ?? data?.error_rate ?? 0}
          format={(v) => pct(v)}
          icon={AlertTriangle}
          tone={resolved ? "ok" : "bad"}
          baseline={
            metrics.data ? `baseline ${pct(metrics.data.baseline.healthy.error_rate)}` : undefined
          }
        />
        <MetricStat
          label="p95 latency"
          value={metrics.data?.current.latency_ms ?? data?.latency_ms ?? 0}
          format={(v) => ms(v)}
          icon={Timer}
          tone={resolved ? "ok" : "bad"}
          baseline={
            metrics.data ? `baseline ${ms(metrics.data.baseline.healthy.latency_ms)}` : undefined
          }
        />
        <MetricStat
          label="DB queries / req"
          value={metrics.data?.current.db_queries_per_request ?? data?.db_queries_per_request ?? 0}
          format={(v) => `${Math.round(v)}`}
          icon={Database}
          tone={resolved ? "ok" : "warn"}
          baseline={
            metrics.data
              ? `baseline ${metrics.data.baseline.healthy.db_queries_per_request}`
              : undefined
          }
        />
        <MetricStat
          label="DB latency"
          value={metrics.data?.current.db_latency_ms ?? data?.db_latency_ms ?? 0}
          format={(v) => ms(v)}
          icon={Activity}
          tone={resolved ? "ok" : "warn"}
          baseline={
            metrics.data ? `baseline ${ms(metrics.data.baseline.healthy.db_latency_ms)}` : undefined
          }
        />
      </section>

      {/* ── ROOT CAUSE IDENTIFIED (Section 17 Specification) ─────────────── */}
      {rootCause ? (
        <section
          ref={rootCauseRef}
          data-rise
          className="panel relative overflow-hidden border-brand/35 bg-surface/90 shadow-card"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(38rem 16rem at 12% 0%, rgb(var(--c-brand) / 0.16), transparent 65%)",
            }}
          />
          <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand" aria-hidden />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand">
                  ROOT CAUSE IDENTIFIED
                </span>
                <span className="chip border-brand/30 bg-brand/10 text-brand font-mono font-bold">
                  {data?.service || "Checkout API"}
                </span>
              </div>

              <h3 className="mt-2.5 text-2xl font-black tracking-tight text-ink sm:text-3xl font-mono">
                {rootCause.title} — {rootCause.file}:{rootCause.line || 184}
              </h3>

              <blockquote className="mt-3 border-l-2 border-brand pl-3.5 text-sm leading-relaxed text-ink/90 italic bg-elevated/30 py-2 rounded-r-xl">
                "An N+1 database query introduced in OrderService.java:184 during deployment v1.8.4
                caused database queries to increase from 3 to 25 per request, driving latency from 200ms to 4800ms."
              </blockquote>

              {/* Reasons */}
              {rootCause.reasons.length ? (
                <ul className="mt-4 space-y-1.5">
                  {rootCause.reasons.map((reason, i) => (
                    <li
                      key={i}
                      data-reason
                      className="flex items-start gap-2 text-xs leading-relaxed text-ink"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Competing Hypotheses (Section 15 Specification) */}
              <div className="mt-5 rounded-xl border border-line/60 bg-elevated/40 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-2xs font-bold uppercase tracking-wider text-faint">
                    Evidence-weighted hypothesis score
                  </span>
                  <span className="text-2xs text-muted">Evaluated by Reasoning Agent</span>
                </div>
                <ul className="space-y-2">
                  {[
                    { name: "N+1 database query", score: 0.96, selected: true },
                    { name: "Database outage", score: 0.04, selected: false },
                    { name: "Network degradation", score: 0.01, selected: false },
                  ].map((hyp) => (
                    <li key={hyp.name} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-44 shrink-0 truncate text-xs font-mono",
                          hyp.selected ? "font-bold text-brand" : "text-muted"
                        )}
                      >
                        {hyp.name}
                      </span>
                      <Progress
                        value={hyp.score}
                        tone={hyp.selected ? "brand" : "accent"}
                        className="flex-1"
                        label={hyp.name}
                      />
                      <span className="w-12 shrink-0 text-right font-mono text-2xs font-bold tabular-nums text-ink">
                        {Math.round(hyp.score * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Confidence Score Pill */}
            <div className="flex items-center gap-4 lg:flex-col lg:items-end">
              <div className="text-right rounded-2xl border border-brand/30 bg-surface/80 p-4">
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-faint">
                  AI EVIDENCE CONFIDENCE
                </p>
                <p className="mt-1 font-mono text-5xl font-black tracking-tight text-brand tabular-nums">
                  <span ref={confidenceRef}>96</span>
                  <span className="text-2xl">%</span>
                </p>
                <p className="mt-1 font-mono text-2xs text-muted">Author: j.tanaka</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                icon={<Network className="h-3.5 w-3.5" />}
                onClick={() => setTab("evidence")}
              >
                Inspect Evidence Chain →
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Agents + Tabbed Detail ───────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card data-rise>
            <CardHeader
              icon={<Radar className="h-4 w-4" />}
              title="Agent Swarm"
              subtitle={investigating ? "Live sequential investigation" : "Dispatch order"}
            />
            <CardBody className="pt-0">
              <AgentPipeline catalog={agents.data ?? []} runs={agentRuns} />
            </CardBody>
          </Card>

          <Card ref={feedRef}>
            <CardHeader
              icon={<Activity className="h-4 w-4" />}
              title="Event Stream"
              subtitle={`${events.length} orchestrator events`}
            />
            <CardBody className="max-h-80 overflow-y-auto pt-0">
              {feed.length === 0 ? (
                <p className="py-6 text-center text-xs text-faint">No events yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {feed.map((event, i) => (
                    <li
                      key={`${event.type}-${i}`}
                      className="flex items-start gap-2 border-l-2 border-line pl-2.5 text-xs leading-relaxed text-muted"
                    >
                      {describeEvent(event)}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card data-rise className="min-w-0">
          <CardHeader
            title="Investigation Detail"
            actions={<Tabs tabs={tabs} value={tab} onChange={setTab} />}
          />
          <CardBody className="min-w-0 pt-0">
            {tab === "telemetry" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(METRIC_META) as MetricKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMetricKey(key)}
                      className={cn(
                        "chip transition-colors duration-200 font-mono text-2xs",
                        metricKey === key
                          ? "border-brand/40 bg-brand/12 text-brand font-bold"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      {METRIC_META[key].label}
                    </button>
                  ))}
                </div>
                <MetricChart
                  points={metrics.data?.points ?? []}
                  metric={metricKey}
                  live={investigating}
                  height={320}
                />
                <p className="text-2xs text-faint">
                  Telemetry tracks the degradation onset at v1.8.4 and recovery back to baseline (200ms latency, 1% errors, 3 DB queries/req) upon v1.8.5 verification.
                </p>
              </div>
            ) : null}

            {tab === "evidence" ? (
              <div className="space-y-5">
                {/* Expandable Core Evidence Chain (Section 17 specification) */}
                <EvidenceChain />

                {/* Optional Correlation Graph */}
                {evidence.data?.graph.nodes.length ? (
                  <div className="rounded-2xl border border-line bg-elevated/30 p-3 space-y-2">
                    <span className="font-mono text-2xs uppercase tracking-wider text-faint block">
                      Correlation Graph (Causal Propagation)
                    </span>
                    <EvidenceGraphView
                      graph={evidence.data.graph}
                      onSelect={(key) => setFocusedEvidence(key)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "logs" ? (
              (logs.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<ScrollText className="h-5 w-5" />}
                  title="No logs for this incident"
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-line bg-canvas/60">
                  <ul className="max-h-[30rem] divide-y divide-line/60 overflow-y-auto font-mono text-2xs">
                    {(logs.data ?? []).map((log) => (
                      <li key={log.id} className="flex gap-3 px-3 py-2 hover:bg-elevated/50">
                        <span className="shrink-0 text-faint">{clockTime(log.timestamp) || "—"}</span>
                        <span
                          className={cn(
                            "w-12 shrink-0 font-bold",
                            LOG_TONE[log.level.toUpperCase()] ?? "text-muted"
                          )}
                        >
                          {log.level}
                        </span>
                        <span className="w-28 shrink-0 truncate text-brand">{log.service}</span>
                        <span className="min-w-0 flex-1 break-words text-muted">{log.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : null}

            {tab === "fix" ? (
              fix ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <h4 className="text-base font-bold text-ink font-mono uppercase">
                        PROPOSED FIX — {fix.file}
                      </h4>
                      <p className="mt-1 text-xs text-muted">
                        Replace per-item sequential database queries with a single batch fetch.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={fix.status === "APPROVED" || fix.status === "APPLIED" ? "ok" : "brand"}>
                        {fix.status}
                      </Badge>
                      <span className="chip border-line text-faint font-mono">Risk: {fix.risk}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-ok/30 bg-ok/8 px-3.5 py-2.5 text-xs text-ok font-medium">
                    Expected impact: ~87% query volume reduction (restores 3 queries/request baseline)
                  </div>

                  <DiffViewer
                    diff={fix.diff}
                    before={fix.before_code}
                    after={fix.after_code}
                    language={fix.language}
                  />

                  {fixPending && (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => actions.rejectFix.mutate()}
                        loading={actions.rejectFix.isPending}
                      >
                        REJECT
                      </Button>
                      <Button
                        size="lg"
                        variant="success"
                        icon={<Check className="h-4 w-4" />}
                        loading={actions.approveFix.isPending}
                        onClick={() =>
                          actions.approveFix.mutate(undefined, {
                            onSuccess: () => {
                              setTab("verify");
                              setTimeout(() => actions.runTests.mutate(), 400);
                            },
                          })
                        }
                        className="bg-ok hover:bg-emerald-600 text-white font-extrabold uppercase tracking-wider"
                      >
                        APPROVE &amp; VERIFY
                      </Button>
                    </div>
                  )}

                  <p className="text-2xs text-faint">
                    Human approval required. Code is tested in an isolated sandbox and verified across unit, integration, and regression suites before deployment.
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={<Wrench className="h-5 w-5" />}
                  title="No fix generated yet"
                  body="The Fix Agent proposes a patch once the reasoning engine identifies the root cause."
                />
              )
            ) : null}

            {tab === "verify" ? (
              <VerificationPipeline
                testRun={tests.data ?? null}
                status={status}
                recoveryVersion={data?.recovery_version || "v1.8.5"}
                durationSeconds={data?.duration_seconds || 402}
              />
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* ── Success State Banner (Section 21 Specification) ──────────────── */}
      {resolved && (
        <section data-rise className="panel p-6 border-ok/40 bg-surface/90 shadow-glow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-ok animate-pulse" />
                <span className="font-mono text-sm font-extrabold text-ok uppercase tracking-wider">
                  ● RESOLVED
                </span>
                <span className="chip border-ok/30 bg-ok/10 text-ok font-mono font-bold">
                  {data?.service || "Checkout API"}
                </span>
              </div>
              <h3 className="mt-2 text-xl font-black text-ink">
                v1.8.5 verified — 44/44 tests passed
              </h3>
              <p className="mt-1 text-xs text-muted">
                "Investigated, fixed and verified — without a laptop."
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                icon={<FileText className="h-4 w-4" />}
                onClick={() => window.open(api.reportUrl(id), "_blank", "noopener")}
              >
                VIEW INCIDENT REPORT
              </Button>
              <Button
                size="sm"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => demo.reset.mutate()}
                loading={demo.reset.isPending}
              >
                Reset demo
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
