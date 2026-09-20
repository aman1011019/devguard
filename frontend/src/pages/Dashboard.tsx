import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Gauge,
  Play,
  Radar,
  RotateCcw,
  ShieldCheck,
  Timer,
  Terminal,
  Server,
  Layers,
  Clock,
  GitBranch,
  Filter,
} from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { IncidentCard } from "@/components/incident/IncidentCard";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MetricChart } from "@/components/viz/MetricChart";
import { MetricStat } from "@/components/viz/MetricStat";
import { HealthRing } from "@/components/viz/HealthRing";
import {
  useActiveIncident,
  useAgents,
  useDemoActions,
  useHealth,
  useIncidents,
  useMetrics,
} from "@/hooks/useQueries";
import { useRealtimeStore } from "@/store/realtimeStore";
import type { IncidentSummary } from "@/lib/types";
import { cn, ms, pct } from "@/lib/utils";

const MOCK_INCIDENTS: IncidentSummary[] = [
  {
    id: 991,
    service: "Payments API",
    title: "Stripe Webhook Processing Delayed",
    severity: "MEDIUM",
    status: "RESOLVED",
    detected_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    deployment_version: "v2.1.0",
    error_rate: 0.1,
    latency_ms: 180,
    requests_per_min: "1.4k",
    db_queries_per_request: 4,
    root_cause_summary: "Worker thread concurrency limit reached in WebhookConsumer",
  },
  {
    id: 992,
    service: "Auth Service",
    title: "OIDC Token Refresh Rate Anomaly",
    severity: "LOW",
    status: "RESOLVED",
    detected_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    deployment_version: "v3.0.4",
    error_rate: 0.4,
    latency_ms: 95,
    requests_per_min: "8.2k",
    db_queries_per_request: 2,
    root_cause_summary: "Transient token cache miss storm during canary warm-up",
  },
  {
    id: 993,
    service: "Notification Worker",
    title: "Email Batch Queue Backpressure",
    severity: "LOW",
    status: "RESOLVED",
    detected_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    deployment_version: "v1.4.9",
    error_rate: 0.0,
    latency_ms: 120,
    requests_per_min: "520",
    db_queries_per_request: 3,
    root_cause_summary: "Upstream SES throttling quota auto-adjusted",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const health = useHealth();
  const active = useActiveIncident();
  const incidents = useIncidents();
  const agents = useAgents();
  const demo = useDemoActions();

  // Realtime store hooks
  const services = useRealtimeStore((s) => s.services);
  const activityEvents = useRealtimeStore((s) => s.activityEvents);
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);
  const systemStats = useRealtimeStore((s) => s.systemStats);

  const [startingDemo, setStartingDemo] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState<string>("ALL");

  const incident = active.data ?? null;
  const isActive = incident !== null;

  const latestId = incidents.data?.[0]?.id ?? null;
  const metrics = useMetrics(incident?.id ?? latestId);
  const snapshot = isActive ? metrics.data?.current : metrics.data?.baseline.healthy;
  const baseline = metrics.data?.baseline.healthy;

  // Real KPI stats
  const activeCount = systemStats.activeIncidents || (health.data?.active_incidents ?? (isActive ? 1 : 0));
  const investigatingCount = systemStats.investigating || (isActive ? 1 : 0);
  const criticalCount = services.filter((s) => s.status === "CRITICAL").length || (isActive ? 1 : 0);
  const resolvedCount = systemStats.resolvedToday || (health.data?.resolved_today ?? 7);

  // Flagship Demo Flow
  const handleRunDemoIncident = async () => {
    try {
      setStartingDemo(true);
      await demo.reset.mutateAsync();
      const created = await demo.inject.mutateAsync();
      navigate(`/incidents/${created.id}?demo_run=true`);
    } catch (err) {
      console.error("Failed to run demo incident", err);
    } finally {
      setStartingDemo(false);
    }
  };

  // Combine real incidents with demo list
  const displayIncidents = useMemo(() => {
    const list = incidents.data ? [...incidents.data] : [];
    if (list.length < 3) {
      for (const mock of MOCK_INCIDENTS) {
        if (!list.some((item) => item.service === mock.service)) {
          list.push(mock);
        }
      }
    }
    return list;
  }, [incidents.data]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    if (incidentFilter === "ALL") return displayIncidents;
    if (incidentFilter === "CRITICAL")
      return displayIncidents.filter((i) => i.severity === "CRITICAL");
    if (incidentFilter === "INVESTIGATING")
      return displayIncidents.filter(
        (i) => i.status !== "RESOLVED" && i.status !== "CLOSED"
      );
    if (incidentFilter === "RESOLVED")
      return displayIncidents.filter((i) => i.status === "RESOLVED");
    return displayIncidents;
  }, [displayIncidents, incidentFilter]);

  const healthValue = health.data?.system_health ?? (isActive ? 62 : 100);

  return (
    <div className="space-y-6 font-mono">
      {/* ── 1. Incident Command Center Header ────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-line/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <DevGuardLogo size={20} />
            <span className="font-mono text-xs font-extrabold tracking-widest text-sky-400 uppercase">
              DEVGUARD
            </span>
            <span className="h-3 w-px bg-line" />
            <span className="text-[0.65rem] font-mono text-muted uppercase tracking-wider">
              ENTERPRISE FLEET CONTROL
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl uppercase font-sans">
            INCIDENT COMMAND CENTER
          </h1>
          <p className="text-xs font-mono text-muted mt-0.5">
            Real-time system health, telemetry mesh, and autonomous agent swarms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wider uppercase font-mono",
              isActive
                ? "border-rose-500/40 bg-rose-500/10 text-rose-400 animate-pulse shadow-glow"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isActive ? "bg-rose-400 animate-ping" : "bg-emerald-400"
              )}
            />
            {isActive ? "SYSTEM COMPROMISED (ACTIVE INCIDENT)" : "ALL SYSTEMS NOMINAL"}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated/70 px-2.5 py-1.5 text-2xs font-mono text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {connectionStatus === "LIVE" ? "WS: CONNECTED" : `WS: ${connectionStatus}`}
          </div>
        </div>
      </section>

      {/* ── 2. Top KPI Stat Row (Backend Driven) ─────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 font-mono">
        <div className="rounded-xl border border-line/80 bg-[#0a0e17] p-3.5 shadow-sm">
          <span className="text-[0.65rem] text-faint block uppercase font-bold tracking-wider">
            ACTIVE INCIDENTS
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                activeCount > 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {activeCount}
            </span>
            <span className="text-2xs text-muted">cluster wide</span>
          </div>
        </div>

        <div className="rounded-xl border border-line/80 bg-[#0a0e17] p-3.5 shadow-sm">
          <span className="text-[0.65rem] text-faint block uppercase font-bold tracking-wider">
            INVESTIGATING
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                investigatingCount > 0 ? "text-amber-400 animate-pulse" : "text-ink"
              )}
            >
              {investigatingCount}
            </span>
            <span className="text-2xs text-muted">swarm active</span>
          </div>
        </div>

        <div className="rounded-xl border border-line/80 bg-[#0a0e17] p-3.5 shadow-sm">
          <span className="text-[0.65rem] text-faint block uppercase font-bold tracking-wider">
            CRITICAL SERVICES
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                criticalCount > 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {criticalCount}
            </span>
            <span className="text-2xs text-muted">of {services.length || 5} services</span>
          </div>
        </div>

        <div className="rounded-xl border border-line/80 bg-[#0a0e17] p-3.5 shadow-sm">
          <span className="text-[0.65rem] text-faint block uppercase font-bold tracking-wider">
            RESOLVED TODAY
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 tabular-nums">
              {resolvedCount}
            </span>
            <span className="text-2xs text-muted">avg MTTR 6m 42s</span>
          </div>
        </div>
      </section>

      {/* ── 3. Horizontal Service Health Bar ─────────────────────────────── */}
      <section className="rounded-xl border border-line/80 bg-[#0a0e17] p-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-line/50 text-2xs">
          <div className="flex items-center gap-1.5 font-bold uppercase text-muted">
            <Server className="h-3.5 w-3.5 text-sky-400" />
            <span>Service Cluster Posture</span>
          </div>
          <Link
            to="/services"
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold"
          >
            VIEW ALL ({services.length}) <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {services.map((srv) => {
            const isCrit = srv.status === "CRITICAL";
            const isDeg = srv.status === "DEGRADED";

            return (
              <Link
                key={srv.id}
                to="/services"
                className={cn(
                  "flex items-center justify-between rounded-lg border p-2 text-2xs font-mono transition-all hover:scale-[1.02]",
                  isCrit
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-sm"
                    : isDeg
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-line/70 bg-[#06080d] text-ink hover:border-brand/40"
                )}
              >
                <div className="truncate">
                  <div className="font-bold truncate">{srv.name}</div>
                  <div className="text-[0.6rem] text-muted tabular-nums">
                    {srv.latency_ms}ms · {srv.error_rate}%
                  </div>
                </div>
                <span
                  className={cn(
                    "ml-2 h-2 w-2 shrink-0 rounded-full",
                    isCrit
                      ? "bg-rose-500 animate-ping"
                      : isDeg
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 4. Flagship Hero Card (Primary Incident Action) ──────────────── */}
      <section
        className={cn(
          "rounded-2xl border p-5 sm:p-6 lg:p-7 transition-all duration-300 relative overflow-hidden",
          isActive
            ? "border-rose-500/60 bg-[#0f0910] ring-1 ring-rose-500/30 shadow-glow"
            : "border-line/90 bg-[#080d16]"
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase",
                  isActive
                    ? "border border-rose-500/50 bg-rose-500/20 text-rose-400 animate-pulse"
                    : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                )}
              >
                {isActive ? "CRITICAL SEVERITY" : "FLEET STABLE"}
              </span>

              {incident ? <SeverityBadge severity={incident.severity} /> : null}

              <span className="rounded border border-line bg-canvas/60 px-2 py-0.5 text-2xs font-mono text-muted">
                DEPLOYMENT: {incident?.deployment_version ?? "v1.8.4"}
              </span>

              <span className="rounded border border-line bg-canvas/60 px-2 py-0.5 text-2xs font-mono text-muted">
                COMMIT: a81f2c7 (j.tanaka)
              </span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl font-sans uppercase">
              {isActive ? (
                <>
                  <span className="text-rose-400">{incident?.service}</span> LATENCY SPIKE & N+1 DATABASE STORM
                </>
              ) : (
                <>CHECKOUT API — READY FOR DEMO EXECUTION</>
              )}
            </h2>

            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-muted font-sans">
              {isActive
                ? `${incident?.title}. Latency spiked from 200ms to 4800ms (+2300%) with error rate surging to 21.8% after v1.8.4 deployment. Autonomous agents are actively gathering stacktraces and code diffs.`
                : "Checkout API latency and error rate suddenly increased after deployment v1.8.4. Autonomous agents will analyze application logs, pinpoint the N+1 loop in OrderService.java:184, generate a batch patch, and run 44 verification tests."}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                icon={<Play className="h-4 w-4 fill-current" />}
                loading={startingDemo || demo.inject.isPending}
                onClick={handleRunDemoIncident}
                className="bg-sky-500 hover:bg-sky-600 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20"
              >
                RUN DEMO INCIDENT
              </Button>

              {isActive && (
                <Button
                  size="lg"
                  variant="danger"
                  icon={<Radar className="h-4 w-4" />}
                  onClick={() => navigate(`/incidents/${incident?.id ?? 1043}?demo_run=true`)}
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                >
                  INVESTIGATE →
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                icon={<RotateCcw className="h-4 w-4" />}
                loading={demo.reset.isPending}
                onClick={() => demo.reset.mutate()}
                className="font-mono text-xs text-muted hover:text-ink"
              >
                Reset System
              </Button>
            </div>
          </div>

          {/* Health Gauge */}
          <div className="grid place-items-center shrink-0">
            <HealthRing value={healthValue} size={140} label="Fleet Health" />
          </div>
        </div>
      </section>

      {/* ── 5. Metric Vectors & Live Activity Stream ─────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* Telemetry Chart */}
        <div>
          <Card>
            <CardHeader
              icon={<Gauge className="h-4 w-4 text-sky-400" />}
              title="Checkout API Telemetry Window"
              subtitle={
                isActive
                  ? "Live window around the failing deployment v1.8.4"
                  : "Recorded baseline vs. incident window"
              }
              actions={
                metrics.data ? (
                  <Badge tone={isActive ? "bad" : "neutral"}>
                    {isActive ? "p95 LATENCY ↑ 2300%" : "STABLE &lt;200ms"}
                  </Badge>
                ) : null
              }
            />
            <CardBody>
              <MetricChart
                points={metrics.data?.points ?? []}
                metric="latency_ms"
                live={isActive}
                height={250}
              />
            </CardBody>
          </Card>
        </div>

        {/* Real-time Scrolling Event Stream */}
        <div>
          <Card className="h-full">
            <CardHeader
              icon={<Activity className="h-4 w-4 text-emerald-400" />}
              title="Real-Time Event Bus"
              subtitle="WebSocket /ws/system stream"
              actions={
                <Link
                  to="/activity"
                  className="text-2xs text-sky-400 hover:underline font-mono font-bold"
                >
                  EXPAND STREAM →
                </Link>
              }
            />
            <CardBody className="pt-0 font-mono text-2xs">
              {activityEvents.length === 0 ? (
                <div className="py-8 text-center text-muted">
                  <Terminal className="mx-auto h-6 w-6 text-faint mb-2" />
                  <p>Listening for real-time WebSocket frames...</p>
                  <p className="text-[0.65rem] text-faint mt-1">
                    Click RUN DEMO INCIDENT to trigger event burst
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {activityEvents.slice(0, 7).map((e, idx) => {
                    const type = e.type || e.event;
                    return (
                      <li
                        key={e.event_id || idx}
                        className="flex items-start gap-2 rounded-lg border border-line/60 bg-[#06080d] px-2.5 py-1.5"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-[0.65rem]">
                            <span className="font-bold text-sky-400">{e.event_id}</span>
                            <span className="text-faint">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="truncate text-ink font-sans text-xs mt-0.5">
                            {e.message || type}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── 6. Incident Filter Tabs & Cards ──────────────────────────────── */}
      <section className="space-y-3 font-mono">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
              INCIDENTS CATALOG
            </h2>
            <span className="rounded bg-elevated px-2 py-0.5 text-2xs font-bold text-muted">
              {filteredIncidents.length} TOTAL
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted mr-1" />
            {["ALL", "CRITICAL", "INVESTIGATING", "RESOLVED"].map((f) => (
              <button
                key={f}
                onClick={() => setIncidentFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-2xs font-bold uppercase transition-all",
                  incidentFilter === f
                    ? "bg-brand/20 text-sky-400 border border-brand/40"
                    : "text-muted hover:bg-elevated hover:text-ink"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredIncidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              isFlagship={inc.service === "Checkout API"}
            />
          ))}
        </div>
      </section>

      {/* ── 7. Agent Swarm Roster ────────────────────────────────────────── */}
      <section>
        <Card>
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
            title="Autonomous Investigation Agent Swarm"
            subtitle="Specialized agents orchestrated sequentially across code, logs, and telemetry"
          />
          <CardBody className="pt-0 font-mono">
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
              {(agents.data ?? []).map((agent) => (
                <li
                  key={agent.agent}
                  className="rounded-xl border border-line/80 bg-[#090d15] p-3 transition-colors hover:border-brand/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{agent.emoji}</span>
                    <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-sky-400 uppercase">
                      STANDBY
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase text-ink">
                    {agent.label}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-muted font-sans line-clamp-2">
                    {agent.running_message}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
