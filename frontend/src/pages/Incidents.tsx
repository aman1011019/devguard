import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  RotateCcw,
  ShieldCheck,
  Siren,
  Zap,
} from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useDemoActions, useIncidents } from "@/hooks/useQueries";
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

type Scope = "all" | "active" | "resolved";

const FILTERS: { key: Scope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
];

export default function Incidents() {
  const navigate = useNavigate();
  const incidents = useIncidents();
  const demo = useDemoActions();
  const [scope, setScope] = useState<Scope>("all");

  const rows = useMemo(() => {
    const all = incidents.data ?? [];
    if (scope === "active") return all.filter((i) => ACTIVE.has(i.status));
    if (scope === "resolved") return all.filter((i) => !ACTIVE.has(i.status));
    return all;
  }, [incidents.data, scope]);

  const activeCount = (incidents.data ?? []).filter((i) => ACTIVE.has(i.status)).length;

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <section data-rise className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand">
              <Siren className="h-4 w-4" aria-hidden />
              <span className="label-eyebrow text-brand">Incident queue</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {activeCount > 0 ? (
                <>
                  <span className="text-bad">{activeCount}</span> active{" "}
                  {activeCount === 1 ? "incident" : "incidents"}
                </>
              ) : (
                <>Nothing on fire</>
              )}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Every detected production break, newest first. Open one to watch the agent swarm
              investigate and correlate the evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              icon={<Zap className="h-4 w-4" />}
              loading={demo.inject.isPending}
              onClick={() =>
                demo.inject.mutate(undefined, {
                  onSuccess: (created) => navigate(`/incidents/${created.id}`),
                })
              }
            >
              Inject incident
            </Button>
            <Button
              variant="outline"
              icon={<RotateCcw className="h-4 w-4" />}
              loading={demo.reset.isPending}
              onClick={() => demo.reset.mutate()}
            >
              Reset
            </Button>
          </div>
        </div>
      </section>

      {/* ── Filter + list ─────────────────────────────────────────────────── */}
      <section data-rise>
        <Card>
          <CardHeader
            icon={<Filter className="h-4 w-4" />}
            title="All incidents"
            subtitle={`${rows.length} shown`}
            actions={
              <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-elevated/70 p-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setScope(f.key)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                      scope === f.key ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody className="pt-0">
            {incidents.isLoading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : incidents.isError ? (
              <ErrorState error={incidents.error} onRetry={() => incidents.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title={scope === "resolved" ? "No resolved incidents yet" : "No incidents"}
                body="Inject the demo failure to create one and watch DevGuard investigate."
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => (
                  <IncidentCard key={row.id} row={row} onOpen={() => navigate(`/incidents/${row.id}`)} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function IncidentCard({ row, onOpen }: { row: IncidentSummary; onOpen: () => void }) {
  const active = ACTIVE.has(row.status);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-strong hover:shadow-lift",
          active ? "border-bad/25 bg-bad/[0.03]" : "border-line bg-elevated/40"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
            <p className="mt-0.5 truncate text-2xs text-muted">
              #{row.id} · {row.service} · {relativeTime(row.detected_at)}
            </p>
          </div>
          <StatusBadge status={row.status} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Error rate" value={pct(row.error_rate)} tone={active ? "bad" : "muted"} />
          <Stat label="Latency" value={ms(row.latency_ms)} tone={active ? "warn" : "muted"} />
          <Stat label="Deploy" value={row.deployment_version} tone="muted" mono />
        </div>

        {row.root_cause_summary ? (
          <p className="flex items-center gap-1.5 text-2xs text-muted">
            <AlertTriangle className="h-3 w-3 shrink-0 text-brand" aria-hidden />
            <span className="truncate">{row.root_cause_summary}</span>
          </p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1 text-2xs font-semibold text-brand opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <SeverityBadge severity={row.severity} />
          <span className="ml-auto inline-flex items-center gap-1">
            Investigate <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </span>
      </button>
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: "bad" | "warn" | "muted";
  mono?: boolean;
}) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-xl border border-line/70 bg-surface/60 px-2.5 py-2">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">{label}</p>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums", mono && "font-mono text-xs", color)}>
        {value}
      </p>
    </div>
  );
}
