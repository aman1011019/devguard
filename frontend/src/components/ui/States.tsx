import type { ReactNode } from "react";
import { AlertOctagon, Inbox, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-elevated text-faint">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Turns an unknown thrown value into something a human can act on, and always
 *  offers a retry — a dropped backend is the most likely failure in a demo. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong.";
  const status = error instanceof ApiError ? error.status : undefined;

  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-bad/30 bg-bad/10 text-bad">
        <AlertOctagon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">
        {status === 0 ? "Backend unreachable" : "Request failed"}
      </p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{message}</p>
      {status === 0 ? (
        <code className="mt-3 rounded-lg border border-line bg-elevated px-2.5 py-1.5 font-mono text-2xs text-faint">
          uvicorn main:app --port 8000
        </code>
      ) : null}
      {onRetry ? (
        <Button
          className="mt-5"
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
