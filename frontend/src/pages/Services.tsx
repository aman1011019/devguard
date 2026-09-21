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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold font-mono uppercase tracking-tight text-slate-900">
              Service Catalog & Cluster Mesh
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-500 mt-1">
            Real-time topology, p95 latency, error rates, and live health telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-mono font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{healthyCount} HEALTHY</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-mono font-bold text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{degradedCount} DEGRADED</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-mono font-bold text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
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
                "group relative cursor-pointer rounded-xl border bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                isCritical
                  ? "border-rose-300 hover:border-rose-400 hover:shadow-rose-50"
                  : isDegraded
                  ? "border-amber-300 hover:border-amber-400 hover:shadow-amber-50"
                  : "border-slate-200 hover:border-blue-400 hover:shadow-blue-50"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold font-mono text-slate-900 group-hover:text-blue-600 transition-colors">
                      {srv.name}
                    </h2>
                    <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-mono text-slate-600">
                      {srv.version}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 font-sans leading-relaxed">
                    {srv.description}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider",
                    isCritical
                      ? "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                      : isDegraded
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 font-mono text-2xs">
                <div>
                  <span className="text-[0.6rem] text-slate-400 block uppercase font-medium">p95 Latency</span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      srv.latency_ms > 1000
                        ? "text-rose-600"
                        : srv.latency_ms > 300
                        ? "text-amber-600"
                        : "text-slate-900"
                    )}
                  >
                    {srv.latency_ms}ms
                  </span>
                </div>
                <div>
                  <span className="text-[0.6rem] text-slate-400 block uppercase font-medium">Error Rate</span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      srv.error_rate > 5
                        ? "text-rose-600"
                        : srv.error_rate > 1
                        ? "text-amber-600"
                        : "text-emerald-700"
                    )}
                  >
                    {srv.error_rate}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.6rem] text-slate-400 block uppercase font-medium">Throughput</span>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {srv.requests_per_sec}
                  </span>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="mt-3.5 flex items-center justify-between text-2xs font-mono text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1 text-slate-500">
                  <Database className="h-3 w-3 text-slate-400" />
                  {srv.db_queries_per_req} queries/req
                </span>
                <span className="inline-flex items-center gap-1 text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
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
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl border-l border-slate-200 bg-white p-6 shadow-2xl overflow-y-auto font-mono">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <Server className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedService.name}</h3>
                  <span className="text-2xs text-slate-500">ID: {selectedService.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Service Status and Overview */}
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase">Operational State</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase",
                      selectedService.status === "CRITICAL"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : selectedService.status === "DEGRADED"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}
                  >
                    {selectedService.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-sans text-slate-600 leading-relaxed">
                  {selectedService.description}
                </p>
              </div>

              {/* Metric Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Live Telemetry Vectors
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[0.65rem] text-slate-400 block uppercase font-medium">p95 LATENCY</span>
                    <span className="text-lg font-bold text-slate-900">{selectedService.latency_ms}ms</span>
                    <span className="text-[0.65rem] text-slate-500 block mt-1">Target baseline: &lt;200ms</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[0.65rem] text-slate-400 block uppercase font-medium">ERROR RATIO</span>
                    <span className="text-lg font-bold text-slate-900">{selectedService.error_rate}%</span>
                    <span className="text-[0.65rem] text-slate-500 block mt-1">SLO breach threshold: &gt;1%</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[0.65rem] text-slate-400 block uppercase font-medium">DB QUERY VOLUME</span>
                    <span className="text-lg font-bold text-slate-900">
                      {selectedService.db_queries_per_req} / req
                    </span>
                    <span className="text-[0.65rem] text-slate-500 block mt-1">Normal: 2-3 per call</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[0.65rem] text-slate-400 block uppercase font-medium">REQUEST LOAD</span>
                    <span className="text-lg font-bold text-slate-900">
                      {selectedService.requests_per_sec}
                    </span>
                    <span className="text-[0.65rem] text-slate-500 block mt-1">Distributed ingress load</span>
                  </div>
                </div>
              </div>

              {/* Deployment & Git */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Active Deployment & Repo
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-blue-600" />
                      Repository:
                    </span>
                    <span className="text-slate-900 font-mono font-medium">{selectedService.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-purple-600" />
                      Release Tag:
                    </span>
                    <span className="text-slate-900 font-mono font-medium">{selectedService.version}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedService.status === "CRITICAL" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-rose-700 text-xs font-bold uppercase mb-2">
                    <Radio className="h-4 w-4 animate-pulse" />
                    Active Incident Attached
                  </div>
                  <p className="text-2xs text-slate-600 font-sans mb-3">
                    Automated investigation agents are actively correlating telemetry and repository diffs.
                  </p>
                  <Link
                    to="/investigate"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-rose-600 px-4 py-2 text-xs font-mono font-bold text-white shadow-md shadow-rose-200 hover:bg-rose-700 transition-colors"
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
