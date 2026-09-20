import { useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { GridBackdrop } from "@/components/fx/Backdrop";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useNotifications } from "@/providers/NotificationProvider";
import { pageIntro } from "@/lib/motion";
import { MobileNav } from "./MobileNav";
import { RedLightBanner } from "./RedLightBanner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * App frame: desktop rail + sticky header + bottom nav, and the single global
 * WebSocket subscription (system channel). Events arrive here no matter
 * which screen is open, making the system truly real-time across tabs.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { notify } = useNotifications();
  const mainRef = useRef<HTMLElement>(null);

  const onGlobalEvent = useCallback(
    (event: any) => {
      const type = event.type || event.event;
      if (type === "incident_detected" || type === "incident_created") {
        void qc.invalidateQueries();
        notify({
          tone: "bad",
          title: `Incident detected — ${event.service ?? event.detail?.service ?? "Checkout API"}`,
          body: event.title ?? event.detail?.title ?? "Investigate to dispatch the agent swarm.",
          ttl: 7000,
        });
      } else if (type === "system_reset") {
        void qc.invalidateQueries();
        notify({
          tone: "ok",
          title: "System reset",
          body: "All services returned to the healthy baseline.",
        });
      } else if (type === "service_healthy" || type === "incident_resolved") {
        void qc.invalidateQueries();
        notify({
          tone: "ok",
          title: "Incident Resolved",
          body: `${event.service ?? "Service"} metrics normalized. All test suites passed.`,
        });
      }
    },
    [notify, qc]
  );

  useWebSocket("system", onGlobalEvent);

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
        <TopBar />
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
