import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Github,
  Upload,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Zap,
  TrendingUp,
  Database,
  ShieldCheck,
  Workflow,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { realtimeStore, useActiveCodebase } from "@/store/realtimeStore";

export interface NewInvestigationModalProps {
  open: boolean;
  onClose: () => void;
  defaultRepo?: string;
}

type SourceType = "github" | "zip" | "active";

type InvestigationType =
  | "autonomous_swarm"
  | "regression"
  | "performance"
  | "cicd"
  | "security";

interface InvOption {
  id: InvestigationType;
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const INVESTIGATION_OPTIONS: InvOption[] = [
  {
    id: "autonomous_swarm",
    title: "Autonomous Diagnostic Swarm",
    badge: "Recommended",
    description:
      "Four specialized AI agents (Log, Code, Telemetry, Fix) simultaneously root-cause errors and generate verified fixes.",
    icon: Sparkles,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    id: "regression",
    title: "Regression & Breaking Changes",
    badge: "Git Diffs",
    description:
      "Deeply inspect recent commits, PR diffs, and breaking API signatures to locate breaking revisions.",
    icon: TrendingUp,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "performance",
    title: "Performance & N+1 Bottlenecks",
    badge: "Queries & Latency",
    description:
      "Audit high-latency endpoints, database query amplification (N+1 queries), and execution waterfalls.",
    icon: Database,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    id: "cicd",
    title: "CI/CD & GitHub Actions Failure",
    badge: "Build Logs",
    description:
      "Analyze failed workflow runs, unpack raw test execution logs, and diagnose broken build stages.",
    icon: Workflow,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    id: "security",
    title: "Security & Vulnerability Audit",
    badge: "AST Scan",
    description:
      "Search for hardcoded credentials, unsafe regex, injection vulnerabilities, and misconfigurations.",
    icon: ShieldCheck,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
];

export function NewInvestigationModal({
  open,
  onClose,
  defaultRepo = "",
}: NewInvestigationModalProps) {
  const navigate = useNavigate();
  const activeCodebase = useActiveCodebase();

  const [step, setStep] = useState<1 | 2>(1);
  const [sourceType, setSourceType] = useState<SourceType>("github");

  // GitHub form fields
  const [repoInput, setRepoInput] = useState(defaultRepo || "aman1011019/happy-ganesh-chaturthi");
  const [branchInput, setBranchInput] = useState("main");
  const [tokenInput, setTokenInput] = useState("");

  // ZIP form fields
  const [zipFile, setZipFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Investigation type
  const [invType, setInvType] = useState<InvestigationType>("autonomous_swarm");

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; technicalDetails?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setError(null);
      if (activeCodebase && activeCodebase.repository) {
        setSourceType("active");
        setRepoInput(activeCodebase.repository);
        setBranchInput(activeCodebase.branch || "main");
      } else if (defaultRepo) {
        setRepoInput(defaultRepo);
      }
    }
  }, [open, activeCodebase, defaultRepo]);

  if (!open) return null;

