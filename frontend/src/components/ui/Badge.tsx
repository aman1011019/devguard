import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "ok" | "warn" | "bad" | "info" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-elevated text-muted",
  brand: "border-brand/35 bg-brand/12 text-brand",
  ok: "border-ok/35 bg-ok/12 text-ok",
  warn: "border-warn/35 bg-warn/12 text-warn",
  bad: "border-bad/35 bg-bad/12 text-bad",
  info: "border-info/35 bg-info/12 text-info",
  accent: "border-accent/35 bg-accent/12 text-accent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em]",
        TONES[tone],
        className
      )}
      {...rest}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
          ) : null}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** Status → tone/label mapping, shared by every surface that shows a status so
 *  the dashboard, list and detail view can never disagree. */
export const STATUS_META: Record<string, { label: string; tone: BadgeTone; live?: boolean }> = {
  HEALTHY: { label: "Healthy", tone: "ok" },
  DETECTED: { label: "Detected", tone: "bad", live: true },
  INVESTIGATING: { label: "Investigating", tone: "warn", live: true },
  ROOT_CAUSE_FOUND: { label: "Root cause found", tone: "info" },
  FIX_READY: { label: "Fix ready", tone: "brand" },
  AWAITING_APPROVAL: { label: "Awaiting approval", tone: "brand", live: true },
  TESTING: { label: "Verifying", tone: "accent", live: true },
  RESOLVED: { label: "Resolved", tone: "ok" },
  FAILED: { label: "Failed", tone: "bad" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as const };
  return (
    <Badge tone={meta.tone} dot pulse={meta.live} className={className}>
      {meta.label}
    </Badge>
  );
}

const SEVERITY_TONES: Record<string, BadgeTone> = {
  CRITICAL: "bad",
  HIGH: "warn",
  MEDIUM: "info",
  LOW: "neutral",
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const key = severity.toUpperCase();
  return (
    <Badge tone={SEVERITY_TONES[key] ?? "neutral"} className={className}>
      {key}
    </Badge>
  );
}
