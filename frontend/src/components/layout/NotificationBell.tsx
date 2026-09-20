import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap, reduced } from "@/lib/motion";
import { useNotifications, type Tone } from "@/providers/NotificationProvider";
import { cn, relativeTime } from "@/lib/utils";

const DOTS: Record<Tone, string> = {
  info: "bg-info",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  brand: "bg-brand",
};

/** Bell + dropdown history. The bell shakes when a new notification lands so a
 *  toast that was missed still gets noticed. */
export function NotificationBell() {
  const { items, unread, markAllRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(items.length);

  useEffect(() => {
    if (items.length > seenRef.current && bellRef.current && !reduced()) {
      gsap.fromTo(
        bellRef.current,
        { rotate: -14 },
        { rotate: 0, duration: 0.75, ease: "elastic.out(1.6, 0.28)", overwrite: true }
      );
    }
    seenRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-xl border bg-elevated transition-colors duration-200",
          open ? "border-strong text-ink" : "border-line text-muted hover:border-strong hover:text-ink"
        )}
      >
        <span ref={bellRef} className="grid place-items-center gpu">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[0.5625rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-faint">Activity</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllRead}
                  title="Mark all read"
                  aria-label="Mark all read"
                  className="rounded-lg p-1.5 text-faint transition-colors hover:text-ink"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={clear}
                  title="Clear all"
                  aria-label="Clear all notifications"
                  className="rounded-lg p-1.5 text-faint transition-colors hover:text-bad"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-xs text-faint">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-line/60">
                  {items.map((n) => (
                    <li key={n.id} className="flex gap-2.5 px-3.5 py-2.5">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOTS[n.tone])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-snug text-ink">{n.title}</p>
                        {n.body ? (
                          <p className="mt-0.5 text-2xs leading-relaxed text-muted">{n.body}</p>
                        ) : null}
                        <p className="mt-1 text-2xs text-faint">
                          {relativeTime(new Date(n.at).toISOString())}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
