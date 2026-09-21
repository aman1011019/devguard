import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GitBranch,
  Upload,
  FolderGit2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  refreshActiveCodebase,
  setActiveCodebase,
  useActiveCodebase,
} from "@/store/realtimeStore";
import { cn } from "@/lib/utils";

interface ConnectCodebaseModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "github" | "zip";
}

export const ConnectCodebaseModal: React.FC<ConnectCodebaseModalProps> = ({
  open,
  onClose,
  defaultTab = "github",
}) => {
  const queryClient = useQueryClient();
  const currentCodebase = useActiveCodebase();

  const [activeTab, setActiveTab] = useState<"github" | "zip">(defaultTab);

  // GitHub form state
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");

  // ZIP form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Status state
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    message: string;
    incidentsCount: number;
    filesCount: number;
  } | null>(null);

  if (!open) return null;

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError("Please enter a repository URL or owner/repo format.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);
    setScanStep("Connecting to GitHub REST API...");

    try {
      setTimeout(() => setScanStep("Downloading repository archive zipball into RAM..."), 500);
      setTimeout(() => setScanStep("Inspecting AST & syntax in memory (zero disk storage)..."), 1200);

      const res: any = await api.connectGithub({
        repo: repoUrl.trim(),
        branch: branch.trim() || "main",
        token: token.trim() || undefined,
      });

      if (res?.codebase) {
        setActiveCodebase(res.codebase);
      }

      await queryClient.invalidateQueries();
      await refreshActiveCodebase();

      setSuccessResult({
        message: res.message || "Connected successfully!",
        incidentsCount: res.incidents?.length || 0,
        filesCount: res.codebase?.total_files || 0,
      });

      // Auto close after brief confirmation
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to GitHub repository.");
    } finally {
      setLoading(false);
      setScanStep("");
    }
  };

  const handleUploadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a .zip archive of your project repository.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);
    setScanStep("Reading project archive into RAM...");

    try {
      setTimeout(() => setScanStep("Inspecting structure & syntax with zero disk storage..."), 600);
      setTimeout(() => setScanStep("Detecting performance regressions & N+1 patterns..."), 1300);

      const res: any = await api.uploadCodebaseZip(selectedFile);

      if (res?.codebase) {
        setActiveCodebase(res.codebase);
      }

      await queryClient.invalidateQueries();
      await refreshActiveCodebase();

      setSuccessResult({
        message: res.message || "ZIP archive uploaded and analyzed!",
        incidentsCount: res.incidents?.length || 0,
        filesCount: res.codebase?.total_files || 0,
      });

      // Auto close after brief confirmation
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Failed to process project .zip archive.");
    } finally {
      setLoading(false);
      setScanStep("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-canvas/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand/10 border border-brand/20 text-brand">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink font-mono uppercase tracking-wide">
                Connect Codebase
              </h3>
              <p className="text-xs text-muted">
                Analyze real source code, detect regressions, and generate verified patches.
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

        {/* Current Connection Status */}
        {currentCodebase && (
          <div className="px-6 py-2.5 bg-brand/5 border-b border-line flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted">Active Codebase:</span>
              <span className="font-mono font-bold text-ink">{currentCodebase.name}</span>
              <span className="text-2xs font-mono text-muted">({currentCodebase.branch})</span>
            </div>
            <span className="text-2xs font-mono text-brand font-medium">
              {currentCodebase.total_files} files · Health {currentCodebase.health_score}%
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-line bg-canvas/30 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("github");
              setError(null);
              setSuccessResult(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-t-lg border-t border-x transition-colors",
              activeTab === "github"
                ? "bg-surface border-line text-brand -mb-px"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <GitBranch className="h-4 w-4" />
            GitHub Repo
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("zip");
              setError(null);
              setSuccessResult(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-t-lg border-t border-x transition-colors",
              activeTab === "zip"
                ? "bg-surface border-line text-brand -mb-px"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Upload className="h-4 w-4" />
            Upload .ZIP
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successResult && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">{successResult.message}</div>
                <div className="text-2xs text-slate-600">
                  Indexed {successResult.filesCount} files · {successResult.incidentsCount} live incidents discovered and ready for autonomous investigation.
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: GITHUB */}
          {activeTab === "github" && (
            <form onSubmit={handleConnectGithub} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted uppercase mb-1.5 font-bold">
                  GitHub Repository URL or owner/repo
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository or owner/repo"
                  className="w-full rounded-lg border border-line bg-canvas/60 px-3.5 py-2 text-xs text-ink font-mono placeholder:text-faint focus:outline-none focus:border-brand"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted uppercase mb-1.5 font-bold">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-lg border border-line bg-canvas/60 px-3.5 py-2 text-xs text-ink font-mono placeholder:text-faint focus:outline-none focus:border-brand"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted uppercase mb-1.5 font-bold">
                    GitHub Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxx (for private repos)"
                    className="w-full rounded-lg border border-line bg-canvas/60 px-3.5 py-2 text-xs text-ink font-mono placeholder:text-faint focus:outline-none focus:border-brand"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Tips & Formats */}
              <div className="flex items-center gap-2 text-2xs font-mono text-muted">
                <span className="text-faint uppercase font-bold">Supported:</span>
                <span>public/private repos, e.g. <code className="text-ink">owner/repo</code> or full URL</span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-line text-xs font-mono text-muted hover:text-ink transition-colors"
                  disabled={loading}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-brand hover:bg-brand/90 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-brand/20 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-4 w-4" />
                      Connect &amp; Scan
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: UPLOAD ZIP */}
          {activeTab === "zip" && (
            <form onSubmit={handleUploadZip} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f && f.name.endsWith(".zip")) {
                    setSelectedFile(f);
                  } else {
                    setError("Please upload a .zip archive.");
                  }
                }}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer bg-canvas/40",
                  dragOver
                    ? "border-brand bg-brand/5"
                    : selectedFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-line hover:border-brand/40"
                )}
                onClick={() => {
                  const el = document.getElementById("codebase-zip-input");
                  el?.click();
                }}
              >
                <input
                  id="codebase-zip-input"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileCode className="h-10 w-10 mx-auto text-emerald-500" />
                    <div className="font-mono text-xs font-bold text-ink">{selectedFile.name}</div>
                    <div className="text-2xs text-muted">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready for analysis
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-muted" />
                    <div className="font-bold text-xs text-ink font-mono uppercase">
                      Drag &amp; drop project .zip here
                    </div>
                    <div className="text-2xs text-muted">or click to browse from your computer</div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-line text-xs font-mono text-muted hover:text-ink transition-colors"
                  disabled={loading}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="px-5 py-2 rounded-lg bg-brand hover:bg-brand/90 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-brand/20 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing ZIP...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload &amp; Scan
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Scanning Progress Banner */}
          {loading && scanStep && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-brand/30 bg-brand/10 text-xs font-mono text-brand animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{scanStep}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
