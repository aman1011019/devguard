import { useMemo, useState } from "react";
import { Columns2, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { kind: "add" | "del" | "meta" | "ctx"; text: string };

const classify = (line: string): Row => {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") || line.startsWith("diff "))
    return { kind: "meta", text: line };
  if (line.startsWith("+")) return { kind: "add", text: line.slice(1) };
  if (line.startsWith("-")) return { kind: "del", text: line.slice(1) };
  return { kind: "ctx", text: line.replace(/^ /, "") };
};

const ROW_STYLES: Record<Row["kind"], string> = {
  add: "bg-ok/10 text-ok",
  del: "bg-bad/10 text-bad",
  meta: "bg-elevated text-faint",
  ctx: "text-muted",
};

const PREFIX: Record<Row["kind"], string> = { add: "+", del: "−", meta: "", ctx: " " };

/**
 * Unified diff by default with an optional side-by-side view. Line numbers are
 * derived per side so the before/after view lines up even where the hunk sizes
 * differ. Content is rendered as text only — never interpreted.
 */
export function DiffViewer({
  diff,
  before,
  after,
  language,
  className,
}: {
  diff: string;
  before?: string;
  after?: string;
  language?: string;
  className?: string;
}) {
  const [split, setSplit] = useState(false);
  const rows = useMemo(() => diff.split("\n").map(classify), [diff]);
  const canSplit = Boolean(before && after);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-elevated/60 px-3 py-2">
        <span className="font-mono text-2xs uppercase tracking-[0.1em] text-faint">
          {language ?? "diff"}
        </span>
        {canSplit ? (
          <button
            type="button"
            onClick={() => setSplit((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-2xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {split ? <Rows3 className="h-3 w-3" aria-hidden /> : <Columns2 className="h-3 w-3" aria-hidden />}
            {split ? "Unified" : "Side by side"}
          </button>
        ) : null}
      </div>

      {split && canSplit ? (
        <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <CodeColumn title="Before" code={before as string} tone="bad" />
          <CodeColumn title="After" code={after as string} tone="ok" />
        </div>
      ) : (
        <div className="no-scrollbar max-h-[26rem] overflow-auto">
          <pre className="min-w-full font-mono text-2xs leading-relaxed">
            {rows.map((row, i) => (
              <div key={i} className={cn("flex gap-3 px-3 py-[0.1rem]", ROW_STYLES[row.kind])}>
                <span className="w-4 shrink-0 select-none text-right opacity-70">{PREFIX[row.kind]}</span>
                <code className="whitespace-pre-wrap break-words">{row.text || " "}</code>
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

function CodeColumn({ title, code, tone }: { title: string; code: string; tone: "ok" | "bad" }) {
  const lines = code.split("\n");
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "border-b border-line px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.1em]",
          tone === "ok" ? "text-ok" : "text-bad"
        )}
      >
        {title}
      </p>
      <div className="no-scrollbar max-h-[24rem] overflow-auto">
        <pre className="font-mono text-2xs leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3 px-3 py-[0.1rem]">
              <span className="w-6 shrink-0 select-none text-right text-faint">{i + 1}</span>
              <code className="whitespace-pre-wrap break-words text-muted">{line || " "}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
