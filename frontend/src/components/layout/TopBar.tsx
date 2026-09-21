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
import { ConnectCodebaseModal } from "@/components/modals/ConnectCodebaseModal";
import { useRedLight } from "@/providers/RedLightProvider";
import { useRealtimeStore, useActiveCodebase } from "@/store/realtimeStore";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";

const TITLES: [string, string, string][] = [
  ["/incidents/", "Incident Investigation", "Real-time agent swarm & evidence telemetry"],
  ["/incidents", "Incident Catalog", "All active & monitored system incidents"],
  ["/investigate", "Incident Investigation", "Live agent telemetry & diagnostic stream"],
  ["/services", "Service Catalog", "Real-time latency, error rates, and cluster posture"],
  ["/repositories", "Repositories", "Connected GitHub codebases & archive inspector"],
  ["/activity", "System Activity Stream", "Real-time audit log and agent event bus"],
  ["/history", "Incident History", "Resolved incidents and MTTR metrics"],
  ["/settings", "Command Settings", "Bridges, API tokens, and AI configuration"],
  ["/inspector", "Codebase Inspector", "Static AST analysis and architectural graphs"],
  ["/dashboard", "Incident Command Center", "Live production health and active investigations"],
  ["/", "DevGuard Home", "Enterprise incident guardrails, connected codebases & live diagnostics"],
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
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const { redLightMode, toggleRedLightMode } = useRedLight();

  // Reactive state from realtimeStore
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus);
  const activeCodebase = useActiveCodebase();

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
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md pt-safe">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* Mobile Logo */}
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="DevGuard home">
            <DevGuardLogo size={28} showText />
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all text-left group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
                <span className="truncate text-slate-500 font-normal">
                  Search incidents, services, commits, logs, or ask DevGuard...
                </span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-2xs shrink-0">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell with red badge */}
            <NotificationBell />

            {/* Production Status Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Production</span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ReportIncidentModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
      <ConnectCodebaseModal open={connectModalOpen} onClose={() => setConnectModalOpen(false)} />
      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} />
    </>
  );
}
