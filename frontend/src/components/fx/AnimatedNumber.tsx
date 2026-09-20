import { useEffect, useRef } from "react";
import { tweenNumber } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Counter that animates by writing `textContent` from a GSAP tick — React never
 * re-renders during the count, so a wall of live KPIs costs nothing per frame.
 * `format` receives the interpolated value, which is how "4.8s" and "21.8%"
 * animate smoothly while still ending on an exact number.
 */
export function AnimatedNumber({
  value,
  format,
  duration,
  className,
  as: Tag = "span",
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
  as?: "span" | "div" | "p";
}) {
  const ref = useRef<HTMLElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = formatRef.current;
    if (!mountedRef.current) {
      mountedRef.current = true;
      // First paint counts up from zero so the number feels alive on entry.
      tweenNumber(el, value, { from: 0, duration: duration ?? 1.1, format: fmt });
      return;
    }
    tweenNumber(el, value, { duration, format: fmt });
  }, [value, duration]);

  const initial = format ? format(0) : "0";

  return (
    <Tag
      ref={ref as never}
      data-value={0}
      className={cn("tabular-nums", className)}
      aria-label={format ? format(value) : String(value)}
    >
      {initial}
    </Tag>
  );
}
