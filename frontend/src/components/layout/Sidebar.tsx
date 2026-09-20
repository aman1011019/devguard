import { NavLink } from "react-router-dom";
import { Activity } from "lucide-react";
import { DevGuardLogo } from "@/components/brand/DevGuardLogo";
import { useHealth } from "@/hooks/useQueries";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

/** Desktop-only rail. Hidden below `lg`, where MobileNav takes over. */
export function Sidebar() {
  const { data: health } = useHealth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col border-r border-line bg-surface/80 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <DevGuardLogo size={36} showText />
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-brand/12 text-ink"
                  : "text-muted hover:bg-elevated/70 hover:text-ink"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                />
                <Icon
                  className={cn("shrink-0", isActive ? "text-brand" : "")}
                  style={{ height: "1.125rem", width: "1.125rem" }}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl border border-line bg-elevated/60 p-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-ok" aria-hidden />
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-faint">
            System health
          </p>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink tabular-nums">
          {health ? `${health.system_health.toFixed(1)}%` : "—"}
        </p>
        <p className="mt-1 text-2xs leading-relaxed text-muted">
          {health
            ? `${health.services_monitored} services · ${health.active_incidents} active`
            : "Connecting…"}
        </p>
        <p className="mt-2 truncate text-2xs text-faint">
          {health ? `${health.ai_provider} · v${health.version}` : ""}
        </p>
      </div>
    </aside>
  );
}
