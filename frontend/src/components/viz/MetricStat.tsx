import { useRef } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { gsap, useGsap } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StatTone = "ok" | "warn" | "bad" | "brand" | "accent" | "neutral";

const TONE_TEXT: Record<StatTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  brand: "text-brand",
  accent: "text-accent",
  neutral: "text-ink",
};

const TONE_RING: Record<StatTone, string> = {
  ok: "ring-ok/25",
  warn: "ring-warn/25",
  bad: "ring-bad/25",
  brand: "ring-brand/25",
  accent: "ring-accent/25",
  neutral: "ring-line",
};

/**
 * A single KPI. The number is tweened straight into the DOM and the whole tile
 * lifts slightly on hover — both transform/opacity only, so a grid of six of
 * these stays smooth while the WebSocket is pushing updates.
 */
export function MetricStat({
  label,
  value,
  format,
  unit,
  icon: Icon,
  tone = "neutral",
  delta,
  baseline,
  className,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  unit?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Positive means "worse than baseline" for error/latency style metrics. */
  delta?: number | null;
  baseline?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const el = ref.current;
      if (!el) return;
      const enter = () => gsap.to(el, { y: -3, duration: 0.28, ease: "power2.out", overwrite: true });
      const leave = () => gsap.to(el, { y: 0, duration: 0.35, ease: "power2.out", overwrite: true });
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      };
    },
    [],
    ref
  );

  const DeltaIcon =
    delta === null || delta === undefined || delta === 1 ? Minus : delta > 1 ? ArrowUpRight : ArrowDownRight;
  const deltaTone =
    delta === null || delta === undefined || delta === 1
      ? "text-faint"
      : delta > 1
        ? "text-bad"
        : "text-ok";

  return (
    <div
      ref={ref}
      data-rise
      className={cn("panel gpu contain-paint p-4 ring-1", TONE_RING[tone], className)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-eyebrow">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} aria-hidden /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <AnimatedNumber value={value} format={format} className={cn("kpi-value", TONE_TEXT[tone])} />
        {unit ? <span className="text-xs font-semibold text-faint">{unit}</span> : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-0.5 text-2xs font-semibold", deltaTone)}>
            <DeltaIcon className="h-3 w-3" aria-hidden />
            {delta === null ? "—" : `${delta.toFixed(delta >= 10 ? 0 : 1)}×`}
          </span>
        ) : null}
        {baseline ? <span className="text-2xs text-faint">vs {baseline}</span> : null}
      </div>
    </div>
  );
}
