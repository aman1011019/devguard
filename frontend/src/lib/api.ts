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
    readonly detail?: unknown
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
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      ...init,
    });
  } catch (cause) {
    throw new ApiError(
      "Cannot reach the DevGuard backend. Is the API running on port 8000?",
      0,
      cause
    );
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => "");
    }
    const msg =
      (detail as any)?.detail ?? `Request failed (${res.status} ${res.statusText})`;
    throw new ApiError(typeof msg === "string" ? msg : "Request failed", res.status, detail);
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

  investigate: (id: number) =>
    request(`/api/incidents/${id}/investigate`, T.ActionResponse, post()),
  generateFix: (id: number) => request(`/api/incidents/${id}/generate-fix`, T.Fix, post()),
  approveFix: (id: number) =>
    request(`/api/incidents/${id}/approve-fix`, T.ActionResponse, post()),
  rejectFix: (id: number) => request(`/api/incidents/${id}/reject-fix`, T.ActionResponse, post()),
  runTests: (id: number) => request(`/api/incidents/${id}/run-tests`, T.ActionResponse, post()),

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

  settings: () => request("/api/settings", T.UserSettings),
  updateSettings: (payload: T.UserSettingsInput) =>
    request("/api/settings", T.UserSettings, put(payload)),

  // ── Real-Time Command Center APIs ──────────────────────────────────────────
  services: () => request("/api/services", null),
  serviceDetail: (id: string) => request(`/api/services/${id}`, null),
  search: (q: string) => request(`/api/search?q=${encodeURIComponent(q)}`, null),
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
