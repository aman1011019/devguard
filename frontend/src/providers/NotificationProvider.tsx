import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "info" | "ok" | "warn" | "bad" | "brand";

export type Notification = {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
  at: number;
  read: boolean;
};

type NotifyInput = { title: string; body?: string; tone?: Tone; ttl?: number };

type NotificationContextValue = {
  notify: (input: NotifyInput) => void;
  items: Notification[];
  unread: number;
  markAllRead: () => void;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TONE_STYLES: Record<Tone, { ring: string; icon: typeof Info; fg: string }> = {
  info: { ring: "ring-info/30", icon: Info, fg: "text-info" },
  ok: { ring: "ring-ok/30", icon: CheckCircle2, fg: "text-ok" },
  warn: { ring: "ring-warn/30", icon: AlertTriangle, fg: "text-warn" },
  bad: { ring: "ring-bad/30", icon: ShieldAlert, fg: "text-bad" },
  brand: { ring: "ring-brand/30", icon: Info, fg: "text-brand" },
};

const MAX_HISTORY = 40;
const MAX_TOASTS = 3;

/**
 * Toasts plus the notification-bell history, in one place so every alert the
 * user sees is also recoverable from the bell. Toast dismissal is timer-based
 * with the timers tracked so unmounting never leaves one dangling.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, body, tone = "info", ttl = 5200 }: NotifyInput) => {
      const entry: Notification = {
        id: idRef.current++,
        title,
        body,
        tone,
        at: Date.now(),
        read: false,
      };
      setItems((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
      setToasts((prev) => [entry, ...prev].slice(0, MAX_TOASTS));
      const timer = window.setTimeout(() => dismiss(entry.id), ttl);
      timersRef.current.set(entry.id, timer);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    },
    []
  );

  const markAllRead = useCallback(
    () => setItems((prev) => prev.map((n) => ({ ...n, read: true }))),
    []
  );
  const clear = useCallback(() => setItems([]), []);
  const unread = items.reduce((n, item) => n + (item.read ? 0 : 1), 0);

  const value = useMemo(
    () => ({ notify, items, unread, markAllRead, clear }),
    [notify, items, unread, markAllRead, clear]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 top-3 z-[90] flex flex-col items-stretch gap-2 pt-safe sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TONE_STYLES[toast.tone];
            const Icon = style.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
                className={cn(
                  "glass pointer-events-auto flex items-start gap-3 rounded-2xl p-3 shadow-lift ring-1",
                  style.ring
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.fg)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-ink">{toast.title}</p>
                  {toast.body ? (
                    <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted">
                      {toast.body}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 rounded-lg p-1 text-faint transition-colors hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}
