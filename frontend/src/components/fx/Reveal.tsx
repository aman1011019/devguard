import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered entrance. `once: true` means ScrollTrigger self-destructs
 * after firing, so a long page does not accumulate live scroll listeners.
 * Reduced-motion users get the content immediately (the hook no-ops and the
 * element is never hidden, because the "from" state is applied by GSAP only).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 22,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el,
        { y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.62,
          delay,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    },
    [delay, y],
    ref
  );

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
