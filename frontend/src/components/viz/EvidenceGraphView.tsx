import { useMemo, useRef, useState } from "react";
import { gsap, useGsap } from "@/lib/motion";
import type { EvidenceGraph as GraphData } from "@/lib/types";
import { cn } from "@/lib/utils";

const NODE_W = 148;
const NODE_H = 58;
const COL_GAP = 78;
const ROW_GAP = 22;
const PAD = 16;

type Placed = {
  id: string;
  label: string;
  type: string;
  detail: string;
  evidence_key?: string | null;
  x: number;
  y: number;
};

/** Longest-path layering: every node sits one column right of its deepest
 *  parent, which turns the correlation DAG into a readable left-to-right story
 *  without hard-coding coordinates for a specific fixture. */
function layout(graph: GraphData) {
  const depth = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  graph.nodes.forEach((n) => incoming.set(n.id, []));
  graph.edges.forEach((e) => {
    if (incoming.has(e.target)) incoming.get(e.target)!.push(e.source);
  });

  const resolve = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = incoming.get(id) ?? [];
    const value = parents.length ? Math.max(...parents.map((p) => resolve(p, seen) + 1)) : 0;
    depth.set(id, value);
    return value;
  };
  graph.nodes.forEach((n) => resolve(n.id, new Set()));

  const columns = new Map<number, typeof graph.nodes>();
  graph.nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n);
  });

  const colIndexes = [...columns.keys()].sort((a, b) => a - b);
  const tallest = Math.max(...colIndexes.map((c) => columns.get(c)!.length));
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const width = PAD * 2 + colIndexes.length * NODE_W + (colIndexes.length - 1) * COL_GAP;

  const placed: Placed[] = [];
  colIndexes.forEach((col, ci) => {
    const items = columns.get(col)!;
    const colHeight = items.length * NODE_H + (items.length - 1) * ROW_GAP;
    const top = (height - colHeight) / 2;
    items.forEach((node, ri) => {
      placed.push({
        id: node.id,
        label: node.label,
        type: node.type,
        detail: node.detail,
        evidence_key: node.evidence_key ?? null,
        x: PAD + ci * (NODE_W + COL_GAP),
        y: top + ri * (NODE_H + ROW_GAP),
      });
    });
  });

  return { placed, width, height };
}

const TYPE_TONE = (type: string): { stroke: string; fill: string; text: string } => {
  const t = type.toLowerCase();
  if (t.includes("root") || t.includes("cause"))
    return { stroke: "--c-bad", fill: "--c-bad", text: "--c-bad" };
  if (t.includes("deploy") || t.includes("commit") || t.includes("git"))
    return { stroke: "--c-brand", fill: "--c-brand", text: "--c-brand" };
  if (t.includes("metric") || t.includes("telemetry"))
    return { stroke: "--c-accent", fill: "--c-accent", text: "--c-accent" };
  if (t.includes("log") || t.includes("trace"))
    return { stroke: "--c-warn", fill: "--c-warn", text: "--c-warn" };
  if (t.includes("db") || t.includes("database"))
    return { stroke: "--c-info", fill: "--c-info", text: "--c-info" };
  return { stroke: "--c-strong", fill: "--c-muted", text: "--c-muted" };
};

/**
 * The correlation graph: how a commit, a metric spike, a log burst and a DB
 * trace add up to one root cause. Edges draw themselves in with
 * stroke-dasharray and the nodes pop in behind them, so the causal direction is
 * legible the first time you see it.
 */
export function EvidenceGraphView({
  graph,
  onSelect,
  className,
}: {
  graph: GraphData;
  onSelect?: (evidenceKey: string | null, nodeId: string) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  const { placed, width, height } = useMemo(() => layout(graph), [graph]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  useGsap(
    () => {
      const root = wrapRef.current;
      if (!root) return;
      const paths = root.querySelectorAll<SVGPathElement>("[data-edge]");
      const nodes = root.querySelectorAll<SVGGElement>("[data-node]");
      const tl = gsap.timeline();
      tl.fromTo(
        nodes,
        { opacity: 0, scale: 0.9, transformOrigin: "center" },
        { opacity: 1, scale: 1, duration: 0.45, stagger: 0.07, ease: "back.out(1.7)" }
      );
      paths.forEach((path) => {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      });
      tl.to(paths, { strokeDashoffset: 0, duration: 0.6, stagger: 0.09, ease: "power2.inOut" }, 0.25);
    },
    [graph],
    wrapRef
  );

  const pick = (node: Placed) => {
    setActive(node.id);
    onSelect?.(node.evidence_key ?? null, node.id);
  };

  return (
    <div ref={wrapRef} className={cn("no-scrollbar w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: Math.min(width, 660), height }}
        role="img"
        aria-label="Evidence correlation graph"
      >
        <defs>
          <marker
            id="ev-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--c-strong))" />
          </marker>
        </defs>

        {graph.edges.map((edge, i) => {
          const from = byId.get(edge.source);
          const to = byId.get(edge.target);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 6} ${y2}`;
          return (
            <g key={`${edge.source}-${edge.target}-${i}`}>
              <path
                data-edge
                d={d}
                fill="none"
                stroke="rgb(var(--c-strong))"
                strokeWidth={1.6}
                strokeOpacity={0.9}
                markerEnd="url(#ev-arrow)"
              />
              {edge.label ? (
                <text
                  x={mid}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgb(var(--c-faint))"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {placed.map((node) => {
          const tone = TYPE_TONE(node.type);
          const selected = active === node.id;
          return (
            <g
              key={node.id}
              data-node
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${node.label} — ${node.type}`}
              onClick={() => pick(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(node);
                }
              }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={13}
                fill="rgb(var(--c-surface))"
                stroke={`rgb(var(${tone.stroke}))`}
                strokeOpacity={selected ? 1 : 0.5}
                strokeWidth={selected ? 2 : 1.2}
              />
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={13}
                fill={`rgb(var(${tone.fill}))`}
                fillOpacity={selected ? 0.14 : 0.06}
              />
              <text
                x={node.x + 12}
                y={node.y + 20}
                fontSize={8.5}
                letterSpacing={0.8}
                fill={`rgb(var(${tone.text}))`}
                style={{ textTransform: "uppercase" }}
              >
                {node.type.replace(/_/g, " ").toUpperCase()}
              </text>
              <text x={node.x + 12} y={node.y + 36} fontSize={11.5} fontWeight={600} fill="rgb(var(--c-ink))">
                {node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}
              </text>
              <text x={node.x + 12} y={node.y + 49} fontSize={9} fill="rgb(var(--c-faint))">
                {node.detail.length > 24 ? `${node.detail.slice(0, 23)}…` : node.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
