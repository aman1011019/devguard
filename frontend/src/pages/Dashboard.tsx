import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  FolderGit2,
  GitCommit,
  Github,
  Image as ImageIcon,
  Layers,
  Mic,
  MoreVertical,
  Plus,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { ConnectCodebaseModal } from "@/components/modals/ConnectCodebaseModal";
import { CommitDiffModal } from "@/components/modals/CommitDiffModal";
import { NewInvestigationModal } from "@/components/modals/NewInvestigationModal";
import { ReportIncidentModal } from "@/components/modals/ReportIncidentModal";
import { VoiceModal } from "@/components/modals/VoiceModal";
import { CameraModal } from "@/components/modals/CameraModal";
import { useRedLight } from "@/providers/RedLightProvider";
import {
  useActiveIncident,
  useHealth,
  useIncidents,
} from "@/hooks/useQueries";
import {
  useRealtimeStore,
  useActiveCodebase,
  refreshActiveCodebase,
} from "@/store/realtimeStore";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const navigate = useNavigate();
  const health = useHealth();
  const active = useActiveIncident();
  const incidents = useIncidents();

  // Realtime store hooks
  const services = useRealtimeStore((s) => s.services);
  const systemStats = useRealtimeStore((s) => s.systemStats);
  const activityEvents = useRealtimeStore((s) => s.activityEvents);
  const activeCodebase = useActiveCodebase();
  const { toggleRedLightMode } = useRedLight();

  // Modal states
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [defaultConnectTab, setDefaultConnectTab] = useState<"github" | "zip">("github");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<{
    sha: string;
    message?: string;
    author?: string;
  } | null>(null);

  // Time format
  const [currentTime, setCurrentTime] = useState({
    date: "Thu, Aug 21, 2025",
    time: "10:24 AM",
  });

  useEffect(() => {
    refreshActiveCodebase();
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setCurrentTime({ date: dateStr, time: timeStr });
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const incident = active.data ?? (incidents.data && incidents.data.length > 0 ? incidents.data[0] : null);
  const isRealIncident = Boolean(incident && !incident.is_demo);
  const isActive = incident !== null && incident.status !== "RESOLVED" && incident.status !== "CLOSED";

  // Real or high-fidelity KPI values matching Image 2
  const activeCount = systemStats.activeIncidents || (isActive ? (isRealIncident ? 1 : 4) : 4);
  const investigatingCount = systemStats.investigating || (activeCodebase ? 1 : 2);
  const criticalServicesCount = isRealIncident && (incident?.error_rate ?? 0) >= 5 ? 1 : 0;
  const resolvedCount = systemStats.resolvedToday || (health.data?.resolved_today ?? 18);

  const heroIncident = useMemo(() => {
    if (isRealIncident && incident) {
      const isCritical = (incident.error_rate ?? 0) >= 5.0 || incident.severity === "CRITICAL";
      return {
        id: `INC-${incident.id}`,
        title: incident.title,
        summary: incident.root_cause_summary || "Autonomous agents are investigating code and telemetry signals.",
        service: incident.service,
        errorRate: incident.error_rate ?? 0.04,
        latency: incident.latency_ms ? (incident.latency_ms > 1000 ? `${(incident.latency_ms / 1000).toFixed(1)}s` : `${Math.round(incident.latency_ms)}ms`) : "120ms",
        dbQueries: incident.db_queries_per_request ?? 2,
        requests: incident.requests_per_min ?? "1.4k / min",
        deployment: incident.deployment_version ?? "main@head",
        commit: incident.commit_sha?.substring(0, 7) ?? "main",
        author: incident.author ?? "Developer",
        repo: incident.repository || activeCodebase?.name || "Connected Repository",
        badge: isCritical ? "CRITICAL" : "INVESTIGATING",
        badgeBg: isCritical ? "bg-red-500" : "bg-blue-600",
        borderLeft: isCritical ? "border-l-red-500" : "border-l-blue-500",
        metricColor: isCritical ? "text-red-500" : "text-blue-600",
      };
    }

    if (activeCodebase) {
      const repoShort = activeCodebase.name.split("/").pop()?.replace(/[-_]/g, " ")?.replace(/\b\w/g, (c) => c.toUpperCase()) || activeCodebase.name;
      const isHealthy = (activeCodebase.health_score ?? 98) >= 90;
      return {
        id: `REPO-${activeCodebase.commit_sha?.substring(0, 5) || "LIVE"}`,
        title: `Codebase Inspection · ${activeCodebase.name}`,
        summary: `Direct in-memory inspection active on ${activeCodebase.branch}. Scanned ${activeCodebase.total_files} files with 0 disk storage (${activeCodebase.health_score}% health score).`,
        service: repoShort,
        errorRate: 0.04,
        latency: "120ms",
        dbQueries: 2,
        requests: "1.4k / min",
        deployment: `${activeCodebase.branch}@${activeCodebase.commit_sha?.substring(0, 7) || "head"}`,
        commit: activeCodebase.commit_sha?.substring(0, 7) || "main",
        author: activeCodebase.author || "Developer",
        repo: activeCodebase.name,
        badge: isHealthy ? "OPTIMAL" : "INVESTIGATING",
        badgeBg: isHealthy ? "bg-emerald-600" : "bg-blue-600",
        borderLeft: isHealthy ? "border-l-emerald-500" : "border-l-blue-500",
        metricColor: isHealthy ? "text-emerald-600" : "text-blue-600",
      };
    }

    return {
      id: "INC-001",
      title: "Checkout API Failure",
      summary: "Elevated error rate after deployment v1.8.4. Autonomous agents are investigating.",
      service: "Checkout API",
      errorRate: 21.8,
      latency: "4.8s",
      dbQueries: 25,
      requests: "12.4k / min",
      deployment: "v1.8.4",
      commit: "fb8ac60",
      author: "j.tanaka",
      repo: "devguard/checkout",
      badge: "CRITICAL",
      badgeBg: "bg-red-500",
      borderLeft: "border-l-red-500",
      metricColor: "text-red-500",
    };
  }, [incident, isRealIncident, activeCodebase]);

  // Service Health Data matching Image 2
  const defaultServices = [
    { name: "Checkout API", status: "Critical", errorRate: "21.8%", latency: "4.8s", isCritical: true },
    { name: "Payments API", status: "Healthy", errorRate: "0.3%", latency: "180ms", isHealthy: true },
    { name: "Auth Service", status: "Healthy", errorRate: "0.1%", latency: "42ms", isHealthy: true },
    { name: "Orders Service", status: "Degraded", errorRate: "4.2%", latency: "680ms", isDegraded: true },
    { name: "Database", status: "Degraded", errorRate: "2.8%", latency: "320ms", isDegraded: true },
  ];

  const displayServices = useMemo(() => {
    if (activeCodebase) {
      const repoShort = activeCodebase.name.split("/").pop()?.replace(/[-_]/g, " ")?.replace(/\b\w/g, (c) => c.toUpperCase()) || activeCodebase.name;
      return [
        { name: repoShort, status: "Healthy", errorRate: "0.04%", latency: "120ms", isHealthy: true },
        { name: "Payments API", status: "Healthy", errorRate: "0.3%", latency: "180ms", isHealthy: true },
        { name: "Auth Service", status: "Healthy", errorRate: "0.1%", latency: "42ms", isHealthy: true },
        { name: "Orders Service", status: "Healthy", errorRate: "0.8%", latency: "110ms", isHealthy: true },
        { name: "Database Cluster", status: "Healthy", errorRate: "0.01%", latency: "18ms", isHealthy: true },
      ];
    }
    return defaultServices;
  }, [activeCodebase]);

  // Live Activity Events matching Image 2
  const defaultEvents = [
    {
      time: "10:24:12",
      icon: Activity,
      iconColor: "bg-red-50 text-red-600",
      actor: "Telemetry",
      detail: "Latency spike detected (4800ms)",
    },
    {
      time: "10:24:10",
      icon: FileText,
      iconColor: "bg-blue-50 text-blue-600",
      actor: "Log Agent",
      detail: "Found 12 error patterns",
    },
    {
      time: "10:24:08",
      icon: Code2,
      iconColor: "bg-purple-50 text-purple-600",
      actor: "Code Agent",
      detail: "Analyzing commit fb8ac60",
    },
    {
      time: "10:24:05",
      icon: Sparkles,
      iconColor: "bg-amber-50 text-amber-600",
      actor: "DevGuard",
      detail: "Investigation started",
    },
    {
      time: "10:24:02",
      icon: Github,
      iconColor: "bg-slate-100 text-slate-700",
      actor: "GitHub",
      detail: "Workflow run failed",
    },
    {
      time: "10:23:58",
      icon: Rocket,
      iconColor: "bg-sky-50 text-sky-600",
      actor: "Deployment",
      detail: "v1.8.4 deployed",
    },
    {
      time: "10:23:54",
      icon: AlertTriangle,
      iconColor: "bg-red-50 text-red-600",
      actor: "Error Rate",
      detail: "Crossed threshold (21.8%)",
    },
  ];

  const displayEvents = useMemo(() => {
    if (activeCodebase) {
      return [
        {
          time: "Just now",
          icon: Github,
          iconColor: "bg-blue-50 text-blue-600",
          actor: "GitHub",
          detail: `Connected repository ${activeCodebase.name} (${activeCodebase.branch})`,
        },
        {
          time: "1m ago",
          icon: Code2,
          iconColor: "bg-purple-50 text-purple-600",
          actor: "Code Scanner",
          detail: `Zero-storage scan indexed ${activeCodebase.total_files} files (${activeCodebase.health_score}% health)`,
        },
        ...defaultEvents.slice(2),
      ];
    }
    return defaultEvents;
  }, [activeCodebase]);

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      {/* ── 1. Page Header matching Image 2 ────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>COMMAND CENTER</span>
            <ArrowRight className="h-3 w-3" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Your Production Incident Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Detect. Investigate. Resolve. Faster.
          </p>
        </div>

        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 font-medium">
              {currentTime.date}
            </div>
            <div className="text-xs font-semibold text-slate-700">
              {currentTime.time}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setInvestigationModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Investigation</span>
          </button>
        </div>
      </section>

      {/* ── 2. Top 4 KPI Cards Grid ───────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Incidents */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {activeCount}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Active Incidents
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
              <ArrowUp className="h-3 w-3" /> 2
            </span>
            <div className="text-[10px] text-slate-400">vs last hour</div>
          </div>
        </div>

        {/* Investigating */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {investigatingCount}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Investigating
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 font-medium">
            AI agents running
          </div>
        </div>

        {/* Critical Services */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {criticalServicesCount}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Critical Services
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 font-medium">
            of 5 services
          </div>
        </div>

        {/* Resolved Today */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {resolvedCount}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Resolved Today
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
              <ArrowUp className="h-3 w-3" /> 6
            </span>
            <div className="text-[10px] text-slate-400">vs yesterday</div>
          </div>
        </div>
      </section>

      {/* ── 3. Middle Section: Hero Spotlight & Service Health ─────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Hero Card + Trend */}
        <div className="lg:col-span-8 space-y-6">
          {/* Spotlight Hero Card */}
          <div className={cn("rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs relative overflow-hidden border-l-4", heroIncident.borderLeft)}>
            {/* Top row of badges */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider", heroIncident.badgeBg)}>
                  <span>✦</span> {heroIncident.badge}
                </span>
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {heroIncident.id}
                </span>
                <span className="text-xs text-slate-400">
                  Active in-memory inspection
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", heroIncident.badge === "CRITICAL" ? "bg-red-500" : "bg-emerald-500")} />
                  {heroIncident.service}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Production
                </span>
              </div>
            </div>

            {/* Title & Action */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {heroIncident.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {heroIncident.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(incident?.id ? `/incidents/${incident.id}` : "/investigate")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-1.5 transition cursor-pointer shadow-2xs"
                >
                  <span>Open Investigation</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 4 Sparkline / Metric cards inside Hero Card */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Error Rate */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 relative overflow-hidden">
                <div className="text-xs text-slate-500">Error Rate</div>
                <div className={cn("text-xl font-bold mt-1", heroIncident.metricColor)}>
                  {heroIncident.errorRate}%
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn("text-[11px] font-bold", heroIncident.metricColor)}>
                    {heroIncident.badge === "CRITICAL" ? "↑ +2080%" : "✓ Healthy"}
                  </span>
                  {/* Mini Sparkline */}
                  <svg className={cn("w-14 h-5", heroIncident.metricColor)} viewBox="0 0 60 20" fill="none">
                    <path
                      d={heroIncident.badge === "CRITICAL" ? "M2 18 L15 17 L25 15 L35 12 L45 8 L58 3" : "M2 12 L15 12 L25 11 L35 12 L45 11 L58 11"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Latency */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 relative overflow-hidden">
                <div className="text-xs text-slate-500">Latency</div>
                <div className={cn("text-xl font-bold mt-1", heroIncident.metricColor)}>
                  {heroIncident.latency}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn("text-[11px] font-bold", heroIncident.metricColor)}>
                    {heroIncident.badge === "CRITICAL" ? "↑ +2300%" : "✓ Fast"}
                  </span>
                  <svg className={cn("w-14 h-5", heroIncident.metricColor)} viewBox="0 0 60 20" fill="none">
                    <path
                      d={heroIncident.badge === "CRITICAL" ? "M2 18 L18 17 L30 16 L40 10 L48 6 L58 2" : "M2 10 L18 10 L30 9 L40 10 L48 9 L58 9"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* DB Queries */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 relative overflow-hidden">
                <div className="text-xs text-slate-500">DB Queries</div>
                <div className={cn("text-xl font-bold mt-1", heroIncident.metricColor)}>
                  {heroIncident.dbQueries} <span className="text-xs font-normal text-slate-400">/ req</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn("text-[11px] font-bold", heroIncident.metricColor)}>
                    {heroIncident.badge === "CRITICAL" ? "↑ +733%" : "✓ 0 N+1"}
                  </span>
                  <svg className={cn("w-14 h-5", heroIncident.metricColor)} viewBox="0 0 60 20" fill="none">
                    <path
                      d={heroIncident.badge === "CRITICAL" ? "M2 17 L16 16 L28 14 L40 11 L50 7 L58 4" : "M2 11 L16 11 L28 11 L40 11 L50 11 L58 11"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Requests */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 relative overflow-hidden">
                <div className="text-xs text-slate-500">Requests</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {heroIncident.requests}
                </div>
                <div className="flex items-end justify-between mt-2 h-4 gap-1">
                  <span className="w-1.5 h-2 bg-blue-300 rounded-xs" />
                  <span className="w-1.5 h-3 bg-blue-300 rounded-xs" />
                  <span className="w-1.5 h-2.5 bg-blue-400 rounded-xs" />
                  <span className="w-1.5 h-4 bg-blue-500 rounded-xs" />
                  <span className="w-1.5 h-3.5 bg-blue-400 rounded-xs" />
                  <span className="w-1.5 h-4 bg-blue-600 rounded-xs" />
                  <span className="w-1.5 h-3.5 bg-blue-500 rounded-xs" />
                </div>
              </div>
            </div>

            {/* Footer Metadata row */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <span>Service</span>
                <span className="font-semibold text-slate-800">
                  {heroIncident.service}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-slate-400" />
                <span>Deployment</span>
                <span className="font-semibold text-slate-800">
                  {heroIncident.deployment}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-slate-400" />
                <span>Repository</span>
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(true)}
                  className="font-semibold text-slate-800 hover:text-blue-600 transition underline decoration-dotted"
                >
                  {heroIncident.repo}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-slate-400" />
                <span>Commit</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCommit({
                      sha: heroIncident.commit,
                      message: "fix(checkout): adjust query batch size and connection pool",
                      author: heroIncident.author,
                    })
                  }
                  className="font-mono font-semibold text-blue-600 hover:underline"
                >
                  {heroIncident.commit}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <span>Author</span>
                <span className="font-semibold text-slate-800">
                  {heroIncident.author}
                </span>
              </div>
            </div>
          </div>

          {/* Error Rate Trend Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">
                Error Rate Trend
              </h3>
              <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-3 py-1 rounded-lg text-xs font-medium text-slate-700">
                <span>Last 1 hour</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* SVG Area Chart */}
            <div className="w-full relative pt-2">
              <svg
                viewBox="0 0 600 180"
                className="w-full h-44 overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="errorAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-axis grid lines & labels */}
                <line x1="40" y1="20" x2="590" y2="20" stroke="currentColor" strokeOpacity="0.07" />
                <text x="5" y="24" fontSize="10" fill="#94a3b8" textAnchor="start">30%</text>

                <line x1="40" y1="65" x2="590" y2="65" stroke="currentColor" strokeOpacity="0.07" />
                <text x="5" y="69" fontSize="10" fill="#94a3b8" textAnchor="start">20%</text>

                <line x1="40" y1="110" x2="590" y2="110" stroke="currentColor" strokeOpacity="0.07" />
                <text x="5" y="114" fontSize="10" fill="#94a3b8" textAnchor="start">10%</text>

                <line x1="40" y1="155" x2="590" y2="155" stroke="currentColor" strokeOpacity="0.07" />
                <text x="12" y="158" fontSize="10" fill="#94a3b8" textAnchor="start">0%</text>

                {/* Area Fill */}
                <path
                  d="M 40 150 
                     L 80 148 L 120 149 L 160 146 L 200 145 L 240 142 L 280 140 
                     L 310 135 L 340 130 L 370 115 L 400 95 L 430 85 L 470 78 L 510 68 L 550 63 L 590 58 
                     L 590 155 L 40 155 Z"
                  fill="url(#errorAreaGradient)"
                />

                {/* Main Red Curve Line */}
                <path
                  d="M 40 150 
                     C 100 148, 160 146, 220 144
                     C 280 140, 310 134, 340 125
                     C 370 112, 395 92, 420 86
                     C 450 80, 500 68, 590 58"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Vertical Dashed Deployment Marker at 10:12 */}
                <line
                  x1="400"
                  y1="35"
                  x2="400"
                  y2="155"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                {/* Marker Dot on curve */}
                <circle cx="400" cy="95" r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />

                {/* Marker Label */}
                <text
                  x="400"
                  y="28"
                  fontSize="10"
                  fill="#64748b"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  Deployment v1.8.4
                </text>
              </svg>

              {/* X-axis Timestamps */}
              <div className="flex justify-between pl-8 pr-2 pt-2 text-[11px] text-slate-400 font-mono">
                <span>09:30</span>
                <span>09:45</span>
                <span>10:00</span>
                <span>10:15</span>
                <span>10:30</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Service Health + Live Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Service Health Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">
                Service Health
              </h3>
              <Link
                to="/services"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 pb-2">
                    <th className="pb-2 font-normal">Service</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal">Error Rate</th>
                    <th className="pb-2 font-normal text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayServices.map((svc) => (
                    <tr key={svc.name} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 font-medium text-slate-800 flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            svc.isCritical
                              ? "bg-red-500"
                              : svc.isDegraded
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                        />
                        <span className="truncate">{svc.name}</span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            "text-[11px] font-medium flex items-center gap-1",
                            svc.isCritical
                              ? "text-red-500"
                              : svc.isDegraded
                              ? "text-amber-500"
                              : "text-emerald-500"
                          )}
                        >
                          <span>◆</span> {svc.status}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 font-medium",
                          svc.isCritical ? "text-red-500 font-semibold" : "text-slate-600"
                        )}
                      >
                        {svc.errorRate}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-medium",
                          svc.isCritical ? "text-red-500 font-semibold" : "text-slate-600"
                        )}
                      >
                        {svc.latency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Activity Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Live Activity
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Streaming
                </span>
              </div>

              <Link
                to="/activity"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Vertical timeline */}
            <div className="relative pl-6 space-y-4">
              {/* Connecting vertical line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-200" />

              {displayEvents.map((evt, idx) => {
                const Icon = evt.icon;
                return (
                  <div key={idx} className="relative flex items-center justify-between gap-3 text-xs">
                    {/* Circle marker on line */}
                    <div
                      className={cn(
                        "absolute -left-6 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-white",
                        evt.iconColor
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {evt.time}
                      </span>
                      <span className="font-bold text-slate-800 shrink-0">
                        {evt.actor}
                      </span>
                      <span className="text-slate-500 truncate">
                        {evt.detail}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Bottom Quick Actions 5-Card Grid ───────────── */}
      <section className="space-y-3">
        <h3 className="font-bold text-base text-slate-900">
          Quick Actions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Connect GitHub */}
          <button
            type="button"
            onClick={() => {
              setDefaultConnectTab("github");
              setConnectModalOpen(true);
            }}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 hover:border-blue-400 hover:shadow-sm transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Github className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Connect GitHub
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Link your repository
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Upload Codebase */}
          <button
            type="button"
            onClick={() => {
              setDefaultConnectTab("zip");
              setConnectModalOpen(true);
            }}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 hover:border-blue-400 hover:shadow-sm transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Upload className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Upload Codebase
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Analyze a ZIP file
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Paste Logs */}
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 hover:border-blue-400 hover:shadow-sm transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Paste Logs
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Investigate from logs
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Voice Input */}
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 hover:border-blue-400 hover:shadow-sm transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Mic className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Voice Input
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Describe the issue
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
          </button>

          {/* Scan Screenshot */}
          <button
            type="button"
            onClick={() => setCameraModalOpen(true)}
            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 hover:border-blue-400 hover:shadow-sm transition text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Scan Screenshot
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  OCR and analyze
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </section>

      {/* ── 5. Page Footer ────────────────────────────────── */}
      <footer className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200/60">
        <div className="flex items-center gap-2">
          <span>Powered by DevGuard Autonomous Diagnostic Engine</span>
          <span>•</span>
          <span className="text-slate-400">v2.0.0</span>
        </div>

        <button
          type="button"
          onClick={toggleRedLightMode}
          className="text-blue-600 hover:underline font-medium cursor-pointer"
        >
          Learn about Red Light Mode →
        </button>
      </footer>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <NewInvestigationModal
        open={investigationModalOpen}
        onClose={() => setInvestigationModalOpen(false)}
        defaultRepo={activeCodebase?.repository || ""}
      />
      <ConnectCodebaseModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        initialTab={defaultConnectTab}
      />
      <ReportIncidentModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
      <VoiceModal
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
      />
      <CameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
      />
      <CommitDiffModal
        commit={selectedCommit}
        onClose={() => setSelectedCommit(null)}
      />
    </div>
  );
}
