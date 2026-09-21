import React, { useEffect, useState } from "react";
import { GitCommit, X, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { DiffViewer } from "@/components/incident/DiffViewer";

interface CommitDiffModalProps {
  open: boolean;
  onClose: () => void;
  commitSha: string;
  repo?: string;
  commitMessage?: string;
  author?: string;
}

export const CommitDiffModal: React.FC<CommitDiffModalProps> = ({
  open,
  onClose,
  commitSha,
  repo,
  commitMessage,
  author,
}) => {
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<string>("");
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !commitSha) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setDiff("");
    setFiles([]);

    api.getGithubCommit(commitSha, repo)
      .then((data: any) => {
        if (!mounted) return;
        if (data.diff) {
          setDiff(data.diff);
        } else if (data.files && Array.isArray(data.files)) {
          setFiles(data.files);
          const combined = data.files
            .map((f: any) => `diff --git a/${f.filename} b/${f.filename}\n${f.patch || ""}`)
            .join("\n\n");
          setDiff(combined || "No text diff available for this commit.");
        } else {
          setDiff("No patch changes found for this commit.");
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "Failed to load commit diff from GitHub.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, commitSha, repo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-4xl rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-canvas/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10 border border-brand/20 text-brand">
              <GitCommit className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-ink uppercase">
                  Commit Diff
                </span>
                <span className="font-mono text-2xs px-2 py-0.5 rounded bg-elevated border border-line text-brand">
                  {commitSha.slice(0, 7)}
                </span>
              </div>
              <p className="text-xs text-muted truncate max-w-xl font-sans mt-0.5">
                {commitMessage || `Commit ${commitSha}`} {author ? `by ${author}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <span className="text-xs font-mono">Fetching unified diff from GitHub...</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2.5 p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 text-2xs font-mono text-muted pb-1">
                  <span className="text-faint uppercase font-bold">Changed files:</span>
                  {files.map((f, i) => (
                    <span key={i} className="chip text-3xs border-line bg-canvas">
                      {f.filename} ({f.additions ? `+${f.additions}` : ""}{f.deletions ? ` -${f.deletions}` : ""})
                    </span>
                  ))}
                </div>
              )}
              <DiffViewer diff={diff} language="diff" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line bg-canvas/40 flex items-center justify-between">
          <div className="text-2xs font-mono text-muted">
            {repo ? `Repository: ${repo}` : "Live Codebase Provider"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-line text-xs font-mono text-muted hover:text-ink transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
