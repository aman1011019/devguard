/** WebSocket event union emitted by the backend orchestrator.
 *  Channel 0 is the global dashboard channel; channel <incident_id> is per
 *  incident. Events are duck-typed on `type`. */

export type WsEvent =
  | { type: "incident_detected"; incident_id: number; service?: string; title?: string; severity?: string; status?: string; created?: boolean }
  | { type: "system_reset"; removed?: number }
  | { type: "investigation_started"; incident_id: number }
  | { type: "agent_started"; agent: string; label: string; message: string; order_index: number }
  | { type: "agent_completed"; agent: string; label: string; finding: string; detail: Record<string, any>; confidence: number | null; order_index: number }
  | { type: "root_cause_found"; root_cause: string; file?: string; line?: number; confidence: number }
  | { type: "fix_generated"; incident_id: number }
  | { type: "investigation_completed"; incident_id: number; status: string }
  | { type: "investigation_error"; error: string }
  | { type: "fix_approved"; incident_id: number; workspace?: string }
  | { type: "fix_rejected"; incident_id: number }
  | { type: "test_started"; incident_id: number }
  | { type: "test_suite_started"; suite: string; total: number }
  | { type: "test_suite_completed"; suite: string; passed: number; total: number; status: string }
  | { type: "test_completed"; passed: boolean; total_passed: number; total: number; suites: any[]; status: string }
  | { type: "incident_resolved"; incident_id: number; recovery_version: string; duration_seconds: number }
  | { type: "incident_failed"; incident_id: number }
  | { type: "test_error"; error: string }
  | { type: string; [k: string]: any };

export type WsEventType = WsEvent["type"];

/** Human-readable one-liners used by the live activity feed. */
export function describeEvent(e: WsEvent): string {
  switch (e.type) {
    case "incident_detected":
      return `Incident detected on ${(e as any).service ?? "service"}`;
    case "system_reset":
      return "System reset to healthy baseline";
    case "investigation_started":
      return "Investigation started — dispatching agents";
    case "agent_started":
      return `${(e as any).label}: ${(e as any).message}`;
    case "agent_completed":
      return `${(e as any).label}: ${(e as any).finding}`;
    case "root_cause_found":
      return `Root cause found — ${(e as any).root_cause}`;
    case "fix_generated":
      return "Fix generated and awaiting human approval";
    case "investigation_completed":
      return "Investigation complete";
    case "fix_approved":
      return "Fix approved — patch staged in isolated workspace";
    case "fix_rejected":
      return "Fix rejected — nothing was deployed";
    case "test_started":
      return "Verification suite started";
    case "test_suite_started":
      return `Running ${(e as any).suite}…`;
    case "test_suite_completed":
      return `${(e as any).suite}: ${(e as any).passed}/${(e as any).total} ${(e as any).status}`;
    case "test_completed":
      return `Verification ${(e as any).passed ? "passed" : "failed"} — ${(e as any).total_passed}/${(e as any).total}`;
    case "incident_resolved":
      return `Incident resolved — ${(e as any).recovery_version} deployed`;
    case "incident_failed":
      return "Verification failed — fix not deployed";
    case "investigation_error":
    case "test_error":
      return `Error: ${(e as any).error}`;
    default:
      return e.type.replace(/_/g, " ");
  }
}
