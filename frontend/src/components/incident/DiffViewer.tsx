import { useMemo, useState } from "react";
import { Columns2, Rows3, Copy, Check } from "lucide-react";
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
  add: "bg-ok/10 text-ok font-medium",
  del: "bg-bad/10 text-bad font-medium",
  meta: "bg-elevated text-faint font-semibold",
  ctx: "text-muted",
};

const PREFIX: Record<Row["kind"], string> = { add: "+", del: "−", meta: "", ctx: " " };

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
  const [copied, setCopied] = useState(false);
  const rows = useMemo(() => diff.split("\n").map(classify), [diff]);
  const canSplit = Boolean(before && after);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface font-mono", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-slate-50 px-3.5 py-2">
        <span className="text-2xs uppercase tracking-[0.1em] text-blue-600 font-bold">
          {language ?? "diff"} · patch preview
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-2xs font-semibold text-muted transition-colors hover:text-ink hover:bg-white"
            title="Copy diff to clipboard"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy diff"}</span>
          </button>
          {canSplit ? (
            <button
              type="button"
              onClick={() => setSplit((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-2xs font-semibold text-muted transition-colors hover:text-ink hover:bg-elevated"
            >
              {split ? <Rows3 className="h-3 w-3" aria-hidden /> : <Columns2 className="h-3 w-3" aria-hidden />}
              {split ? "Unified" : "Side by side"}
            </button>
          ) : null}
        </div>
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
