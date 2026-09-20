import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Waves,
} from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { IncidentCard } from "@/components/incident/IncidentCard";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MetricChart } from "@/components/viz/MetricChart";
import { MetricStat } from "@/components/viz/MetricStat";
import { HealthRing } from "@/components/viz/HealthRing";
import { useSocket } from "@/hooks/useSocket";
import {
  useActiveIncident,
  useAgents,
  useDemoActions,
  useHealth,
  useIncidents,
  useMetrics,
} from "@/hooks/useQueries";
import { describeEvent } from "@/lib/events";
import { gsap, useGsap } from "@/lib/motion";
import type { IncidentSummary } from "@/lib/types";
import { cn, ms, pct, relativeTime } from "@/lib/utils";

const ACTIVE = new Set([
  "DETECTED",
  "INVESTIGATING",
  "ROOT_CAUSE_FOUND",
  "FIX_READY",
  "AWAITING_APPROVAL",
  "TESTING",
]);

// Supporting ecosystem incidents to display in the command center (Section 12 specification)
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

  const [startingDemo, setStartingDemo] = useState(false);

  const incident = active.data ?? null;
  const isActive = incident !== null;

  const latestId = incidents.data?.[0]?.id ?? null;
  const metrics = useMetrics(incident?.id ?? latestId);
  const snapshot = isActive ? metrics.data?.current : metrics.data?.baseline.healthy;
  const baseline = metrics.data?.baseline.healthy;

  const { events } = useSocket(0);
  const feed = useMemo(() => events.slice(-9).reverse(), [events]);

  const heroRef = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const sweep = heroRef.current?.querySelector<HTMLElement>("[data-sweep]");
      if (sweep) {
        gsap.fromTo(
          sweep,
          { xPercent: -120 },
          { xPercent: 220, duration: 6.5, ease: "none", repeat: -1, repeatDelay: 2.2 }
        );
      }
      const halo = heroRef.current?.querySelectorAll<HTMLElement>("[data-halo]");
      if (halo?.length && isActive) {
        gsap.fromTo(
          halo,
          { scale: 0.7, opacity: 0.55 },
          {
            scale: 1.75,
            opacity: 0,
            duration: 2.6,
            ease: "power2.out",
            repeat: -1,
            stagger: 0.85,
          }
        );
      }
    },
    [isActive],
    heroRef
  );

  const healthValue = health.data?.system_health ?? (isActive ? 62 : 100);

  // Flagship Demo Flow (Section 47 specification)
  const handleRunDemoIncident = async () => {
    try {
      setStartingDemo(true);
      // 1. Reset state
      await demo.reset.mutateAsync();
      // 2. Inject demo incident
      const created = await demo.inject.mutateAsync();
      // 3. Navigate into the investigation screen with demo_run=true
      navigate(`/incidents/${created.id}?demo_run=true`);
    } catch (err) {
      console.error("Failed to run demo incident", err);
    } finally {
      setStartingDemo(false);
    }
  };

  // Combine real incidents with demo context
  const displayIncidents = useMemo(() => {
    const list = incidents.data ? [...incidents.data] : [];
    // Ensure mock incidents appear for a rich command-center feel if list is small
    if (list.length < 3) {
      for (const mock of MOCK_INCIDENTS) {
        if (!list.some((item) => item.service === mock.service)) {
          list.push(mock);
        }
      }
    }
    return list;
  }, [incidents.data]);

  return (
    <div className="space-y-6">
      {/* ── Top Command Center Bar (Section 12 specification) ───────────── */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-line/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <DevGuardLogo size={22} />
            <span className="font-mono text-xs font-bold tracking-widest text-brand uppercase">
              DEVGUARD
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl uppercase font-sans">
            INCIDENT COMMAND CENTER
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-ok/35 bg-ok/10 px-3 py-1 text-xs font-bold text-ok tracking-wide">
            <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
            SYSTEM OPERATIONAL
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/70 px-2.5 py-1 text-2xs font-semibold text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Backend Connected
          </div>
        </div>
      </section>

      {/* ── Hero Status Band ──────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        data-rise
        className={cn(
          "panel relative overflow-hidden",
          isActive ? "ring-1 ring-bad/40 shadow-glow" : "ring-1 ring-ok/20"
        )}
      >
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div
          data-sweep
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 gpu"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(var(--c-brand) / 0.12), transparent)",
          }}
        />

        <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isActive ? "bad" : "ok"} dot pulse={isActive}>
                {isActive ? "1 CRITICAL INCIDENT" : "Systems Nominal"}
              </Badge>
              {incident ? <SeverityBadge severity={incident.severity} /> : null}
              <span className="chip border-line text-faint">
                {health.data?.services_monitored ?? 12} services monitored
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-4xl">
              {isActive ? (
                <>
                  <span className="text-bad">{incident?.service}</span> is degraded
                </>
              ) : (
                <>
                  Production systems <span className="text-gradient">healthy</span>
                </>
              )}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {isActive
                ? `${incident?.title} on deployment ${incident?.deployment_version}. Latency increased from 200ms to 4800ms (+2300%) with error rate spiking to 21.8%. Run the automated investigation now.`
                : "No active outages. Run the deterministic flagship demo to watch autonomous AI agents investigate, identify the N+1 query, generate a patch, and verify with 44/44 tests."}
            </p>

            {/* Flagship Primary CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                icon={<Play className="h-4 w-4 fill-current" />}
                loading={startingDemo || demo.inject.isPending}
                onClick={handleRunDemoIncident}
                className="bg-brand hover:bg-brand-ink text-white font-bold shadow-glow text-sm uppercase tracking-wider"
              >
                RUN DEMO INCIDENT
              </Button>

              {isActive && (
                <Button
                  size="lg"
                  variant="danger"
                  icon={<Radar className="h-4 w-4" />}
                  onClick={() => navigate(`/incidents/${incident?.id}`)}
                >
                  Investigate Live →
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                icon={<RotateCcw className="h-4 w-4" />}
                loading={demo.reset.isPending}
                onClick={() => demo.reset.mutate()}
              >
                Reset demo
              </Button>
            </div>
          </div>

          <div className="relative grid shrink-0 place-items-center">
            {isActive
              ? [0, 1, 2].map((i) => (
                  <span
                    key={i}
                    data-halo
                    aria-hidden
                    className="pointer-events-none absolute h-32 w-32 rounded-full border border-bad/40 gpu"
                  />
                ))
              : null}
            <HealthRing value={healthValue} size={148} label="System health" />
          </div>
        </div>
      </section>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <section data-rise className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricStat
          label="Error rate"
          value={snapshot?.error_rate ?? 0}
          format={(v) => pct(v)}
          icon={AlertTriangle}
          tone={isActive ? "bad" : "ok"}
          delta={
            isActive && baseline ? (snapshot?.error_rate ?? 0) - baseline.error_rate : null
          }
          baseline={baseline ? `baseline ${pct(baseline.error_rate)}` : undefined}
        />
        <MetricStat
          label="p95 latency"
          value={snapshot?.latency_ms ?? 0}
          format={(v) => ms(v)}
          icon={Timer}
          tone={isActive ? "bad" : "ok"}
          delta={isActive && baseline ? (snapshot?.latency_ms ?? 0) - baseline.latency_ms : null}
          baseline={baseline ? `baseline ${ms(baseline.latency_ms)}` : undefined}
        />
        <MetricStat
          label="DB queries / req"
          value={snapshot?.db_queries_per_request ?? 0}
          format={(v) => `${Math.round(v)}`}
          icon={Database}
          tone={isActive ? "warn" : "ok"}
          delta={
            isActive && baseline
              ? (snapshot?.db_queries_per_request ?? 0) - baseline.db_queries_per_request
              : null
          }
          baseline={baseline ? `baseline ${baseline.db_queries_per_request}` : undefined}
        />
        <MetricStat
          label="DB latency"
          value={snapshot?.db_latency_ms ?? 0}
          format={(v) => ms(v)}
          icon={Waves}
          tone={isActive ? "warn" : "ok"}
          delta={
            isActive && baseline ? (snapshot?.db_latency_ms ?? 0) - baseline.db_latency_ms : null
          }
          baseline={snapshot ? `${snapshot.requests_per_min} throughput` : undefined}
        />
      </section>

      {/* ── Telemetry + Live Feed ────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div data-rise>
          <Card>
            <CardHeader
              icon={<Gauge className="h-4 w-4" />}
              title="Checkout API Telemetry"
              subtitle={
                isActive
                  ? "Live window around the failing deployment v1.8.4"
                  : "Recorded baseline vs. incident window"
              }
              actions={
                metrics.data ? (
                  <Badge tone={isActive ? "bad" : "neutral"}>
                    {isActive ? "latency ↑ 2300%" : "stable"}
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

        <div data-rise>
          <Card className="h-full">
            <CardHeader
              icon={<Activity className="h-4 w-4" />}
              title="Command Activity"
              subtitle="Streamed from the AI orchestrator"
            />
            <CardBody className="pt-0">
              {feed.length === 0 ? (
                <p className="py-8 text-center text-xs text-faint">
                  Waiting for events — click RUN DEMO INCIDENT to begin.
                </p>
              ) : (
                <ul className="space-y-2">
                  {feed.map((event, i) => (
                    <li
                      key={`${event.type}-${i}`}
                      className="flex items-start gap-2.5 rounded-xl border border-line bg-elevated/40 px-3 py-2"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          i === 0 ? "bg-brand animate-ping" : "bg-faint"
                        )}
                      />
                      <p className="text-xs leading-relaxed text-muted">{describeEvent(event)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Active & Monitored Incidents (Section 12 & 13) ────────────────── */}
      <section data-rise className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-brand" />
            <h2 className="text-base font-bold text-ink uppercase tracking-wider font-mono">
              INCIDENTS
            </h2>
            <span className="chip border-line text-faint font-mono">
              {displayIncidents.length} recorded
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={() => navigate("/incidents")}>
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {displayIncidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              isFlagship={inc.service === "Checkout API"}
            />
          ))}
        </div>
      </section>

      {/* ── Agent Swarm Roster ───────────────────────────────────────────── */}
      <section data-rise>
        <Card>
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Autonomous Agent Swarm"
            subtitle="Five specialized agents dispatched sequentially upon incident detection"
          />
          <CardBody className="pt-0">
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
              {(agents.data ?? []).map((agent) => (
                <li
                  key={agent.agent}
                  className="rounded-2xl border border-line bg-elevated/40 p-3.5 transition-colors duration-200 hover:border-strong"
                >
                  <span className="text-xl" aria-hidden>
                    {agent.emoji}
                  </span>
                  <p className="mt-2 text-sm font-bold tracking-tight text-ink">
                    {agent.label}
                  </p>
                  <p className="mt-1 text-2xs leading-relaxed text-muted">
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
