import { useRef, useState } from "react";
import {
  Download,
  FileCode2,
  FolderSearch,
  Gauge,
  ScanSearch,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DiffViewer } from "@/components/incident/DiffViewer";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { HealthRing } from "@/components/viz/HealthRing";
import { useCodebaseScan } from "@/hooks/useQueries";
import { api } from "@/lib/api";
import type { CodebaseScan, CodeIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEV_TONE: Record<string, "bad" | "warn" | "info" | "neutral"> = {
  CRITICAL: "bad",
  HIGH: "warn",
  MEDIUM: "info",
  LOW: "neutral",
};

export default function Inspector() {
  const [scan, setScan] = useState<CodebaseScan | null>(null);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { local, upload } = useCodebaseScan((result) => {
    setScan(result);
    setOpenIssue(result.issues[0]?.id ?? null);
  });

  const busy = local.isPending || upload.isPending;
  const error = local.error ?? upload.error;

  return (
    <div className="space-y-5">
      <section data-rise className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-brand">
            <ScanSearch className="h-4 w-4" aria-hidden />
            <span className="label-eyebrow text-brand">Autonomous static analysis</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Codebase Inspector
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            Point DevGuard at a real project. It scans for N+1 queries, resource leaks, concurrency
            bugs and security anti-patterns, scores the codebase, and drafts a ready-to-apply patch
            for each finding.
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-elevated/60 px-3 focus-within:border-strong">
              <FolderSearch className="h-4 w-4 shrink-0 text-faint" aria-hidden />
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && path.trim() && local.mutate(path.trim())}
                placeholder="Absolute path to a local project folder…"
                spellCheck={false}
                className="h-11 w-full min-w-0 bg-transparent font-mono text-xs text-ink outline-none placeholder:text-faint"
              />
            </div>
            <Button
              icon={<ScanSearch className="h-4 w-4" />}
              loading={local.isPending}
              disabled={!path.trim() || busy}
              onClick={() => local.mutate(path.trim())}
            >
              Scan folder
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              icon={<Upload className="h-4 w-4" />}
              loading={upload.isPending}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Upload .zip
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <Card data-rise>
          <CardBody>
            <ErrorState error={error} />
          </CardBody>
        </Card>
      ) : null}

      {!scan && !busy && !error ? (
        <Card data-rise>
          <CardBody>
            <EmptyState
              icon={<ScanSearch className="h-5 w-5" />}
              title="No scan yet"
              body="Enter a local folder path or upload a zip to run an autonomous inspection."
            />
          </CardBody>
        </Card>
      ) : null}

      {scan ? <ScanReport scan={scan} openIssue={openIssue} setOpenIssue={setOpenIssue} /> : null}
    </div>
  );
}

function ScanReport({
  scan,
  openIssue,
  setOpenIssue,
}: {
  scan: CodebaseScan;
  openIssue: string | null;
  setOpenIssue: (id: string | null) => void;
}) {
  const languages = Object.entries(scan.language_counts).sort((a, b) => b[1] - a[1]);
  return (
    <>
      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <section data-rise>
        <Card>
          <CardHeader
            icon={<Gauge className="h-4 w-4" />}
            title="Scan summary"
            subtitle={scan.root_path}
          />
          <CardBody>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <HealthRing value={scan.health_score} size={128} label="Code health" />
              <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryStat label="Files" value={scan.total_files} />
                <SummaryStat label="Lines" value={scan.total_lines.toLocaleString()} />
                <SummaryStat label="Issues" value={scan.summary.total ?? scan.issues.length} />
                <SummaryStat label="Critical" value={scan.summary.critical ?? 0} tone="bad" />
                <SummaryStat label="High" value={scan.summary.high ?? 0} tone="warn" />
                <SummaryStat label="Medium" value={scan.summary.medium ?? 0} tone="info" />
              </div>
            </div>
            {languages.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line/70 pt-4">
                {languages.map(([lang, count]) => (
                  <span key={lang} className="chip border-line text-muted">
                    {lang} · {count}
                  </span>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {/* ── Findings ──────────────────────────────────────────────────────── */}
      <section data-rise>
        <Card>
          <CardHeader
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Findings"
            subtitle={`${scan.issues.length} issue${scan.issues.length === 1 ? "" : "s"} detected`}
          />
          <CardBody className="pt-0">
            {scan.issues.length === 0 ? (
              <EmptyState
                icon={<FileCode2 className="h-5 w-5" />}
                title="Clean scan"
                body="No performance, concurrency, or security anti-patterns were detected."
              />
            ) : (
              <ul className="space-y-2.5">
                {scan.issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    scanId={scan.scan_id}
                    open={openIssue === issue.id}
                    onToggle={() => setOpenIssue(openIssue === issue.id ? null : issue.id)}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </>
  );
}

function IssueRow({
  issue,
  scanId,
  open,
  onToggle,
}: {
  issue: CodeIssue;
  scanId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = SEV_TONE[issue.severity.toUpperCase()] ?? "neutral";
  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors duration-200",
        open ? "border-strong bg-elevated/50" : "border-line bg-elevated/30 hover:border-strong"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        <Badge tone={tone}>{issue.severity}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{issue.title}</p>
          <p className="mt-0.5 font-mono text-2xs text-brand">
            {issue.file}
            {issue.line ? `:${issue.line}` : ""}
          </p>
        </div>
        <span className="chip shrink-0 border-line text-faint">{issue.category}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-line/70 p-3.5">
          {issue.explanation ? (
            <p className="text-xs leading-relaxed text-muted">{issue.explanation}</p>
          ) : null}
          {issue.recommendation ? (
            <div className="rounded-xl border border-brand/25 bg-brand/6 px-3 py-2 text-xs leading-relaxed text-ink">
              <span className="font-semibold text-brand">Recommendation: </span>
              {issue.recommendation}
            </div>
          ) : null}
          {issue.snippet && !issue.patch_diff ? (
            <pre className="overflow-x-auto rounded-xl bg-canvas/70 p-3 font-mono text-2xs leading-relaxed text-muted">
              {issue.snippet}
            </pre>
          ) : null}
          {issue.patch_diff ? (
            <>
              <DiffViewer
                diff={issue.patch_diff}
                before={issue.before_code}
                after={issue.after_code}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() =>
                  window.open(api.patchUrl(scanId, issue.id), "_blank", "noopener")
                }
              >
                Download patch
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "bad" | "warn" | "info";
}) {
  const color =
    tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "info" ? "text-info" : "text-ink";
  return (
    <div className="rounded-xl border border-line/70 bg-surface/60 px-3 py-2.5">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums", color)}>{value}</p>
    </div>
  );
}
