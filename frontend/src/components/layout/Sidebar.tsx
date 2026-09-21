import { NavLink } from "react-router-dom";
import { GitBranch, ChevronRight } from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { useRealtimeStore } from "@/store/realtimeStore";
import { useHealth } from "@/hooks/useQueries";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

/** Desktop command rail matching Image 2 modern enterprise design. */
export function Sidebar() {
  const { data: health } = useHealth();
  const systemStats = useRealtimeStore((s) => s.systemStats);

  const activeIncidents = systemStats.activeIncidents || (health ? health.active_incidents : 3);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200/80 bg-white lg:flex select-none shadow-2xs">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <DevGuardLogo size={28} showText />
      </div>

      {/* Nav Section */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-blue-50 text-blue-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "shrink-0 h-4 w-4 transition-colors",
                    isActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-800"
                  )}
                  aria-hidden
                />
                <span className="truncate">{label}</span>

                {label === "Incidents" && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                    {activeIncidents || 3}
                  </span>
                )}
                {badge && label !== "Incidents" && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Status & Profile */}
      <div className="p-3 space-y-2 border-t border-slate-100">
        {/* System Online & Production Selector */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">
              System Online
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 cursor-pointer pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-medium">Production</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </div>
    </aside>
  );
}

