import { useEffect, useRef } from "react";
import { gsap, reduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Tone = "brand" | "ok" | "warn" | "bad" | "accent";

const FILLS: Record<Tone, string> = {
  brand: "bg-brand",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  accent: "bg-accent",
};

/**
 * Progress bar animated with `scaleX` rather than `width`, so every frame stays
 * on the compositor and never triggers layout — the difference is visible when
 * four test suites report at once.
 */
export function Progress({
  value,
  tone = "brand",
  className,
  label,
  height = "h-1.5",
}: {
  /** 0–1 */
  value: number;
  tone?: Tone;
  className?: string;
  label?: string;
  height?: string;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    if (reduced()) {
      gsap.set(el, { scaleX: clamped });
      return;
    }
    const tween = gsap.to(el, {
      scaleX: clamped,
      duration: 0.7,
      ease: "power3.out",
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      className={cn("relative w-full overflow-hidden rounded-full bg-line/80", height, className)}
    >
      <div
        ref={fillRef}
        className={cn("h-full w-full origin-left rounded-full gpu", FILLS[tone])}
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/** Indeterminate shimmer for work with no measurable progress (agents thinking). */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-1 w-full overflow-hidden rounded-full bg-line/70", className)}>
      <div className="absolute inset-y-0 left-0 w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-brand to-transparent" />
    </div>
  );
}
