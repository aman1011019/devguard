import { z } from "zod";
import * as T from "./types";

/** Same-origin by default: works behind the Vite dev proxy, when the FastAPI
 *  backend serves the built bundle (packaged .exe), and inside a native shell
 *  where VITE_API_BASE points at the bundled server. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
    readonly code?: string,
    readonly technicalDetails?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S | null,
  init?: RequestInit
): Promise<z.infer<S>> {
  let res: Response;
  const url = `${API_BASE}${path}`;
  try {
    res = await fetch(url, {
      headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      ...init,
    });
  } catch (cause) {
    if (!API_BASE && typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port !== "8000") {
      try {
        res = await fetch(`http://127.0.0.1:8000${path}`, {
          headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
          ...init,
        });
      } catch {
        throw new ApiError(
          "Cannot reach the DevGuard backend. Is the API running on port 8000?",
          0,
          cause
        );
      }
    } else {
      throw new ApiError(
        "Cannot reach the DevGuard backend. Is the API running on port 8000?",
        0,
        cause
      );
    }
  }

  // If a local static preview returned 405 Method Not Allowed or 404, fallback directly to backend on 8000
  if ((res.status === 405 || res.status === 404) && !API_BASE && typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port !== "8000") {
    try {
      const fallbackRes = await fetch(`http://127.0.0.1:8000${path}`, {
        headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
        ...init,
      });
      if (fallbackRes.ok || (fallbackRes.status !== 404 && fallbackRes.status !== 405)) {
        res = fallbackRes;
      }
    } catch {
      // Keep original res
    }
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => "");
    }

    let msg = `Request failed (${res.status} ${res.statusText})`;
    let code = `HTTP_${res.status}`;
    let technicalDetails = "";

    if (detail && typeof detail === "object") {
      const errObj = (detail as any).error;
      if (errObj && typeof errObj === "object") {
        msg = errObj.message || msg;
        code = errObj.code || code;
        technicalDetails = errObj.details || "";
      } else if ((detail as any).detail) {
        msg = String((detail as any).detail);
      }
    } else if (typeof detail === "string" && detail.trim()) {
      msg = detail;
    }

    if (res.status === 405) {
      msg = "Unable to start investigation — DevGuard could not start the investigation request.";
      code = "METHOD_NOT_ALLOWED";
      technicalDetails = technicalDetails || "Expected POST /api/incidents/{id}/investigate";
    }

    throw new ApiError(msg, res.status, detail, code, technicalDetails);
  }

  if (res.status === 204) return undefined as z.infer<S>;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return (await res.text()) as z.infer<S>;

  const json = await res.json();
  if (!schema) return json as z.infer<S>;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`Unexpected response shape for ${path}`, 500, parsed.error.issues);
  }
  return parsed.data;
}


const post = (body?: unknown): RequestInit => ({
  method: "POST",
  body: body === undefined ? undefined : JSON.stringify(body),
});

const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });

export const api = {
  health: () => request("/api/health", T.Health),
  agents: () => request("/api/meta/agents", z.array(T.AgentMeta)),

  listIncidents: () => request("/api/incidents", z.array(T.IncidentSummary)),
  activeIncident: () => request("/api/incidents/active", T.IncidentDetail.nullable()),
  incident: (id: number) => request(`/api/incidents/${id}`, T.IncidentDetail),
  metrics: (id: number) => request(`/api/incidents/${id}/metrics`, T.MetricsBundle),
  logs: (id: number) => request(`/api/incidents/${id}/logs`, z.array(T.LogEntry)),
  evidence: (id: number) => request(`/api/incidents/${id}/evidence`, T.EvidenceBundle),
  investigation: (id: number) => request(`/api/incidents/${id}/investigation`, T.Investigation),
  rootCause: (id: number) => request(`/api/incidents/${id}/root-cause`, T.RootCause),
  fix: (id: number) => request(`/api/incidents/${id}/fix`, T.Fix),
  tests: (id: number) => request(`/api/incidents/${id}/tests`, T.TestRun),
  reportUrl: (id: number) => `${API_BASE}/api/incidents/${id}/report.html`,

  investigate: (
    id: number,
    payload?: {
      investigation_type?: string;
      repository_id?: number | string | null;
      repository?: {
        owner?: string;
        name?: string;
        branch?: string;
        commit_sha?: string;
      };
    }
  ) =>
    request(
      `/api/incidents/${id}/investigate`,
      T.InvestigationLaunchResponse,
      post(payload ?? { investigation_type: "autonomous_swarm" })
    ),
  investigateStandalone: (payload: {
    investigation_type?: string;
    incident_id?: number | null;
    repository_id?: number | string | null;
    repository?: {
      owner?: string;
      name?: string;
      branch?: string;
      commit_sha?: string;
    };
  }) =>
    request("/api/incidents/investigate", T.InvestigationLaunchResponse, post(payload)),
  generateFix: (id: number) => request(`/api/incidents/${id}/generate-fix`, T.Fix, post()),
  approveFix: (id: number) =>
    request(`/api/incidents/${id}/approve-fix`, T.ActionResponse, post()),
  rejectFix: (id: number) => request(`/api/incidents/${id}/reject-fix`, T.ActionResponse, post()),
  runTests: (id: number) => request(`/api/incidents/${id}/test-run`, T.ActionResponse, post()),

  injectIncident: () => request("/api/demo/inject-incident", T.IncidentDetail, post()),
  resetDemo: () => request("/api/demo/reset", T.ActionResponse, post()),

  voice: (command: string) => request("/api/voice/command", T.VoiceResponse, post({ command })),
  analyzeImage: (file?: File | null) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    return request("/api/incidents/analyze-image", T.ImageAnalysis, { method: "POST", body: fd });
  },

  officeKitStatus: () => request("/api/office-kit/status", T.OfficeKitStatus),
  officeKitSync: (action: string, payload: Record<string, unknown> = {}) =>
    request("/api/office-kit/sync", T.OfficeKitSync, post({ action, payload })),

  scanLocal: (path: string) => request("/api/codebase/scan-local", T.CodebaseScan, post({ path })),
  scanUpload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/codebase/upload", T.CodebaseScan, { method: "POST", body: fd });
  },
  patchUrl: (scanId: string, issueId: string) =>
    `${API_BASE}/api/codebase/scans/${scanId}/patch/${issueId}`,

  // ── Real Codebase Integration ──────────────────────────────────────────────
  connectGithub: async (data: { repo: string; branch?: string; token?: string }) => {
    try {
      return await request("/api/codebase/github", null, post(data));
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 405) {
        return await request("/api/github/connect", null, post(data));
      }
      throw err;
    }
  },
  connectGithubRepo: (data: { repo: string; branch?: string; token?: string; investigation_type?: string }) =>
    request("/api/github/connect", null, post(data)),
  disconnectGithub: () => request("/api/github/disconnect", null, post({})),
  getGithubStatus: () => request("/api/github/status", null),
  getGithubRepos: () => request("/api/github/repos", null),
  getGithubBranches: (repo?: string) =>
    request(`/api/github/branches${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`, null),
  getGithubCommits: (repo?: string, branch?: string, page: number = 1, per_page: number = 20) => {
    const params = new URLSearchParams();
    if (repo) params.set("repo", repo);
    if (branch) params.set("branch", branch);
    if (page > 1) params.set("page", String(page));
    if (per_page !== 20) params.set("per_page", String(per_page));
    const qs = params.toString();
    return request(`/api/github/commits${qs ? `?${qs}` : ""}`, null);
  },
  getGithubCommit: (sha: string, repo?: string) =>
    request(`/api/github/commits/${sha}${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`, null),
  getGithubTree: (repo?: string, ref?: string) => {
    const params = new URLSearchParams();
    if (repo) params.set("repo", repo);
    if (ref) params.set("ref", ref);
    const qs = params.toString();
    return request(`/api/github/tree${qs ? `?${qs}` : ""}`, null);
  },
  getGithubWorkflows: (repo?: string) =>
    request(`/api/github/workflows${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`, null),
  getGithubRuns: (repo?: string, status?: string) => {
    const params = new URLSearchParams();
    if (repo) params.set("repo", repo);
    if (status) params.set("status", status);
    const qs = params.toString();
    return request(`/api/github/runs${qs ? `?${qs}` : ""}`, null);
  },
  getGithubActions: (repo?: string) => {
    return request(`/api/github/actions${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`, null);
  },
  getGithubCompare: (base: string, head: string, repo?: string) => {
    const params = new URLSearchParams({ base, head });
    if (repo) params.set("repo", repo);
    return request(`/api/github/compare?${params.toString()}`, null);
  },
  getGithubLogs: (runId: number | string, repo?: string) =>
    request(`/api/github/runs/${runId}/logs${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`, null),
  getGithubFile: (path: string, ref?: string, repo?: string) => {
    const params = new URLSearchParams();
    if (ref) params.set("ref", ref);
    if (repo) params.set("repo", repo);
    const qs = params.toString();
    return request(`/api/github/files/${path}${qs ? `?${qs}` : ""}`, null);
  },
  uploadCodebaseZip: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/codebase/upload", null, { method: "POST", body: fd });
  },
  scanActiveCodebase: () => request("/api/codebase/scan-local", null, post({})),
  getActiveCodebase: () => request("/api/codebase/active", null),
  incidentPatchUrl: (incidentId: number) => `${API_BASE}/api/incidents/${incidentId}/patch`,
  applyIncidentPatch: (incidentId: number) =>
    request(`/api/incidents/${incidentId}/apply-patch`, null, post({})),

  settings: () => request("/api/settings", T.UserSettings),
  updateSettings: (payload: T.UserSettingsInput) =>
    request("/api/settings", T.UserSettings, put(payload)),

  // ── Real-Time Command Center APIs ──────────────────────────────────────────
  services: () => request("/api/services", null),
  serviceDetail: (id: string) => request(`/api/services/${id}`, null),
  search: (q: string) => request(`/api/search?q=${encodeURIComponent(q)}`, null),
  telemetrySource: () => request("/api/telemetry/source", null),
  systemEvents: (after?: string) =>
    request(`/api/events${after ? `?after=${encodeURIComponent(after)}` : ""}`, null),
  incidentEvents: (id: number, after?: string) =>
    request(`/api/incidents/${id}/events${after ? `?after=${encodeURIComponent(after)}` : ""}`, null),
  reportIncident: (data: { service: string; severity: string; description: string; repository?: string; branch?: string }) =>
    request("/api/incidents", null, post(data)),
  ingestLog: (data: { service: string; level: string; message: string; trace_id?: string; request_id?: string; incident_id?: number }) =>
    request("/api/logs/ingest", null, post(data)),
  ingestTelemetry: (data: { service: string; latency_ms: number; error_rate: number; db_queries: number; db_latency_ms?: number; incident_id?: number }) =>
    request("/api/telemetry", null, post(data)),
  triggerGithubTestFail: () => request("/api/webhooks/github/test-fail", null, post({})),
};

/** ws:// URL for a channel ("system" or incidentId). */
export function wsUrl(channel: number | string): string {
  const norm = String(channel).toLowerCase();
  const path = norm === "0" || norm === "system" || norm === "global" ? "ws/system" : `ws/${channel}`;
  if (API_BASE) {
    return `${API_BASE.replace(/^http/, "ws")}/${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/${path}`;
}