  const parseRepo = (input: string): { owner: string; name: string } => {
    const clean = input
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/$/, "");
    const parts = clean.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], name: parts[1] };
    }
    return { owner: "", name: "" };
  };

  const handleNext = () => {
    setError(null);
    if (sourceType === "github") {
      if (!repoInput.trim()) {
        setError({ message: "Please enter a GitHub repository (e.g. owner/repo or full URL)." });
        return;
      }
      const { owner, name } = parseRepo(repoInput);
      if (!owner || !name) {
        setError({
          message: "Please enter a valid GitHub repository in 'owner/repo' or 'https://github.com/owner/repo' format.",
        });
        return;
      }
    } else if (sourceType === "zip") {
      if (!zipFile) {
        setError({ message: "Please select a .zip codebase archive to upload." });
        return;
      }
    } else if (sourceType === "active") {
      if (!activeCodebase) {
        setError({ message: "No codebase is currently connected. Please choose GitHub or ZIP upload." });
        return;
      }
    }
    setStep(2);
  };

  const handleLaunch = async () => {
    if (loading) return; // Prevent double clicks
    setLoading(true);
    setError(null);

    try {
      // Validate investigation type selection (Section 4)
      const validTypes: InvestigationType[] = ["autonomous_swarm", "regression", "performance", "cicd", "security"];
      if (!invType || !validTypes.includes(invType)) {
        throw new Error("Please select a valid investigation type.");
      }

      let incidentId: number | null = null;
      let repositoryId: number | string | null = null;
      let repoOwner = "";
      let repoName = "";
      let repoBranch = "main";
      let repoCommit = "";
      let connectedCodebase: any = null;

      if (sourceType === "github" || (sourceType === "active" && activeCodebase?.type === "github")) {
        const targetRepo = sourceType === "active" ? (activeCodebase?.repository || repoInput) : repoInput;
        const targetBranch = sourceType === "active" ? (activeCodebase?.branch || branchInput || "main") : (branchInput || "main");

        const parsed = parseRepo(targetRepo);
        if (!parsed.owner || !parsed.name) {
          throw new Error("Please specify a valid repository in owner/repo format.");
        }

        // Step A: Connect repository and resolve real metadata from GitHub API
        const res = await api.connectGithubRepo({
          repo: `${parsed.owner}/${parsed.name}`,
          branch: targetBranch,
          token: tokenInput || undefined,
          investigation_type: invType,
        });

        if (!res.ok || !res.codebase) {
          throw new Error(res.message || "Failed to resolve repository metadata from GitHub.");
        }

        connectedCodebase = res.codebase;
        incidentId = res.incident_id;
        repositoryId = res.repository_id || res.codebase?.repository_id || 1;
        repoOwner = res.codebase?.owner || parsed.owner;
        repoName = res.codebase?.name || parsed.name;
        repoBranch = res.codebase?.branch || targetBranch;
        repoCommit = res.codebase?.commit_sha || "";

        // Verify required metadata exists before dispatching canonical investigation request (Section 5)
        if (!incidentId || !repoOwner || !repoName) {
          throw new Error("GitHub repository is connected, but repository metadata is incomplete.");
        }

        realtimeStore.setActiveCodebase(res.codebase);
        realtimeStore.saveStoredRepository(res.codebase);

        // Step B: Dispatch canonical POST /api/incidents/{incident_id}/investigate (Section 3)
        const invRes = await api.investigate(incidentId, {
          investigation_type: invType,
          repository_id: repositoryId,
          repository: {
            owner: repoOwner,
            name: repoName,
            branch: repoBranch,
            commit_sha: repoCommit,
          },
        });

        if (!invRes.success && invRes.status !== "started") {
          throw new Error(invRes.message || "DevGuard could not start the investigation request.");
        }
      } else if (sourceType === "zip") {
        if (!zipFile) throw new Error("No zip archive selected.");
        const res = await api.uploadCodebaseZip(zipFile);
        if (!res.ok || !res.codebase) {
          throw new Error("Failed to upload and analyze .zip codebase archive.");
        }
        connectedCodebase = res.codebase;
        incidentId = res.incidents?.[0]?.id || null;
        realtimeStore.setActiveCodebase(res.codebase);

        if (incidentId) {
          await api.investigate(incidentId, {
            investigation_type: invType,
            repository_id: 1,
            repository: {
              owner: "local",
              name: res.codebase.name || "zip-codebase",
              branch: "main",
              commit_sha: "head",
            },
          });
        }
      } else if (sourceType === "active" && activeCodebase) {
        connectedCodebase = activeCodebase;
        const parsed = parseRepo(activeCodebase.repository || repoInput);
        repoOwner = activeCodebase.owner || parsed.owner || "active";
        repoName = activeCodebase.name || parsed.name || "active-repo";
        repoBranch = activeCodebase.branch || "main";
        repoCommit = activeCodebase.commit_sha || "";
        repositoryId = activeCodebase.repository_id || 1;

        const actInc = await api.activeIncident().catch(() => null);
        incidentId = actInc ? actInc.id : null;

        if (incidentId) {
          await api.investigate(incidentId, {
            investigation_type: invType,
            repository_id: repositoryId,
            repository: {
              owner: repoOwner,
              name: repoName,
              branch: repoBranch,
              commit_sha: repoCommit,
            },
          });
        } else {
          const standaloneRes = await api.investigateStandalone({
            investigation_type: invType,
            repository_id: repositoryId,
            repository: {
              owner: repoOwner,
              name: repoName,
              branch: repoBranch,
              commit_sha: repoCommit,
            },
          });
          incidentId = standaloneRes.incident_id;
        }
      }

      // Save investigation to persistent browser history
      const invRecord = {
        id: incidentId || Date.now(),
        type: invType,
        title: INVESTIGATION_OPTIONS.find((o) => o.id === invType)?.title || "Investigation",
        repository: connectedCodebase?.repository || (repoOwner && repoName ? `${repoOwner}/${repoName}` : repoInput),
        branch: connectedCodebase?.branch || repoBranch,
        timestamp: new Date().toISOString(),
        status: "INVESTIGATING",
        source: sourceType === "zip" ? "ZIP Archive" : "Live GitHub",
      };
      realtimeStore.saveStoredInvestigation(invRecord);

      onClose();

      if (incidentId) {
        navigate(`/incidents/${incidentId}`);
      } else {
        navigate("/investigate");
      }
    } catch (err: any) {
      const errorMsg =
        err?.status === 405
          ? "Unable to start investigation — DevGuard could not start the investigation request."
          : err?.message || "Failed to launch investigation. Please verify repository details.";
      const techDetails =
        err?.technicalDetails ||
        (err?.status ? `HTTP ${err.status}: ${err?.detail ? JSON.stringify(err.detail) : err.message}` : undefined);

      setError({
        message: errorMsg,
        technicalDetails: techDetails,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                {step}
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                {step === 1 ? "Choose Codebase Source" : "Select Investigation Type"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 ml-8">
              {step === 1
                ? "Connect a live GitHub repository or upload a local .ZIP archive for zero-disk in-memory analysis."
                : "Choose the diagnostic focus for DevGuard's autonomous investigation agents."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error.message}</div>
              </div>
              {error.technicalDetails && (
                <details className="mt-2.5 pt-2 border-t border-red-200/60 cursor-pointer">
                  <summary className="text-[11px] font-semibold text-red-600 hover:text-red-800 select-none">
                    Technical details
                  </summary>
                  <pre className="mt-1.5 p-2 rounded-lg bg-red-100/70 text-[10px] font-mono text-red-900 whitespace-pre-wrap overflow-x-auto">
                    {error.technicalDetails}
                  </pre>
                </details>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {/* Source Type Selector */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSourceType("github")}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                    sourceType === "github"
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Github className="w-5 h-5 text-slate-800" />
                    {sourceType === "github" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">GitHub Repo</div>
                  <div className="text-[11px] text-slate-500">Live API, commits, actions & PRs</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType("zip")}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                    sourceType === "zip"
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Upload className="w-5 h-5 text-indigo-600" />
                    {sourceType === "zip" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Upload .ZIP</div>
                  <div className="text-[11px] text-slate-500">In-memory scan, zero storage</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType("active")}
                  disabled={!activeCodebase}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                    !activeCodebase
                      ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50"
                      : sourceType === "active"
                      ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs cursor-pointer"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Layers className="w-5 h-5 text-emerald-600" />
                    {sourceType === "active" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Active Codebase</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {activeCodebase ? activeCodebase.name : "None connected"}
                  </div>
                </button>
              </div>

              {/* GitHub Details View */}
              {sourceType === "github" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      GitHub Repository URL or Identifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={repoInput}
                      onChange={(e) => setRepoInput(e.target.value)}
                      placeholder="e.g. aman1011019/happy-ganesh-chaturthi or https://github.com/..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Quick fill:</span>
                      <button
                        type="button"
                        onClick={() => setRepoInput("aman1011019/happy-ganesh-chaturthi")}
                        className="text-[11px] text-blue-600 hover:underline font-mono"
                      >
                        aman1011019/happy-ganesh-chaturthi
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Branch or Ref
                      </label>
                      <input
                        type="text"
                        value={branchInput}
                        onChange={(e) => setBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        GitHub Token <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="ghp_... (for private repos or rate limits)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ZIP Upload View */}
              {sourceType === "zip" && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5">
                    <Upload className="w-5 h-5" />
                  </div>
                  {zipFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-900">{zipFile.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {(zipFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for in-memory AST scan
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                      >
                        Choose a different file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                      >
                        Select .ZIP Archive
                      </button>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Processed entirely in memory without writing to persistent disk.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Active Codebase View */}
              {sourceType === "active" && activeCodebase && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {activeCodebase.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {activeCodebase.branch}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Commit: <span className="font-mono">{activeCodebase.commit_sha?.slice(0, 7) || "HEAD"}</span> •{" "}
                      {activeCodebase.total_files} files • Health: {activeCodebase.health_score}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600 mb-2">
                Select the autonomous inspection mode to execute across this codebase:
              </p>
              {INVESTIGATION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = invType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setInvType(opt.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 border ${opt.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {step === 1 ? (
            <div>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Next: Investigation Type
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting investigation...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  Launch Investigation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
