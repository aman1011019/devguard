import { NavLink } from "react-router-dom";
import { Activity, ShieldCheck, Terminal } from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { useRealtimeStore } from "@/store/realtimeStore";
import { useHealth } from "@/hooks/useQueries";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

/** Desktop-only command rail. Hidden below `lg`, where MobileNav takes over. */
export function Sidebar() {
  const { data: health } = useHealth();
  const services = useRealtimeStore((s) => s.services);
  const systemStats = useRealtimeStore((s) => s.systemStats);

  const activeIncidents = systemStats.activeIncidents || (health ? health.active_incidents : 1);
  const criticalServices = services.filter((s) => s.status === "CRITICAL").length;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col border-r border-line/80 bg-[#07090e]/95 backdrop-blur-2xl lg:flex">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-line/60">
        <DevGuardLogo size={34} showText />
      </div>

      {/* Nav Section */}
      <div className="px-3 pt-3 pb-1">
        <span className="px-3 text-[0.65rem] font-mono uppercase tracking-[0.14em] text-faint">
          Navigation
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-mono font-medium transition-all duration-150",
                isActive
                  ? "bg-brand/10 text-sky-400 border border-brand/20 shadow-sm"
                  : "text-muted hover:bg-elevated/80 hover:text-ink hover:border hover:border-line/60"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "shrink-0 h-4 w-4 transition-colors",
                    isActive ? "text-sky-400" : "text-muted group-hover:text-ink"
                  )}
                  aria-hidden
                />
                <span className="tracking-wide uppercase text-2xs">{label}</span>

                {label === "Live Command" && activeIncidents > 0 && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-rose-400 animate-pulse">
                    {activeIncidents}
                  </span>
                )}
                {label === "Services" && criticalServices > 0 && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-400">
                    {criticalServices} alert
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Terminal / Telemetry System Health Widget */}
      <div className="m-3 rounded-xl border border-line/80 bg-[#0c1019] p-3 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" aria-hidden />
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">
              Fleet Posture
            </span>
          </div>
          <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-400">
            STABLE
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 text-2xs border-t border-line/50 pt-2">
          <div>
            <span className="text-[0.6rem] text-faint block">SERVICES</span>
            <span className="text-xs font-bold text-ink">{services.length || 5} ONLINE</span>
          </div>
          <div>
            <span className="text-[0.6rem] text-faint block">INCIDENTS</span>
            <span
              className={cn(
                "text-xs font-bold",
                activeIncidents > 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {activeIncidents} ACTIVE
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line/50 pt-2 text-[0.6rem] text-faint">
          <span className="flex items-center gap-1">
            <Terminal className="h-3 w-3 text-sky-400" />
            v2.0.0
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            SECURE
          </span>
        </div>
      </div>
    </aside>
  );
}
