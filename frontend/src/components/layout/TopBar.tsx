import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Camera,
  Mic,
  PlusCircle,
  Radio,
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { CameraModal } from "@/components/modals/CameraModal";
import { VoiceModal } from "@/components/modals/VoiceModal";
import { SearchModal } from "@/components/modals/SearchModal";
import { ReportIncidentModal } from "@/components/modals/ReportIncidentModal";
import { useRedLight } from "@/providers/RedLightProvider";
import { useRealtimeStore, setDataSource } from "@/store/realtimeStore";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const TITLES: [string, string, string][] = [
  ["/incidents/", "Incident Investigation", "Real-time agent swarm & evidence telemetry"],
  ["/incidents", "Incident Catalog", "All active & monitored system incidents"],
  ["/investigate", "Incident Investigation", "Live agent telemetry & diagnostic stream"],
  ["/services", "Service Catalog", "Real-time latency, error rates, and cluster posture"],
  ["/activity", "System Activity Stream", "Real-time audit log and agent event bus"],
  ["/history", "Incident History", "Resolved incidents and MTTR metrics"],
  ["/settings", "Command Settings", "Bridges, API tokens, and AI configuration"],
  ["/inspector", "Codebase Inspector", "Static AST analysis and architectural graphs"],
  ["/", "Incident Command Center", "Live production health and active investigations"],
];

const titleFor = (path: string) =>
  TITLES.find(([prefix]) => (prefix === "/" ? path === "/" : path.startsWith(prefix))) ??
  ["", "DevGuard", ""];

export function TopBar({ socketStatus }: { socketStatus?: string }) {
  const { pathname } = useLocation();
  const [, title, subtitle] = titleFor(pathname);

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { redLightMode, toggleRedLightMode } = useRedLight();

  // Reactive state from realtimeStore
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);
  const dataSource = useRealtimeStore((s) => s.dataSource);

  // Keyboard shortcut listener for Search (Cmd+K / Ctrl+K / "/")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isLive = connectionStatus === "LIVE";
  const isReconnecting = connectionStatus === "RECONNECTING";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl pt-safe">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-7">
          {/* Mobile Logo */}
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="DevGuard home">
            <DevGuardLogo size={28} showText />
          </Link>

          {/* Desktop Title Header */}
          <div className="hidden min-w-0 lg:block">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-sm font-bold tracking-tight text-ink font-mono uppercase">
                {title}
              </h1>
              <span className="inline-block h-3 w-px bg-line/80" />
              <span className="truncate text-xs font-mono text-muted">
                {subtitle}
              </span>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Global Search Trigger (Cmd+K) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-elevated/80 px-2.5 py-1.5 text-xs text-muted transition-all hover:border-brand/40 hover:text-ink hover:bg-elevated"
              title="Search incidents, services, commits (⌘K or /)"
            >
              <Search className="h-3.5 w-3.5 text-muted shrink-0" />
              <span className="hidden sm:inline font-mono text-2xs">Quick search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-line/80 bg-canvas/60 px-1.5 py-0.5 text-[0.65rem] font-mono text-faint">
                <span className="text-[0.6rem]">⌘</span>K
              </kbd>
            </button>

            {/* Report Incident Action Button */}
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-mono font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50"
              title="Manually report a system incident"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline uppercase text-2xs tracking-wider">Report</span>
            </button>

            {/* Data Source Badge (Truthful: LIVE GITHUB vs DEMO ENGINE) */}
            <button
              type="button"
              onClick={() =>
                setDataSource(
                  dataSource === "LIVE GITHUB" ? "DEMO ENGINE" : "LIVE GITHUB"
                )
              }
              title={`Active Data Source: ${dataSource} (Click to toggle)`}
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs font-mono font-bold uppercase tracking-wider transition-all",
                dataSource === "LIVE GITHUB"
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
              )}
            >
              <GitBranch className="h-3 w-3" />
              <span>{dataSource}</span>
            </button>

            {/* Connection Status Pill */}
            <div
              title={`Connection: ${connectionStatus}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs font-mono font-bold uppercase tracking-wider",
                isLive && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                isReconnecting && "border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse",
                !isLive && !isReconnecting && "border-rose-500/40 bg-rose-500/10 text-rose-400"
              )}
            >
              {isLive && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>LIVE</span>
                </>
              )}
              {isReconnecting && (
                <>
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  <span className="hidden sm:inline">RECONNECTING</span>
                </>
              )}
              {!isLive && !isReconnecting && (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>

            {/* Red Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleRedLightMode}
              title={
                redLightMode
                  ? "Red Light Mode Active (Critical Incident Posture)"
                  : "Enable Red Light Mode (No Laptop Required)"
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs font-mono font-bold uppercase tracking-wider transition-all duration-200",
                redLightMode
                  ? "border-bad/50 bg-bad/15 text-bad shadow-glow animate-pulse"
                  : "border-line bg-elevated text-muted hover:border-strong hover:text-ink"
              )}
            >
              <Radio className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Red Light</span>
            </button>

            {/* Voice & Camera Modals */}
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              aria-label="Voice command"
              title="Voice command interface"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-elevated text-muted transition-colors hover:border-brand/40 hover:text-ink"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              aria-label="Analyze a screenshot"
              title="Analyze incident screenshot / log snapshot"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-elevated text-muted transition-colors hover:border-brand/40 hover:text-ink"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </button>

            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ReportIncidentModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} />
    </>
  );
}
