import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileText, History as HistoryIcon, TrendingUp } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { MetricStat } from "@/components/viz/MetricStat";
import { useIncidents } from "@/hooks/useQueries";
import { api } from "@/lib/api";
import { cn, confidencePct, duration, pct, relativeTime } from "@/lib/utils";

const RESOLVED = new Set(["RESOLVED", "FAILED"]);

export default function History() {
  const navigate = useNavigate();
  const incidents = useIncidents();

  const resolved = useMemo(
    () => (incidents.data ?? []).filter((i) => RESOLVED.has(i.status)),
    [incidents.data]
  );

  const stats = useMemo(() => {
    const done = resolved.filter((i) => i.status === "RESOLVED");
    const durations = done
      .map((i) => i.duration_seconds)
      .filter((d): d is number => typeof d === "number" && d > 0);
    const avg =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const confidences = done
      .map((i) => i.confidence)
      .filter((c): c is number => typeof c === "number");
    const avgConf =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
    return { total: resolved.length, recovered: done.length, avg, avgConf };
  }, [resolved]);

  return (
    <div className="space-y-5">
      <section data-rise className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-brand">
            <HistoryIcon className="h-4 w-4" aria-hidden />
            <span className="label-eyebrow text-brand">Recovery log</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Incident history
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Every incident DevGuard has closed, with the recovery time and the confidence the
            reasoning engine had in its root cause.
          </p>
        </div>
      </section>

      <section data-rise className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricStat
          label="Incidents closed"
          value={stats.total}
          format={(v) => `${Math.round(v)}`}
          icon={CheckCircle2}
          tone="brand"
        />
        <MetricStat
          label="Recovered"
          value={stats.recovered}
          format={(v) => `${Math.round(v)}`}
          icon={TrendingUp}
          tone="ok"
        />
        <MetricStat
          label="Avg. recovery"
          value={stats.avg ?? 0}
          format={(v) => (stats.avg ? duration(Math.round(v)) : "—")}
          icon={Clock}
          tone="accent"
        />
        <MetricStat
          label="Avg. confidence"
          value={stats.avgConf ? Math.round(stats.avgConf * 100) : 0}
          format={(v) => (stats.avgConf ? `${Math.round(v)}%` : "—")}
          icon={TrendingUp}
          tone="brand"
        />
      </section>

      <section data-rise>
        <Card>
          <CardHeader
            icon={<HistoryIcon className="h-4 w-4" />}
            title="Resolved incidents"
            subtitle={`${resolved.length} in the log`}
          />
          <CardBody className="pt-0">
            {incidents.isLoading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : incidents.isError ? (
              <ErrorState error={incidents.error} onRetry={() => incidents.refetch()} />
            ) : resolved.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon className="h-5 w-5" />}
                title="No history yet"
                body="Resolve an incident end to end and it will appear here with its recovery time."
              />
            ) : (
              <ol className="relative space-y-3 before:absolute before:left-[0.6875rem] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-line sm:before:left-3">
                {resolved.map((row) => {
                  const ok = row.status === "RESOLVED";
                  return (
                    <li key={row.id} className="relative flex gap-3 pl-8 sm:pl-9">
                      <span
                        className={cn(
                          "absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border-2 bg-canvas",
                          ok ? "border-ok/50 text-ok" : "border-bad/50 text-bad"
                        )}
                        aria-hidden
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <div
                        className={cn(
                          "min-w-0 flex-1 rounded-2xl border p-4 transition-colors duration-200 hover:border-strong",
                          ok ? "border-line bg-elevated/40" : "border-bad/25 bg-bad/[0.03]"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
                            <p className="mt-0.5 text-2xs text-muted">
                              #{row.id} · {row.service} · resolved {relativeTime(row.resolved_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <SeverityBadge severity={row.severity} />
                            <StatusBadge status={row.status} />
                          </div>
                        </div>

                        {row.root_cause_summary ? (
                          <p className="mt-2.5 text-xs leading-relaxed text-muted">
                            {row.root_cause_summary}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-faint">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden />
                            {duration(row.duration_seconds)}
                          </span>
                          {row.confidence != null ? (
                            <span>confidence {confidencePct(row.confidence)}</span>
                          ) : null}
                          <span className="font-mono">{row.deployment_version}</span>
                          <span className="ml-auto">peak error {pct(row.error_rate)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<FileText className="h-3 w-3" />}
                            onClick={() => window.open(api.reportUrl(row.id), "_blank", "noopener")}
                          >
                            Report
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/incidents/${row.id}`)}>
                            Open
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
