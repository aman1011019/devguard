import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, Mic, Radio, Wifi, WifiOff } from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { CameraModal } from "@/components/modals/CameraModal";
import { VoiceModal } from "@/components/modals/VoiceModal";
import { useRedLight } from "@/providers/RedLightProvider";
import type { SocketStatus } from "@/hooks/useSocket";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const TITLES: [string, string, string][] = [
  ["/incidents/", "Investigation", "Live agent reasoning and evidence"],
  ["/incidents", "Incidents", "Everything currently open"],
  ["/investigate", "Investigation", "Live agent reasoning and evidence"],
  ["/activity", "Activity", "Resolved incidents and recovery times"],
  ["/history", "History", "Resolved incidents and recovery times"],
  ["/settings", "Settings", "Theme, motion, AI provider and bridges"],
  ["/inspector", "Codebase Inspector", "Static analysis of a real project"],
  ["/", "Command Center", "Live production posture"],
];

const titleFor = (path: string) =>
  TITLES.find(([prefix]) => (prefix === "/" ? path === "/" : path.startsWith(prefix))) ??
  ["", "DevGuard", ""];

/** Sticky header: identity on mobile, page title on desktop, and the global
 *  actions (voice, camera, theme, notifications) that work from any screen. */
export function TopBar({ socketStatus }: { socketStatus: SocketStatus }) {
  const { pathname } = useLocation();
  const [, title, subtitle] = titleFor(pathname);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { redLightMode, toggleRedLightMode } = useRedLight();
  const live = socketStatus === "open";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl pt-safe">
        <div className="flex items-center gap-2 px-4 py-3 lg:px-7">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="DevGuard home">
            <DevGuardLogo size={28} showText />
          </Link>

          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleRedLightMode}
              title={redLightMode ? "Red Light Mode Active (Phone + Office Kit)" : "Enable Red Light Mode (No Laptop Required)"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-bold uppercase tracking-wider transition-all duration-200",
                redLightMode
                  ? "border-bad/50 bg-bad/15 text-bad shadow-glow animate-pulse"
                  : "border-line bg-elevated text-muted hover:border-strong hover:text-ink"
              )}
            >
              <Radio className="h-3 w-3" aria-hidden />
              <span>Red Light</span>
            </button>

            <span
              title={live ? "Live event stream connected" : "Reconnecting to event stream"}
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] sm:inline-flex",
                live ? "border-ok/35 bg-ok/10 text-ok" : "border-warn/35 bg-warn/10 text-warn"
              )}
            >
              {live ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
              {live ? "Live" : "Offline"}
            </span>

            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              aria-label="Voice command"
              title="Voice command"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-elevated text-muted transition-colors duration-200 hover:border-strong hover:text-ink"
            >
              <Mic className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              aria-label="Analyze a screenshot"
              title="Analyze a screenshot"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-elevated text-muted transition-colors duration-200 hover:border-strong hover:text-ink"
            >
              <Camera className="h-4 w-4" aria-hidden />
            </button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </header>

      <VoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} />
    </>
  );
}
