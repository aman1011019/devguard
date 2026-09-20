import { useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { GridBackdrop } from "@/components/fx/Backdrop";
import { useGlobalSocket } from "@/hooks/useSocket";
import { useNotifications } from "@/providers/NotificationProvider";
import { pageIntro } from "@/lib/motion";
import type { WsEvent } from "@/lib/events";
import { MobileNav } from "./MobileNav";
import { RedLightBanner } from "./RedLightBanner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * App frame: desktop rail + sticky header + bottom nav, and the single global
 * WebSocket subscription (channel 0). Detection and reset arrive here no matter
 * which screen is open, which is what makes the demo feel like one system.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { notify } = useNotifications();
  const mainRef = useRef<HTMLElement>(null);

  const onGlobalEvent = useCallback(
    (event: WsEvent) => {
      if (event.type === "incident_detected") {
        void qc.invalidateQueries();
        notify({
          tone: "bad",
          title: `Incident detected — ${(event as any).service ?? "service"}`,
          body: (event as any).title ?? "Investigate to dispatch the agent swarm.",
          ttl: 7000,
        });
      } else if (event.type === "system_reset") {
        void qc.invalidateQueries();
        notify({
          tone: "ok",
          title: "System reset",
          body: "All services returned to the healthy baseline.",
        });
      }
    },
    [notify, qc]
  );

  const { status } = useGlobalSocket(onGlobalEvent);

  // Route changes get a staggered entrance; scroll returns to the top so a deep
  // page never opens half-way down.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const id = window.setTimeout(() => pageIntro(mainRef.current), 20);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <div className="relative min-h-screen">
      <GridBackdrop />
      <Sidebar />
      <div className="lg:pl-[15.5rem]">
        <TopBar socketStatus={status} />
        <RedLightBanner />
        <main
          ref={mainRef}
          key={pathname}
          className="mx-auto w-full max-w-[100rem] px-4 pb-28 pt-4 sm:px-6 lg:px-7 lg:pb-10"
        >
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
