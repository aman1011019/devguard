import { useState, useMemo } from "react";
import {
  Activity,
  Terminal,
  Filter,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Clock,
  Radio,
} from "lucide-react";
import { useRealtimeStore, clearEvents, type ActivityEvent } from "@/store/realtimeStore";
import { cn } from "@/lib/utils";

const formatTime = (ts: string) => {
  if (!ts) return "—";
  if (ts.includes(":") && !ts.includes("T") && !ts.includes("-")) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export default function ActivityPage() {
  const events = useRealtimeStore((s) => s.activityEvents);
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);

  const [filter, setFilter] = useState<string>("ALL");
  const [isPaused, setIsPaused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter categories
  const filteredEvents = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter((e) => {
      const type = (e.type || e.event || "").toLowerCase();
      if (filter === "INCIDENT") return type.includes("incident");
      if (filter === "METRIC") return type.includes("metric") || type.includes("healthy") || type.includes("recovering");
      if (filter === "AGENT") return type.includes("agent") || type.includes("hypothesis") || type.includes("root_cause");
      if (filter === "LOG") return type.includes("log");
      if (filter === "DEPLOY") return type.includes("deploy") || type.includes("github");
      return true;
    });
  }, [events, filter]);

  const copyEvent = (e: ActivityEvent) => {
    navigator.clipboard.writeText(JSON.stringify(e, null, 2));
    setCopiedId(e.event_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
              System Activity & Event Bus Stream
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Real-time event log published across DevGuard agents, telemetry collectors, and GitHub webhooks.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-2xs font-bold uppercase",
              connectionStatus === "LIVE"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            <Radio className="h-3 w-3 animate-pulse" />
            <span>{connectionStatus}</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-2xs font-bold uppercase transition-colors",
              isPaused
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-100/70 text-slate-700 hover:bg-slate-200/70"
            )}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            onClick={clearEvents}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-2xs text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
            title="Clear buffer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs">
        <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
        {["ALL", "INCIDENT", "METRIC", "AGENT", "LOG", "DEPLOY"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1 font-bold uppercase tracking-wider transition-all",
              filter === f
                ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-2xs text-slate-400">
          Showing {filteredEvents.length} events
        </span>
      </div>

      {/* Event Stream Terminal Window */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Terminal Titlebar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5 text-2xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="ml-2 font-bold text-slate-600 uppercase tracking-wider">
              /dev/events/system-stream
            </span>
          </div>
          <span className="text-slate-400 text-[0.65rem]">
            AUTO-SCROLL: {isPaused ? "OFF" : "ON"}
          </span>
        </div>

        {/* Event List */}
        <div className="max-h-[680px] overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Activity className="mx-auto h-8 w-8 text-slate-300 animate-pulse" />
              <p className="mt-2 text-xs">Listening for real-time events on WebSocket bus...</p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isExpanded = expandedId === evt.event_id;
              const type = evt.type || evt.event || "event";
              const isIncident = type.includes("incident");
              const isMetric = type.includes("metric") || type.includes("healthy");
              const isAgent = type.includes("agent") || type.includes("root_cause") || type.includes("hypothesis");

              return (
                <div
                  key={evt.event_id}
                  className="rounded-lg p-2.5 transition-colors hover:bg-slate-50/80"
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : evt.event_id)}
                    className="flex cursor-pointer items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}

                      {/* Event ID */}
                      <span className="text-blue-600 text-2xs font-bold shrink-0">
                        {evt.event_id}
                      </span>

                      {/* Type Badge */}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider shrink-0",
                          isIncident
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isMetric
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isAgent
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200"
                        )}
                      >
                        {type}
                      </span>

                      {/* Message or Service */}
                      <span className="truncate text-slate-800 text-2xs font-sans">
                        {evt.message || evt.detail?.title || evt.service || "Event published"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[0.65rem] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(evt.timestamp)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyEvent(evt);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Copy Event JSON"
                      >
                        {copiedId === evt.event_id ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-2xs">
                      <div className="flex items-center justify-between text-[0.65rem] text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        <span>PAYLOAD INSPECTOR</span>
                        <span>CHANNEL: {evt.incident_id ? `incident_${evt.incident_id}` : "system"}</span>
                      </div>
                      <pre className="overflow-x-auto text-slate-800 font-mono text-[0.7rem] leading-relaxed">
                        {JSON.stringify(evt, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
