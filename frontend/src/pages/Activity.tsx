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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold uppercase tracking-tight text-ink">
              System Activity & Event Bus Stream
            </h1>
          </div>
          <p className="text-xs text-muted mt-0.5 font-sans">
            Real-time event log published across DevGuard agents, telemetry collectors, and GitHub webhooks.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-2xs font-bold uppercase",
              connectionStatus === "LIVE"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
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
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-line bg-elevated text-muted hover:text-ink"
            )}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            onClick={clearEvents}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1 text-2xs text-muted hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            title="Clear buffer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs">
        <Filter className="h-3.5 w-3.5 text-muted shrink-0 mr-1" />
        {["ALL", "INCIDENT", "METRIC", "AGENT", "LOG", "DEPLOY"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1 font-bold uppercase tracking-wider transition-all",
              filter === f
                ? "bg-brand/20 text-sky-400 border border-brand/40 shadow-sm"
                : "text-muted hover:bg-elevated hover:text-ink"
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-2xs text-faint">
          Showing {filteredEvents.length} events
        </span>
      </div>

      {/* Event Stream Terminal Window */}
      <div className="rounded-xl border border-line/80 bg-[#070a10] shadow-2xl overflow-hidden">
        {/* Terminal Titlebar */}
        <div className="flex items-center justify-between border-b border-line/60 bg-[#0d121c] px-4 py-2.5 text-2xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            <span className="ml-2 font-bold text-muted uppercase tracking-wider">
              /dev/events/system-stream
            </span>
          </div>
          <span className="text-faint text-[0.65rem]">
            AUTO-SCROLL: {isPaused ? "OFF" : "ON"}
          </span>
        </div>

        {/* Event List */}
        <div className="max-h-[680px] overflow-y-auto divide-y divide-line/30 p-2 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <Activity className="mx-auto h-8 w-8 text-faint animate-pulse" />
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
                  className="rounded-lg p-2.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : evt.event_id)}
                    className="flex cursor-pointer items-start justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                      )}

                      {/* Event ID */}
                      <span className="text-sky-400/90 text-2xs font-bold shrink-0">
                        {evt.event_id}
                      </span>

                      {/* Type Badge */}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider shrink-0",
                          isIncident
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : isMetric
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isAgent
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                        )}
                      >
                        {type}
                      </span>

                      {/* Message or Service */}
                      <span className="truncate text-ink text-2xs font-sans">
                        {evt.message || evt.detail?.title || evt.service || "Event published"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[0.65rem] text-faint flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyEvent(evt);
                        }}
                        className="rounded p-1 text-muted hover:text-ink hover:bg-elevated transition-colors"
                        title="Copy Event JSON"
                      >
                        {copiedId === evt.event_id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="mt-2.5 rounded-lg border border-line/60 bg-[#04060a] p-3 text-2xs">
                      <div className="flex items-center justify-between text-[0.65rem] text-faint border-b border-line/40 pb-1 mb-2">
                        <span>PAYLOAD INSPECTOR</span>
                        <span>CHANNEL: {evt.incident_id ? `incident_${evt.incident_id}` : "system"}</span>
                      </div>
                      <pre className="overflow-x-auto text-sky-300/90 font-mono text-[0.7rem] leading-relaxed">
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
