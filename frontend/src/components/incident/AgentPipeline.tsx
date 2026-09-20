import { useRef } from "react";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import { ScanLine } from "@/components/fx/Backdrop";
import { Progress } from "@/components/ui/Progress";
import { gsap, useGsap } from "@/lib/motion";
import type { AgentMeta, AgentRun } from "@/lib/types";
import { cn, confidencePct } from "@/lib/utils";

type Row = {
  agent: string;
  label: string;
  emoji: string;
  runningMessage: string;
  order: number;
  run?: AgentRun;
};

/**
 * The agent swarm, in dispatch order. Rows are built from the backend's agent
 * catalogue so an agent that has not reported yet still shows as pending —
 * the pipeline reads as a plan, not just a log of what happened.
 */
export function AgentPipeline({
  catalog,
  runs,
  className,
}: {
  catalog: AgentMeta[];
  runs: AgentRun[];
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const byAgent = new Map(runs.map((r) => [r.agent, r]));

  const rows: Row[] = (
    catalog.length
      ? catalog.map((m) => ({
          agent: m.agent,
          label: m.label,
          emoji: m.emoji,
          runningMessage: m.running_message,
          order: m.order_index,
          run: byAgent.get(m.agent),
        }))
      : runs.map((r) => ({
          agent: r.agent,
          label: r.agent.replace(/_/g, " "),
          emoji: "•",
          runningMessage: "Working…",
          order: r.order_index,
          run: r,
        }))
  ).sort((a, b) => a.order - b.order);

  const completed = rows.filter((r) => {
    const s = (r.run?.status ?? "").toUpperCase();
    return s === "COMPLETED" || s === "COMPLETE";
  }).length;

  useGsap(
    () => {
      const items = ref.current?.querySelectorAll<HTMLElement>("[data-agent-row]");
      if (!items?.length) return;
      gsap.fromTo(
        items,
        { x: -12, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, stagger: 0.06, clearProps: "transform,opacity" }
      );
    },
    [rows.length],
    ref as never
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="font-semibold text-ink tabular-nums">{completed}</span> of {rows.length}{" "}
          agents reported
        </p>
        <div className="w-28">
          <Progress value={rows.length ? completed / rows.length : 0} label="Agent progress" />
        </div>
      </div>

      <ul ref={ref} className="space-y-2">
        {rows.map((row) => {
          const status = (row.run?.status ?? "PENDING").toUpperCase();
          const running = status === "RUNNING";
          const done = status === "COMPLETED" || status === "COMPLETE";
          const failed = status === "FAILED";
          return (
            <li
              key={row.agent}
              data-agent-row
              className={cn(
                "relative overflow-hidden rounded-2xl border p-3.5 transition-colors duration-300",
                done && "border-ok/30 bg-ok/6",
                running && "border-brand/40 bg-brand/8",
                failed && "border-bad/40 bg-bad/8",
                !done && !running && !failed && "border-line bg-elevated/40"
              )}
            >
              {running ? <ScanLine /> : null}
              <div className="relative flex items-start gap-3">
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-base",
                    done && "border-ok/40 bg-ok/12",
                    running && "border-brand/40 bg-brand/12",
                    failed && "border-bad/40 bg-bad/12",
                    !done && !running && !failed && "border-line bg-surface"
                  )}
                  aria-hidden
                >
                  {row.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight text-ink">{row.label}</p>
                    {row.run?.confidence !== null && row.run?.confidence !== undefined ? (
                      <span className="chip border-brand/30 text-brand">
                        {confidencePct(row.run.confidence)}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-xs leading-relaxed",
                      done ? "text-ink" : running ? "text-brand" : "text-muted"
                    )}
                  >
                    {done || failed
                      ? row.run?.finding || "No finding reported."
                      : running
                        ? row.runningMessage
                        : "Queued"}
                  </p>

                  {done && row.run && Object.keys(row.run.detail ?? {}).length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(row.run.detail)
                        .slice(0, 4)
                        .map(([key, value]) => (
                          <span key={key} className="chip font-mono text-2xs">
                            {key.replace(/_/g, " ")}: {formatDetail(value)}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>

                <span className="mt-1 shrink-0" aria-label={status.toLowerCase()}>
                  {done ? (
                    <Check className="h-4 w-4 text-ok" aria-hidden />
                  ) : running ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-faint" aria-hidden />
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const formatDetail = (value: unknown): string => {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value !== null && typeof value === "object") return "…";
  return String(value);
};
