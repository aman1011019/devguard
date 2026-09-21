import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  GitBranch,
  Github,
  Upload,
  PlusCircle,
  LayoutDashboard,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  FileCode2,
  ExternalLink,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { api } from "@/lib/api";
import { realtimeStore, useActiveCodebase, useRealtimeStore } from "@/store/realtimeStore";
import { NewInvestigationModal } from "@/components/modals/NewInvestigationModal";
import { StatusBadge, SeverityBadge } from "@/components/ui/Badge";
import { useIncidents, useHealth } from "@/hooks/useQueries";

export default function Home() {
  const navigate = useNavigate();
  const activeCodebase = useActiveCodebase();
  const systemStats = useRealtimeStore((s) => s.systemStats);
  const { data: health } = useHealth();
  const { data: incidentsList, refetch: refetchIncidents } = useIncidents();

  const [investigationModalOpen, setInvestigationModalOpen] = useState(false);
  const [selectedRepoForModal, setSelectedRepoForModal] = useState<string>("");
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [connectedRepos, setConnectedRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Fetch GitHub rate limits & connected repos
  const loadStatusAndRepos = async () => {
    try {
      setLoadingRepos(true);
      const [statusRes, reposRes] = await Promise.all([
        api.getGithubStatus().catch(() => null),
        api.getGithubRepos().catch(() => []),
      ]);
      setGithubStatus(statusRes);

      // Merge backend database repos with any stored in localStorage
      const localRepos = realtimeStore.getStoredRepositories();
      const combined = [...(reposRes || [])];
      const seen = new Set(combined.map((r: any) => r.full_name?.toLowerCase()));
      for (const lr of localRepos) {
        if (lr && lr.repository && !seen.has(lr.repository.toLowerCase())) {
          combined.push({
            id: null,
            owner: lr.repository.split("/")[0],
            name: lr.repository.split("/")[1] || lr.repository,
            full_name: lr.repository,
            url: lr.html_url || `https://github.com/${lr.repository}`,
            default_branch: lr.branch || "main",
            language: lr.primary_language || "Unknown",
            stars: lr.stars || 0,
            last_commit_sha: lr.commit_sha || "",
          });
          seen.add(lr.repository.toLowerCase());
        }
      }
      setConnectedRepos(combined);
    } catch (err) {
      console.error("Failed to load GitHub status or repos", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    loadStatusAndRepos();
  }, []);

  // Retrieve stored investigations from localStorage
  const storedInvestigations = realtimeStore.getStoredInvestigations();

  const handleDisconnect = async () => {
    try {
      await api.disconnectGithub();
      realtimeStore.setActiveCodebase(null);
      loadStatusAndRepos();
    } catch (err) {
      console.error("Disconnect error", err);
    }
  };

  const handleStartInvestigationFor = (repoFullName: string) => {
    setSelectedRepoForModal(repoFullName);
    setInvestigationModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Enterprise Hero & Quick Launch ────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-linear-to-b from-white to-slate-50/50 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              Real-Time AI Incident Platform
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Continuous Codebase Guard & Incident Intelligence
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Connect your live GitHub repositories or upload project archives for autonomous
              in-memory diagnostics, AST regression detection, and multi-agent incident resolution.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setSelectedRepoForModal("");
                setInvestigationModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              New Investigation
            </button>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <LayoutDashboard className="h-4 w-4 text-slate-500" />
              Command Center
            </Link>
          </div>
        </div>
      </section>

      {/* ── Active Codebase Showcase ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              {activeCodebase?.type === "zip" ? (
                <Upload className="h-5 w-5 text-indigo-600" />
              ) : (
                <Github className="h-5 w-5 text-slate-800" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Connected Codebase</h2>
              <p className="text-xs text-slate-500">
                Current repository inspected by DevGuard autonomous swarms
              </p>
            </div>
          </div>

          {activeCodebase && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                Disconnect
              </button>
              <button
                onClick={() => handleStartInvestigationFor(activeCodebase.repository)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Inspect Codebase
              </button>
            </div>
          )}
        </div>

        {activeCodebase ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Repository</div>
              <div className="mt-1 font-bold text-slate-900 text-sm truncate">
                {activeCodebase.repository || activeCodebase.name}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-600">
                <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono">{activeCodebase.branch || "main"}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Latest Commit</div>
              <div className="mt-1 font-mono text-xs font-bold text-slate-900">
                {activeCodebase.commit_sha ? activeCodebase.commit_sha.slice(0, 7) : "HEAD"}
              </div>
              <div className="mt-2 text-xs text-slate-500 truncate">
                by {activeCodebase.author || "Unknown"}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Files & Health</div>
              <div className="mt-1 font-bold text-slate-900 text-sm">
                {activeCodebase.total_files || 0} files indexed
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {activeCodebase.health_score || 98}% Code Health
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Source Mode</div>
              <div className="mt-1 font-bold text-slate-900 text-sm">
                {activeCodebase.type === "zip" ? "In-Memory ZIP" : "Live GitHub REST"}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Zero disk storage • In-memory RAM
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Github className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Codebase Connected</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Connect a real GitHub repository or upload a .ZIP project to enable AST scanning,
              diff comparisons, and continuous incident prevention.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setSelectedRepoForModal("");
                  setInvestigationModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                <PlusCircle className="h-4 w-4" />
                Connect Codebase
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Metric Highlights Grid ────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">System Posture</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {health?.status === "ok" ? "Operational" : "Guarded"}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Active incidents: {systemStats.activeIncidents} • Services: 5 monitored
          </p>
        </div>

        {/* GitHub Rate Limit */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">GitHub API Rate Limit</span>
            <Github className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {githubStatus ? `${githubStatus.rate_limit_remaining} / ${githubStatus.rate_limit}` : "60 / 60"}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {githubStatus?.authenticated ? "Authenticated Token" : "Public Rate Limit (No token)"}
          </p>
        </div>

        {/* Diagnostic Swarm Agents */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Autonomous Swarm</span>
            <Cpu className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">4 Agents Ready</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Log • Code • Telemetry • Fix
          </p>
        </div>

        {/* Connected Repositories */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Monitored Repos</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {connectedRepos.length} Repositories
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Persisted in SQLite database & browser
          </p>
        </div>
      </section>

      {/* ── Connected Repositories & Quick Actions ─────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Connected Repositories</h2>
            <p className="text-xs text-slate-500">
              Repositories registered in DevGuard for live AST audits and GitHub Actions tracking
            </p>
          </div>
          <button
            onClick={loadStatusAndRepos}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh repositories"
          >
            <RefreshCw className={`h-4 w-4 ${loadingRepos ? "animate-spin" : ""}`} />
          </button>
        </div>

        {connectedRepos.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {connectedRepos.map((repo, idx) => (
              <div
                key={repo.full_name || idx}
                className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Github className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {repo.full_name || `${repo.owner}/${repo.name}`}
                      </span>
                      {activeCodebase?.repository === repo.full_name && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                      <span>Branch: {repo.default_branch || "main"}</span>
                      {repo.language && <span>Lang: {repo.language}</span>}
                      {repo.last_commit_sha && (
                        <span className="font-mono">Commit: {repo.last_commit_sha.slice(0, 7)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleStartInvestigationFor(repo.full_name)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Investigate
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No repositories connected yet. Click "New Investigation" to connect one.
          </div>
        )}
      </section>

      {/* ── Recent Investigations Section ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Investigations</h2>
            <p className="text-xs text-slate-500">
              Autonomous diagnosis history and incident root causes
            </p>
          </div>
          <Link
            to="/incidents"
            className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            View all incidents
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {incidentsList && incidentsList.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {incidentsList.slice(0, 5).map((inc) => (
              <div
                key={inc.id}
                onClick={() => navigate(`/incidents/${inc.id}`)}
                className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                    #{inc.id}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {inc.title}
                      </span>
                      <SeverityBadge severity={inc.severity} />
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                      <span>Service: {inc.service}</span>
                      <span>Status: {inc.status}</span>
                      {inc.detected_at && (
                        <span>Detected: {new Date(inc.detected_at).toLocaleTimeString([], { hour12: false })}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    Inspect &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No incidents detected yet.
          </div>
        )}
      </section>

      {/* New Investigation Wizard Modal */}
      <NewInvestigationModal
        open={investigationModalOpen}
        onClose={() => setInvestigationModalOpen(false)}
        defaultRepo={selectedRepoForModal}
      />
    </div>
  );
}
