import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/**
 * One dialog primitive, two presentations: a bottom sheet on phones (thumb
 * reachable, drag-to-dismiss) and a centred modal on desktop. Scroll is locked
 * while open, Escape closes, focus moves in and is restored on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      target?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      window.setTimeout(() => restoreRef.current?.focus?.(), 0);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/75 backdrop-blur-sm"
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            drag={isDesktop ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
            initial={isDesktop ? { opacity: 0, y: 16, scale: 0.97 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, y: 12, scale: 0.98 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
            className={cn(
              "relative flex max-h-[90vh] w-full flex-col overflow-hidden border border-line bg-surface shadow-lift",
              "rounded-t-3xl sm:rounded-3xl",
              widths[size]
            )}
          >
            {isDesktop ? null : (
              <div className="flex justify-center pt-2.5" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-strong" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
              <div className="flex min-w-0 items-start gap-3">
                {icon ? (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-elevated text-brand">
                    {icon}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>
                  ) : null}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-elevated/50 px-5 py-3 pb-safe">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
