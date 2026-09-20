import { useEffect, useRef } from "react";
import { gsap, reduced } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * System-health dial. The arc is drawn by animating `strokeDashoffset`, which
 * the browser can composite, and the label counts up in step with it.
 */
export function HealthRing({
  value,
  size = 132,
  label = "System health",
  className,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const clamped = Math.max(0, Math.min(100, value));

  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = clamped >= 90 ? "--c-ok" : clamped >= 60 ? "--c-warn" : "--c-bad";

  useEffect(() => {
    const arc = arcRef.current;
    const text = textRef.current;
    const offset = circumference * (1 - clamped / 100);
    if (reduced()) {
      if (arc) gsap.set(arc, { strokeDashoffset: offset });
      if (text) text.textContent = clamped.toFixed(1);
      return;
    }
    const tl = gsap.timeline();
    if (arc) {
      tl.to(arc, { strokeDashoffset: offset, duration: 1.1, ease: "power3.out", overwrite: true }, 0);
    }
    if (text) {
      const state = { v: Number(text.textContent ?? 0) || 0 };
      tl.to(
        state,
        {
          v: clamped,
          duration: 1.1,
          ease: "power3.out",
          onUpdate: () => {
            text.textContent = state.v.toFixed(1);
          },
        },
        0
      );
    }
    return () => {
      tl.kill();
    };
  }, [clamped, circumference]);

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label}: ${clamped.toFixed(1)}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`rgb(var(${tone}))`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ transition: "stroke 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-2xl font-bold tracking-tight text-ink tabular-nums">
          <span ref={textRef}>0.0</span>
          <span className="text-sm text-faint">%</span>
        </p>
        <p className="mt-0.5 text-2xs uppercase tracking-[0.1em] text-faint">{label}</p>
      </div>
    </div>
  );
}
