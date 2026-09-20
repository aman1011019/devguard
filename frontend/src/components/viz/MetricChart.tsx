import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint } from "@/lib/types";
import { cn, ms, pct } from "@/lib/utils";

export type MetricKey = "latency_ms" | "error_rate" | "db_queries" | "db_latency_ms";

export const METRIC_META: Record<
  MetricKey,
  { label: string; color: string; format: (v: number) => string; unit: string }
> = {
  latency_ms: { label: "Latency", color: "--c-brand", format: (v) => ms(v), unit: "ms" },
  error_rate: { label: "Error rate", color: "--c-bad", format: (v) => pct(v), unit: "%" },
  db_queries: {
    label: "DB queries / request",
    color: "--c-warn",
    format: (v) => `${Math.round(v)}`,
    unit: "q",
  },
  db_latency_ms: { label: "DB latency", color: "--c-accent", format: (v) => ms(v), unit: "ms" },
};

/**
 * Telemetry over the incident window. Colours come from the same CSS variables
 * as the rest of the UI, so the chart re-themes instantly with no JS. Animation
 * is switched off while an investigation is live — re-animating a series on
 * every WebSocket push is exactly the kind of jank we are avoiding.
 */
export function MetricChart({
  points,
  metric,
  live = false,
  height = 240,
  className,
}: {
  points: MetricPoint[];
  metric: MetricKey;
  live?: boolean;
  height?: number;
  className?: string;
}) {
  const meta = METRIC_META[metric];
  const color = `rgb(var(${meta.color}))`;

  // First index of each phase — the vertical guides that say "this is where the
  // deploy landed" and "this is where the fix took effect".
  const marks = useMemo(() => {
    const seen = new Set<string>();
    const out: { t: number; phase: string }[] = [];
    points.forEach((p) => {
      if (!seen.has(p.phase)) {
        seen.add(p.phase);
        if (p.phase !== "healthy") out.push({ t: p.t, phase: p.phase });
      }
    });
    return out;
  }, [points]);

  if (!points.length) {
    return (
      <div
        className={cn("grid place-items-center rounded-xl border border-line bg-elevated/50", className)}
        style={{ height }}
      >
        <p className="text-xs text-faint">No telemetry yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgb(var(--c-line))"
            vertical={false}
            strokeOpacity={0.9}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "rgb(var(--c-faint))" }}
            stroke="rgb(var(--c-line))"
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgb(var(--c-faint))" }}
            stroke="rgb(var(--c-line))"
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => meta.format(v)}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--c-surface))",
              border: "1px solid rgb(var(--c-line))",
              borderRadius: 14,
              fontSize: 12,
              boxShadow: "0 18px 40px -22px rgb(var(--c-shadow) / 0.7)",
            }}
            labelStyle={{ color: "rgb(var(--c-faint))", fontSize: 11 }}
            itemStyle={{ color: "rgb(var(--c-ink))" }}
            formatter={(value: number) => [meta.format(value), meta.label]}
          />
          {marks.map((mark) => (
            <ReferenceLine
              key={mark.phase}
              x={points.find((p) => p.t === mark.t)?.label}
              stroke={mark.phase === "recovered" ? "rgb(var(--c-ok))" : "rgb(var(--c-bad))"}
              strokeDasharray="4 4"
              strokeOpacity={0.75}
              label={{
                value: mark.phase === "recovered" ? "fix" : "deploy",
                position: "insideTopRight",
                fontSize: 9,
                fill: mark.phase === "recovered" ? "rgb(var(--c-ok))" : "rgb(var(--c-bad))",
              }}
            />
          ))}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${metric})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
            isAnimationActive={!live}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
