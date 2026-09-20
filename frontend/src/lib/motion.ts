import { useEffect, useRef, type DependencyList, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** force3D keeps transforms on the compositor; nullTargetWarn off because
 *  conditionally-rendered panels legitimately come and go. */
gsap.config({ force3D: true, nullTargetWarn: false });
gsap.defaults({ ease: "power3.out", duration: 0.55 });

export { gsap, ScrollTrigger };

export const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Scoped GSAP effects with automatic cleanup.
 *
 * Everything created inside the callback (tweens, timelines, ScrollTriggers,
 * even delayed calls) is reverted when deps change or the component unmounts,
 * so no animation ever leaks or fights a re-render. When the user prefers
 * reduced motion the callback is skipped entirely and the DOM is left in its
 * natural, fully-visible state.
 */
export function useGsap(
  effect: (ctx: { self: gsap.Context; scope: HTMLElement | null }) => void,
  deps: DependencyList = [],
  scope?: RefObject<HTMLElement | null>
) {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    if (reduced()) return;
    const ctx = gsap.context((self) => {
      effectRef.current({ self, scope: scope?.current ?? null });
    }, scope?.current ?? undefined);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Standard page-entrance timeline: staggered rise of `[data-rise]` children. */
export function pageIntro(root: HTMLElement | null) {
  if (!root || reduced()) return;
  const targets = root.querySelectorAll<HTMLElement>("[data-rise]");
  if (!targets.length) return;
  gsap.fromTo(
    targets,
    { y: 18, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.5,
      stagger: 0.055,
      ease: "power3.out",
      overwrite: "auto",
      clearProps: "transform,opacity",
    }
  );
}

/** Animate a numeric readout by writing straight to the DOM — no React state,
 *  so a 60fps counter costs zero re-renders. */
export function tweenNumber(
  el: HTMLElement | null,
  to: number,
  opts: { from?: number; duration?: number; format?: (v: number) => string } = {}
) {
  if (!el) return;
  const format = opts.format ?? ((v: number) => Math.round(v).toLocaleString());
  const from = opts.from ?? Number(el.dataset.value ?? 0);
  if (reduced()) {
    el.textContent = format(to);
    el.dataset.value = String(to);
    return;
  }
  const state = { v: from };
  gsap.to(state, {
    v: to,
    duration: opts.duration ?? 0.9,
    ease: "power2.out",
    overwrite: true,
    onUpdate: () => {
      el.textContent = format(state.v);
    },
    onComplete: () => {
      el.dataset.value = String(to);
      el.textContent = format(to);
    },
  });
}

/** Quick attention pulse used when a live event lands on a card. */
export function flashCard(el: HTMLElement | null) {
  if (!el || reduced()) return;
  gsap.fromTo(
    el,
    { boxShadow: "0 0 0 0 rgb(var(--c-brand) / 0.55)" },
    {
      boxShadow: "0 0 0 14px rgb(var(--c-brand) / 0)",
      duration: 0.9,
      ease: "power2.out",
      clearProps: "boxShadow",
    }
  );
}
