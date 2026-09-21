/** Central reactive real-time store for DevGuard. */
import { useEffect, useState } from "react";

export type ConnectionStatus = "LIVE" | "RECONNECTING" | "OFFLINE";
export type DataSource =
  | "LIVE GITHUB"
  | "UPLOADED ZIP"
  | "LOCAL WORKSPACE"
  | "LIVE TELEMETRY"
  | "LIVE PROMETHEUS"
  | "DEMO ENGINE";

export interface ActiveCodebase {
  type: "github" | "zip" | "local";
  name: string;
  repository: string;
  branch: string;
  commit_sha: string;
  author: string;
  commit_message?: string;
  path?: string;
  total_files: number;
  total_lines: number;
  health_score: number;
  issues_count: number;
  language_counts?: Record<string, number>;
  profile?: any;
}

export interface ActivityEvent {
  event_id: string;
  timestamp: string;
  type: string;
  event: string;
  source?: string;
  message?: string;
  service?: string;
  incident_id?: number | string | null;
  detail?: any;
}

export interface ServiceItem {
  id: string;
  name: string;
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  latency_ms: number;
  error_rate: number;
  db_queries_per_req: number;
  requests_per_sec: string;
  version: string;
  description: string;
  last_incident_id?: number | null;
}

export interface SystemStats {
  activeIncidents: number;
  investigating: number;
  criticalServices: number;
  resolvedToday: number;
}

interface RealtimeState {
  connectionStatus: ConnectionStatus;
  dataSource: DataSource;
  activeCodebase: ActiveCodebase | null;
  lastEventId: string | null;
  activityEvents: ActivityEvent[];
  services: ServiceItem[];
  systemStats: SystemStats;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: "checkout-api",
    name: "Checkout API",
    status: "CRITICAL",
    latency_ms: 4800,
    error_rate: 21.8,
    db_queries_per_req: 25,
    requests_per_sec: "1.8k rps",
    version: "v1.8.4",
    description: "Customer payment checkout & inventory reservation pipeline",
  },
  {
    id: "payments-api",
    name: "Payments API",
    status: "HEALTHY",
    latency_ms: 95,
    error_rate: 0.05,
    db_queries_per_req: 2,
    requests_per_sec: "850 rps",
    version: "v2.3.1",
    description: "Third-party payment gateways (Stripe, Adyen, PayPal)",
  },
  {
    id: "auth-service",
    name: "Auth Service",
    status: "HEALTHY",
    latency_ms: 42,
    error_rate: 0.01,
    db_queries_per_req: 1,
    requests_per_sec: "4.2k rps",
    version: "v3.0.4",
    description: "OAuth2 / OIDC authentication token verification",
  },
  {
    id: "orders-service",
    name: "Orders Service",
    status: "DEGRADED",
    latency_ms: 680,
    error_rate: 4.2,
    db_queries_per_req: 14,
    requests_per_sec: "620 rps",
    version: "v1.8.4",
    description: "Order lifecycle, invoice rendering, and dispatch queue",
  },
  {
    id: "database-aurora",
    name: "Database",
    status: "DEGRADED",
    latency_ms: 320,
    error_rate: 2.8,
    db_queries_per_req: 25,
    requests_per_sec: "18.4k qps",
    version: "PostgreSQL 16.2",
    description: "Primary transactional relational datastore cluster",
  },
];

const STORAGE_KEY_CODEBASE = "devguard_active_codebase";
const STORAGE_KEY_REPOSITORIES = "devguard_repositories";
const STORAGE_KEY_INVESTIGATIONS = "devguard_investigations";

function loadStoredCodebase(): ActiveCodebase | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CODEBASE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialStoredCodebase = loadStoredCodebase();

