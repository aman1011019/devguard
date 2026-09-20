import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { gsap, reduced } from "@/lib/motion";
import { MOBILE_NAV } from "./nav";
import { cn } from "@/lib/utils";

/**
 * Thumb-reachable bottom navigation — the primary way the app is driven on the
 * phone. The active pill slides between items with GSAP (transform only) and
 * the bar respects the iOS/Android safe-area inset.
 */
export function MobileNav() {
  const { pathname } = useLocation();
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const place = (animate: boolean) => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const active = list.querySelector<HTMLElement>("[aria-current='page']");
    if (!active) {
      gsap.set(pill, { opacity: 0 });
      return;
    }
    const x = active.offsetLeft + active.offsetWidth / 2 - pill.offsetWidth / 2;
    if (animate && !reduced()) {
      gsap.to(pill, { x, opacity: 1, duration: 0.42, ease: "power3.out", overwrite: true });
    } else {
      gsap.set(pill, { x, opacity: 1 });
    }
  };

  useLayoutEffect(() => {
    place(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 backdrop-blur-xl pb-safe lg:hidden"
    >
      <div ref={listRef} className="relative mx-auto flex max-w-lg items-stretch">
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-1 h-1 w-8 rounded-full bg-brand opacity-0 gpu"
        />
        {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-2xs font-medium transition-colors duration-200",
                isActive ? "text-brand" : "text-faint"
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
