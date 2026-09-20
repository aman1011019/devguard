import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap, reduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

/**
 * Segmented tab bar with a sliding indicator. The pill is positioned from live
 * measurements (and re-measured on resize) so it stays correct across the
 * mobile→desktop switch and after font loading shifts label widths.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  scrollable = true,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  scrollable?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());

  const move = (animate: boolean) => {
    const list = listRef.current;
    const pill = pillRef.current;
    const btn = btnRefs.current.get(value);
    if (!list || !pill || !btn) return;
    const x = btn.offsetLeft;
    const width = btn.offsetWidth;
    if (animate && !reduced()) {
      gsap.to(pill, { x, width, duration: 0.38, ease: "power3.out", overwrite: true });
    } else {
      gsap.set(pill, { x, width });
    }
    // Only follow the selection on real interaction — doing it on mount would
    // yank the page scroll position on load.
    if (animate) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  useLayoutEffect(() => {
    move(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    move(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tabs.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => move(false));
    ro.observe(list);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        "relative flex items-center gap-1 rounded-xl border border-line bg-elevated/70 p-1",
        scrollable && "no-scrollbar overflow-x-auto",
        className
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-1 h-[calc(100%-0.5rem)] rounded-lg bg-surface shadow-card ring-1 ring-line gpu"
      />
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              if (el) btnRefs.current.set(tab.value, el);
              else btnRefs.current.delete(tab.value);
            }}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
              active ? "text-ink" : "text-muted hover:text-ink"
            )}
          >
            {tab.icon ? <span aria-hidden>{tab.icon}</span> : null}
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-2xs font-bold",
                  active ? "bg-brand/15 text-brand" : "bg-line/70 text-faint"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