let state: RealtimeState = {
  connectionStatus: "LIVE",
  dataSource: initialStoredCodebase
    ? (initialStoredCodebase.type === "zip" ? "UPLOADED ZIP" : "LIVE GITHUB")
    : "DEMO ENGINE",
  activeCodebase: initialStoredCodebase,
  lastEventId: null,
  activityEvents: [
    {
      event_id: "evt_000001",
      timestamp: new Date(Date.now() - 45000).toLocaleTimeString([], { hour12: false }),
      type: "workflow_run_failed",
      event: "workflow_run_failed",
      source: "GitHub Actions",
      message: "checkout-api / main Workflow failed",
      service: "Checkout API",
    },
    {
      event_id: "evt_000002",
      timestamp: new Date(Date.now() - 38000).toLocaleTimeString([], { hour12: false }),
      type: "incident_created",
      event: "incident_created",
      source: "DevGuard",
      message: "Checkout API latency & error threshold breached",
      service: "Checkout API",
    },
    {
      event_id: "evt_000003",
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString([], { hour12: false }),
      type: "agent_started",
      event: "agent_started",
      source: "LOG AGENT",
      message: "Mining application logs for checkout timeout patterns...",
      service: "Checkout API",
    },
    {
      event_id: "evt_000004",
      timestamp: new Date(Date.now() - 22000).toLocaleTimeString([], { hour12: false }),
      type: "agent_started",
      event: "agent_started",
      source: "CODE AGENT",
      message: "Analyzing deployment v1.8.4 commit a81f2c7 by j.tanaka...",
      service: "Checkout API",
    },
    {
      event_id: "evt_000005",
      timestamp: new Date(Date.now() - 15000).toLocaleTimeString([], { hour12: false }),
      type: "agent_started",
      event: "agent_started",
      source: "TELEMETRY AGENT",
      message: "Detected database query spike from 3 to 25/request...",
      service: "Checkout API",
    },
  ],
  services: DEFAULT_SERVICES,
  systemStats: {
    activeIncidents: 1,
    investigating: 1,
    criticalServices: 1,
    resolvedToday: 7,
  },
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const realtimeStore = {
  getState: () => state,

  setConnectionStatus: (status: ConnectionStatus) => {
    if (state.connectionStatus !== status) {
      state = { ...state, connectionStatus: status };
      notify();
    }
  },

  setDataSource: (source: DataSource) => {
    if (state.dataSource !== source) {
      state = { ...state, dataSource: source };
      notify();
    }
  },

  setActiveCodebase: (codebase: ActiveCodebase | null) => {
    let source: DataSource = "DEMO ENGINE";
    if (codebase) {
      if (codebase.type === "zip") source = "UPLOADED ZIP";
      else if (codebase.type === "local") source = "LOCAL WORKSPACE";
      else source = "LIVE GITHUB";
      try {
        localStorage.setItem(STORAGE_KEY_CODEBASE, JSON.stringify(codebase));
      } catch {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY_CODEBASE);
      } catch {}
    }
    state = {
      ...state,
      activeCodebase: codebase,
      dataSource: source,
    };
    notify();
  },

  getStoredRepositories: (): any[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REPOSITORIES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveStoredRepository: (repo: any) => {
    try {
      const existing = realtimeStore.getStoredRepositories();
      const filtered = existing.filter((r: any) => r.full_name !== repo.full_name && r.name !== repo.name);
      const updated = [repo, ...filtered].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_REPOSITORIES, JSON.stringify(updated));
    } catch {}
  },

  getStoredInvestigations: (): any[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INVESTIGATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveStoredInvestigation: (inv: any) => {
    try {
      const existing = realtimeStore.getStoredInvestigations();
      const filtered = existing.filter((i: any) => i.id !== inv.id);
      const updated = [inv, ...filtered].slice(0, 50);
      localStorage.setItem(STORAGE_KEY_INVESTIGATIONS, JSON.stringify(updated));
    } catch {}
  },

  refreshActiveCodebase: async () => {
    try {
      const res = await fetch("/api/codebase/active");
      if (res.ok) {
        const data = await res.json();
        if (data && (data.repository || data.name)) {
          realtimeStore.setActiveCodebase({
            type: data.type || (data.path ? "local" : "github"),
            name: data.repository || data.name || "Connected Repository",
            repository: data.repository || data.name || "",
            branch: data.branch || "main",
            commit_sha: data.commit_sha || "HEAD",
            author: data.author || "Developer",
            commit_message: data.commit_message,
            path: data.path,
            total_files: data.total_files || 0,
            total_lines: data.total_lines || 0,
            health_score: data.health_score || 95,
            issues_count: data.issues_count || 0,
            language_counts: data.language_counts || {},
            profile: data.profile,
          });
        }
      }
    } catch {
      // Backend not reached or no active codebase yet
    }
  },

  setLastEventId: (id: string | null) => {
    state = { ...state, lastEventId: id };
  },

  setSystemStats: (stats: Partial<SystemStats>) => {
    state = {
      ...state,
      systemStats: { ...state.systemStats, ...stats },
    };
    notify();
  },

  setServices: (services: ServiceItem[]) => {
    state = { ...state, services };
    notify();
  },

  addEvent: (rawEvent: any) => {
    const evType = rawEvent.event || rawEvent.type || "event";
    const event_id = rawEvent.event_id || `evt_${Date.now()}`;
    const timestamp = rawEvent.timestamp
      ? rawEvent.timestamp.includes("T")
        ? new Date(rawEvent.timestamp).toLocaleTimeString([], { hour12: false })
        : rawEvent.timestamp
      : new Date().toLocaleTimeString([], { hour12: false });

    // Derive readable message and source
    let source = rawEvent.source;
    let message = rawEvent.message;

    if (evType === "metric_updated") {
      const p = rawEvent.payload || rawEvent;
      const svcName = p.service || rawEvent.service || "checkout-api";
      const latency = p.latency_ms !== undefined ? p.latency_ms : undefined;
      const errRate = p.error_rate !== undefined ? p.error_rate : undefined;
      const reqRate = p.request_rate !== undefined ? `${p.request_rate} rps` : undefined;
      const queries = p.db_queries_per_req !== undefined ? p.db_queries_per_req : (p.db_queries !== undefined ? p.db_queries : undefined);

      const metricSource: DataSource = p.source === "LIVE PROMETHEUS" ? "LIVE PROMETHEUS" : "LIVE TELEMETRY";
      source = metricSource;
      message = `Telemetry received for ${svcName}: ${latency ?? 0}ms latency, ${errRate ?? 0}% error rate`;

      state = {
        ...state,
        dataSource: metricSource,
        services: state.services.map((s) => {
          if (s.id === svcName || s.name.toLowerCase() === svcName.toLowerCase()) {
            const nextLat = latency !== undefined ? latency : s.latency_ms;
            const nextErr = errRate !== undefined ? errRate : s.error_rate;
            return {
              ...s,
              latency_ms: nextLat,
              error_rate: nextErr,
              requests_per_sec: reqRate !== undefined ? reqRate : s.requests_per_sec,
              db_queries_per_req: queries !== undefined ? queries : s.db_queries_per_req,
              status: (nextErr > 15 || nextLat > 2000) ? "CRITICAL" : (nextErr > 3 || nextLat > 500) ? "DEGRADED" : "HEALTHY",
            };
          }
          return s;
        }),
      };
    } else if (evType === "log_received" || evType === "log_entry") {
      const p = rawEvent.payload || rawEvent;
      source = "LIVE TELEMETRY";
      message = `[${(p.level || "INFO").toUpperCase()}] ${p.message || ""}`;
    } else if (evType === "codebase_switched" || evType === "codebase_connected") {
      const p = rawEvent.payload || rawEvent;
      if (p.codebase) {
        realtimeStore.setActiveCodebase(p.codebase);
      }
    }

    if (!source) {
      if (rawEvent.agent) {
        source = `${rawEvent.agent.toUpperCase()} AGENT`;
      } else if (evType.includes("github") || evType.includes("workflow")) {
        source = "GitHub Actions";
      } else {
        source = "DevGuard";
      }
    }

    if (!message) {
      if (rawEvent.finding) {
        message = rawEvent.finding;
      } else if (rawEvent.root_cause) {
        message = `Root cause identified: ${rawEvent.root_cause}`;
      } else if (rawEvent.title) {
        message = rawEvent.title;
      } else {
        message = evType.replace(/_/g, " ");
      }
    }

    const newEvent: ActivityEvent = {
      event_id,
      timestamp,
      type: evType,
      event: evType,
      source,
      message,
      service: rawEvent.service,
      incident_id: rawEvent.incident_id,
      detail: rawEvent,
    };

    // Deduplicate if event_id already present
    if (state.activityEvents.some((e) => e.event_id === event_id)) {
      return;
    }

    const updated = [newEvent, ...state.activityEvents].slice(0, 150);
    state = {
      ...state,
      lastEventId: event_id,
      activityEvents: updated,
    };

    // Reactively update service status or stats if relevant
    if (evType === "incident_resolved" || evType === "service_healthy") {
      state = {
        ...state,
        services: state.services.map((s) =>
          s.id === "checkout-api"
            ? { ...s, status: "HEALTHY", latency_ms: 200, error_rate: 0.8, db_queries_per_req: 3 }
            : s
        ),
        systemStats: {
          ...state.systemStats,
          activeIncidents: Math.max(0, state.systemStats.activeIncidents - 1),
          investigating: Math.max(0, state.systemStats.investigating - 1),
          criticalServices: 0,
          resolvedToday: state.systemStats.resolvedToday + 1,
        },
      };
    } else if (evType === "incident_created" || evType === "workflow_run_failed") {
      state = {
        ...state,
        services: state.services.map((s) =>
          s.id === "checkout-api"
            ? { ...s, status: "CRITICAL", latency_ms: 4800, error_rate: 21.8, db_queries_per_req: 25 }
            : s
        ),
        systemStats: {
          ...state.systemStats,
          activeIncidents: state.systemStats.activeIncidents + 1,
          investigating: state.systemStats.investigating + 1,
          criticalServices: 1,
        },
      };
    }

    notify();
  },

  clearEvents: () => {
    state = { ...state, activityEvents: [] };
    notify();
  },

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useRealtimeStore<T = RealtimeState>(
  selector?: (state: RealtimeState) => T
): T {
  const [snapshot, setSnapshot] = useState<T>(() => {
    const s = realtimeStore.getState();
    return selector ? selector(s) : (s as unknown as T);
  });

  useEffect(() => {
    return realtimeStore.subscribe(() => {
      const s = realtimeStore.getState();
      setSnapshot(selector ? selector(s) : (s as unknown as T));
    });
  }, [selector]);

  return snapshot;
}

export const setDataSource = realtimeStore.setDataSource;
export const setActiveCodebase = realtimeStore.setActiveCodebase;
export const refreshActiveCodebase = realtimeStore.refreshActiveCodebase;
export const clearEvents = realtimeStore.clearEvents;

export function useActiveCodebase(): ActiveCodebase | null {
  return useRealtimeStore((s) => s.activeCodebase);
}

