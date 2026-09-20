import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CodebaseScan, UserSettingsInput } from "@/lib/types";

/** Single source of truth for cache keys — every invalidation goes through this
 *  so a renamed endpoint can never leave a stale key behind. */
export const qk = {
  health: ["health"] as const,
  agents: ["agents"] as const,
  incidents: ["incidents"] as const,
  active: ["incidents", "active"] as const,
  incident: (id: number) => ["incident", id] as const,
  metrics: (id: number) => ["incident", id, "metrics"] as const,
  logs: (id: number) => ["incident", id, "logs"] as const,
  evidence: (id: number) => ["incident", id, "evidence"] as const,
  investigation: (id: number) => ["incident", id, "investigation"] as const,
  tests: (id: number) => ["incident", id, "tests"] as const,
  officeKit: ["office-kit"] as const,
  settings: ["settings"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: api.health,
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

export function useAgents() {
  return useQuery({ queryKey: qk.agents, queryFn: api.agents, staleTime: Infinity });
}

export function useIncidents() {
  return useQuery({ queryKey: qk.incidents, queryFn: api.listIncidents, staleTime: 3_000 });
}

export function useActiveIncident() {
  return useQuery({ queryKey: qk.active, queryFn: api.activeIncident, staleTime: 2_000 });
}

export function useIncident(id: number | null) {
  return useQuery({
    queryKey: qk.incident(id ?? 0),
    queryFn: () => api.incident(id as number),
    enabled: id !== null,
    staleTime: 2_000,
  });
}

export function useMetrics(id: number | null) {
  return useQuery({
    queryKey: qk.metrics(id ?? 0),
    queryFn: () => api.metrics(id as number),
    enabled: id !== null,
    staleTime: 2_000,
  });
}

export function useLogs(id: number | null) {
  return useQuery({
    queryKey: qk.logs(id ?? 0),
    queryFn: () => api.logs(id as number),
    enabled: id !== null,
    staleTime: 2_000,
  });
}

export function useEvidence(id: number | null) {
  return useQuery({
    queryKey: qk.evidence(id ?? 0),
    queryFn: () => api.evidence(id as number),
    enabled: id !== null,
    staleTime: 2_000,
  });
}

export function useInvestigation(id: number | null) {
  return useQuery({
    queryKey: qk.investigation(id ?? 0),
    queryFn: () => api.investigation(id as number),
    enabled: id !== null,
    staleTime: 1_000,
  });
}

export function useTestRun(id: number | null, enabled = true) {
  return useQuery({
    queryKey: qk.tests(id ?? 0),
    queryFn: () => api.tests(id as number),
    enabled: id !== null && enabled,
    retry: false,
    staleTime: 1_000,
  });
}

export function useOfficeKit() {
  return useQuery({ queryKey: qk.officeKit, queryFn: api.officeKitStatus, staleTime: 30_000 });
}

/** Office Kit actions keep their own last-result so the panel can echo what the
 *  dev machine reported without a second round trip. */
export function useOfficeKitSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: string) => api.officeKitSync(action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.officeKit });
    },
  });
}

export function useUserSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: api.settings, staleTime: 15_000 });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserSettingsInput) => api.updateSettings(payload),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      void qc.invalidateQueries({ queryKey: qk.health });
    },
  });
}

/** The two scan entry points share one result slot, so switching between "local
 *  path" and "upload a zip" replaces the report instead of stacking two. */
export function useCodebaseScan(onDone?: (scan: CodebaseScan) => void) {
  const local = useMutation({ mutationFn: (path: string) => api.scanLocal(path), onSuccess: onDone });
  const upload = useMutation({ mutationFn: (file: File) => api.scanUpload(file), onSuccess: onDone });
  return { local, upload };
}

/** Refresh everything that describes one incident. Called from the WebSocket
 *  listener whenever the orchestrator reports a state change. */
export function refreshIncident(qc: QueryClient, id: number) {
  void qc.invalidateQueries({ queryKey: ["incident", id] });
  void qc.invalidateQueries({ queryKey: qk.incidents });
  void qc.invalidateQueries({ queryKey: qk.active });
  void qc.invalidateQueries({ queryKey: qk.health });
}

export function useIncidentActions(id: number | null) {
  const qc = useQueryClient();
  const done = () => {
    if (id !== null) refreshIncident(qc, id);
  };

  return {
    investigate: useMutation({ mutationFn: () => api.investigate(id as number), onSuccess: done }),
    generateFix: useMutation({ mutationFn: () => api.generateFix(id as number), onSuccess: done }),
    approveFix: useMutation({ mutationFn: () => api.approveFix(id as number), onSuccess: done }),
    rejectFix: useMutation({ mutationFn: () => api.rejectFix(id as number), onSuccess: done }),
    runTests: useMutation({ mutationFn: () => api.runTests(id as number), onSuccess: done }),
  };
}

export function useDemoActions() {
  const qc = useQueryClient();
  const refreshAll = () => {
    void qc.invalidateQueries();
  };

  return {
    inject: useMutation({ mutationFn: api.injectIncident, onSuccess: refreshAll }),
    reset: useMutation({ mutationFn: api.resetDemo, onSuccess: refreshAll }),
  };
}
