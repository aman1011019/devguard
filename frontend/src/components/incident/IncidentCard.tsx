import { ArrowRight, Clock, Database, Globe, Layers, Server, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { IncidentSummary } from "@/lib/types";
import { cn, ms, pct, relativeTime } from "@/lib/utils";

interface IncidentCardProps {
  incident: IncidentSummary;
  isFlagship?: boolean;
}

export function IncidentCard({ incident, isFlagship = false }: IncidentCardProps) {
  const navigate = useNavigate();
  const isCritical = incident.severity === "CRITICAL";
  const isActive = [
    "DETECTED",
    "INVESTIGATING",
    "ROOT_CAUSE_FOUND",
    "FIX_READY",
    "AWAITING_APPROVAL",
    "TESTING",
  ].includes(incident.status);

  // Format metrics cleanly
  const latencyDisplay =
    incident.latency_ms >= 1000
      ? `${(incident.latency_ms / 1000).toFixed(1)}s`
      : ms(incident.latency_ms);

  const errorDisplay = pct(incident.error_rate);
  const dbQueriesDisplay = `${incident.db_queries_per_request || 25}/req`;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-5 transition-all duration-300 hover:shadow-card-hover",
        isFlagship
          ? "border-bad/40 bg-surface/90 ring-1 ring-bad/20 hover:border-bad/60 shadow-glow"
          : "border-line bg-surface/70 hover:border-strong"
      )}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
          {isFlagship && (
            <span className="chip border-bad/30 bg-bad/10 text-bad font-mono font-bold">
              FLAGSHIP DEMO
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-2xs text-faint">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> us-east-1
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" /> {relativeTime(incident.detected_at)}
          </span>
        </div>
      </div>

      {/* Title & Service */}
      <div className="mt-3.5">
        <div className="flex items-center gap-2 text-muted text-xs">
          <Server className="h-3.5 w-3.5 text-brand" />
          <span className="font-semibold text-ink">{incident.service}</span>
          <span>•</span>
          <span className="font-mono text-faint">Deployment {incident.deployment_version}</span>
        </div>

        <h3 className="mt-1 text-base font-bold text-ink sm:text-lg tracking-tight group-hover:text-brand transition-colors">
          {incident.title}
        </h3>

        {incident.root_cause_summary && (
          <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-1">
            Root Cause: <span className="text-ink font-medium">{incident.root_cause_summary}</span>
          </p>
        )}
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl border border-line/60 bg-elevated/40 p-3">
        <div>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint block">
            Latency
          </span>
          <span
            className={cn(
              "mt-0.5 font-mono text-sm font-bold tabular-nums block",
              isActive ? "text-bad" : "text-ink"
            )}
          >
            {latencyDisplay}
          </span>
        </div>

        <div>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint block">
            Errors
          </span>
          <span
            className={cn(
              "mt-0.5 font-mono text-sm font-bold tabular-nums block",
              isActive ? "text-bad" : "text-ink"
            )}
          >
            {errorDisplay}
          </span>
        </div>

        <div>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint block">
            DB Queries
          </span>
          <span
            className={cn(
              "mt-0.5 font-mono text-sm font-bold tabular-nums block",
              isActive ? "text-warn" : "text-ink"
            )}
          >
            {dbQueriesDisplay}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between pt-2 border-t border-line/60">
        <div className="flex items-center gap-1.5 text-2xs text-muted">
          <Layers className="h-3.5 w-3.5 text-faint" />
          <span>
            {isActive
              ? incident.status === "INVESTIGATING"
                ? "Agents actively correlating evidence"
                : "Awaiting engineer action"
              : "Post-incident report available"}
          </span>
        </div>

        <Button
          size="sm"
          variant={isActive ? "danger" : "outline"}
          icon={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => navigate(`/incidents/${incident.id}`)}
          className={isActive ? "font-bold shadow-sm" : ""}
        >
          INVESTIGATE →
        </Button>
      </div>
    </div>
  );
}
