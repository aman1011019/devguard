import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Ambient background: a masked fine grid plus two slowly drifting colour blooms.
 * Both blooms animate transform/opacity only and sit behind `pointer-events-none`,
 * so the effect is free at runtime and never intercepts input.
 */
export function GridBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const blooms = ref.current?.querySelectorAll<HTMLElement>("[data-bloom]");
      if (!blooms?.length) return;
      blooms.forEach((bloom, i) => {
        gsap.to(bloom, {
          xPercent: i === 0 ? 8 : -10,
          yPercent: i === 0 ? -6 : 9,
          scale: i === 0 ? 1.12 : 0.92,
          duration: 16 + i * 5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });
    },
    [],
    ref
  );

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <div className="grid-backdrop absolute inset-0 opacity-[0.55]" />
      <div
        data-bloom
        className="absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-brand/20 blur-[110px] gpu"
      />
      <div
        data-bloom
        className="absolute -bottom-40 -right-24 h-[24rem] w-[24rem] rounded-full bg-accent/16 blur-[120px] gpu"
      />
    </div>
  );
}

/** Sweeping scan line — used on panels while agents are actively working, so
 *  "the system is thinking" reads at a glance without a spinner. */
export function ScanLine({ active = true, className }: { active?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const line = ref.current?.firstElementChild;
      if (!line || !active) return;
      gsap.fromTo(
        line,
        { yPercent: -100, opacity: 0 },
        {
          yPercent: 1000,
          opacity: 1,
          duration: 2.4,
          ease: "none",
          repeat: -1,
          repeatDelay: 0.25,
        }
      );
    },
    [active],
    ref
  );

  if (!active) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
    >
      <div className="h-[10%] w-full bg-gradient-to-b from-transparent via-brand/25 to-transparent gpu" />
    </div>
  );
}
