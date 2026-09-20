import { useState } from "react";
import {
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  ArrowUpRight,
  X,
  Radio,
  FileCode,
  Activity,
  Terminal,
} from "lucide-react";
import { useRealtimeStore, type ServiceItem } from "@/store/realtimeStore";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function ServicesPage() {
  const services = useRealtimeStore((s) => s.services);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const criticalCount = services.filter((s) => s.status === "CRITICAL").length;
  const degradedCount = services.filter((s) => s.status === "DEGRADED").length;
  const healthyCount = services.filter((s) => s.status === "HEALTHY").length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold font-mono uppercase tracking-tight text-ink">
              Service Catalog & Cluster Mesh
            </h1>
          </div>
          <p className="text-xs font-mono text-muted mt-1">
            Real-time topology, p95 latency, error rates, and live health telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{healthyCount} HEALTHY</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-bold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>{degradedCount} DEGRADED</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-mono font-bold text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
            <span>{criticalCount} CRITICAL</span>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((srv) => {
          const isCritical = srv.status === "CRITICAL";
          const isDegraded = srv.status === "DEGRADED";

          return (
            <div
              key={srv.id}
              onClick={() => setSelectedService(srv)}
              className={cn(
                "group relative cursor-pointer rounded-xl border bg-[#0a0e17] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                isCritical
                  ? "border-rose-500/50 hover:border-rose-500 hover:shadow-rose-500/10"
                  : isDegraded
                  ? "border-amber-500/40 hover:border-amber-500 hover:shadow-amber-500/10"
                  : "border-line hover:border-brand/50 hover:shadow-brand/5"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold font-mono text-ink group-hover:text-sky-400 transition-colors">
                      {srv.name}
                    </h2>
                    <span className="rounded border border-line bg-canvas/60 px-1.5 py-0.5 text-[0.65rem] font-mono text-faint">
                      {srv.version}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted font-sans leading-relaxed">
                    {srv.description}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider",
                    isCritical
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse"
                      : isDegraded
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  )}
                >
                  {isCritical ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : isDegraded ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {srv.status}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-line/60 bg-[#06080d] p-2.5 font-mono text-2xs">
                <div>
                  <span className="text-[0.6rem] text-faint block uppercase">p95 Latency</span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      srv.latency_ms > 1000
                        ? "text-rose-400"
                        : srv.latency_ms > 300
                        ? "text-amber-400"
                        : "text-ink"
                    )}
                  >
                    {srv.latency_ms}ms
                  </span>
                </div>
                <div>
                  <span className="text-[0.6rem] text-faint block uppercase">Error Rate</span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      srv.error_rate > 5
                        ? "text-rose-400"
                        : srv.error_rate > 1
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {srv.error_rate}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.6rem] text-faint block uppercase">Throughput</span>
                  <span className="text-xs font-bold text-ink tabular-nums">
                    {srv.requests_per_sec}
                  </span>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="mt-3.5 flex items-center justify-between text-2xs font-mono text-faint pt-2 border-t border-line/40">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-muted" />
                  {srv.db_queries_per_req} queries/req
                </span>
                <span className="inline-flex items-center gap-1 text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  View Telemetry
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service Detail Drawer */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl border-l border-line bg-[#090d15] p-6 shadow-2xl overflow-y-auto font-mono">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <Server className="h-5 w-5 text-sky-400" />
                <div>
                  <h3 className="text-base font-bold text-ink">{selectedService.name}</h3>
                  <span className="text-2xs text-muted">ID: {selectedService.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Service Status and Overview */}
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-line bg-[#0c101b] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted uppercase">Operational State</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase",
                      selectedService.status === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : selectedService.status === "DEGRADED"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    )}
                  >
                    {selectedService.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-sans text-muted leading-relaxed">
                  {selectedService.description}
                </p>
              </div>

              {/* Metric Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Live Telemetry Vectors
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-line/80 bg-[#06080d] p-3">
                    <span className="text-[0.65rem] text-faint block">p95 LATENCY</span>
                    <span className="text-lg font-bold text-ink">{selectedService.latency_ms}ms</span>
                    <span className="text-[0.65rem] text-muted block mt-1">Target baseline: &lt;200ms</span>
                  </div>
                  <div className="rounded-lg border border-line/80 bg-[#06080d] p-3">
                    <span className="text-[0.65rem] text-faint block">ERROR RATIO</span>
                    <span className="text-lg font-bold text-ink">{selectedService.error_rate}%</span>
                    <span className="text-[0.65rem] text-muted block mt-1">SLO breach threshold: &gt;1%</span>
                  </div>
                  <div className="rounded-lg border border-line/80 bg-[#06080d] p-3">
                    <span className="text-[0.65rem] text-faint block">DB QUERY VOLUME</span>
                    <span className="text-lg font-bold text-ink">
                      {selectedService.db_queries_per_req} / req
                    </span>
                    <span className="text-[0.65rem] text-muted block mt-1">Normal: 2-3 per call</span>
                  </div>
                  <div className="rounded-lg border border-line/80 bg-[#06080d] p-3">
                    <span className="text-[0.65rem] text-faint block">REQUEST LOAD</span>
                    <span className="text-lg font-bold text-ink">
                      {selectedService.requests_per_sec}
                    </span>
                    <span className="text-[0.65rem] text-muted block mt-1">Distributed ingress load</span>
                  </div>
                </div>
              </div>

              {/* Deployment & Git */}
              <div>
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Active Deployment & Repo
                </h4>
                <div className="rounded-lg border border-line/80 bg-[#06080d] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-sky-400" />
                      Repository:
                    </span>
                    <span className="text-ink font-mono">{selectedService.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-purple-400" />
                      Release Tag:
                    </span>
                    <span className="text-ink font-mono">{selectedService.version}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedService.status === "CRITICAL" && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase mb-2">
                    <Radio className="h-4 w-4 animate-pulse" />
                    Active Incident Attached
                  </div>
                  <p className="text-2xs text-muted font-sans mb-3">
                    Automated investigation agents are actively correlating telemetry and repository diffs.
                  </p>
                  <Link
                    to="/investigate"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-rose-500 px-4 py-2 text-xs font-mono font-bold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors"
                  >
                    Open Live Investigation →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
