import { z } from "zod";

/** Runtime-validated mirrors of the backend Pydantic schemas. Parsing at the
 *  boundary means a contract drift shows up as one clear error instead of a
 *  scatter of undefined reads deep in the UI. */

export const IncidentStatus = z.enum([
  "HEALTHY",
  "DETECTED",
  "INVESTIGATING",
  "ROOT_CAUSE_FOUND",
  "FIX_READY",
  "AWAITING_APPROVAL",
  "TESTING",
  "RESOLVED",
  "FAILED",
]);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const Health = z.object({
  status: z.string(),
  app: z.string(),
  version: z.string(),
  demo_mode: z.boolean(),
  ai_provider: z.string(),
  ai_enabled: z.boolean(),
  services_monitored: z.number(),
  active_incidents: z.number(),
  system_health: z.number(),
  database: z.string().optional(),
  websocket: z.string().optional(),
  github: z.string().optional(),
  investigating: z.number().optional(),
  critical_services: z.number().optional(),
  resolved_today: z.number().optional(),
});
export type Health = z.infer<typeof Health>;

export const AgentMeta = z.object({
  agent: z.string(),
  label: z.string(),
  emoji: z.string(),
  running_message: z.string(),
  order_index: z.number(),
});
export type AgentMeta = z.infer<typeof AgentMeta>;

export const TimelineEvent = z.object({
  id: z.number(),
  time_label: z.string(),
  title: z.string(),
  detail: z.string(),
  kind: z.string(),
  order_index: z.number(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const Deployment = z.object({
  id: z.number(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  commit_sha: z.string(),
  timestamp: z.string(),
});
export type Deployment = z.infer<typeof Deployment>;

export const LogEntry = z.object({
  id: z.number(),
  timestamp: z.string(),
  level: z.string(),
  service: z.string(),
  message: z.string(),
});
export type LogEntry = z.infer<typeof LogEntry>;

export const Evidence = z.object({
  id: z.number(),
  key: z.string(),
  type: z.string(),
  source: z.string(),
  agent: z.string(),
  timestamp: z.string(),
  relevance: z.number(),
  title: z.string(),
  content: z.string(),
  meta: z.record(z.any()).default({}),
});
export type Evidence = z.infer<typeof Evidence>;

export const EvidenceGraph = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
      detail: z.string().default(""),
      evidence_key: z.string().nullable().optional(),
    })
  ),
  edges: z.array(
    z.object({ source: z.string(), target: z.string(), label: z.string().default("") })
  ),
});
export type EvidenceGraph = z.infer<typeof EvidenceGraph>;

export const EvidenceBundle = z.object({
  items: z.array(Evidence),
  graph: EvidenceGraph,
});
export type EvidenceBundle = z.infer<typeof EvidenceBundle>;

export const AgentRun = z.object({
  id: z.number(),
  agent: z.string(),
  status: z.string(),
  finding: z.string(),
  detail: z.record(z.any()).default({}),
  confidence: z.number().nullable().optional(),
  order_index: z.number(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});
export type AgentRun = z.infer<typeof AgentRun>;

export const RootCause = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  file: z.string(),
  line: z.number().nullable().optional(),
  commit_sha: z.string(),
  confidence: z.number(),
  explanation: z.string(),
  reasons: z.array(z.string()).default([]),
  evidence_ids: z.array(z.string()).default([]),
  alternatives: z.array(z.object({ name: z.string(), confidence: z.number() })).default([]),
});
export type RootCause = z.infer<typeof RootCause>;

export const Fix = z.object({
  id: z.number(),
  file: z.string(),
  language: z.string(),
  risk: z.string(),
  expected_impact: z.string(),
  summary: z.string(),
  explanation: z.string(),
  before_code: z.string(),
  after_code: z.string(),
  diff: z.string(),
  status: z.string(),
});
export type Fix = z.infer<typeof Fix>;

export const Investigation = z.object({
  incident_id: z.number(),
  status: z.string(),
  agents: z.array(AgentRun),
  root_cause: RootCause.nullable().optional(),
  fix: Fix.nullable().optional(),
});
export type Investigation = z.infer<typeof Investigation>;

export const TestSuite = z.object({
  name: z.string(),
  passed: z.number(),
  total: z.number(),
  status: z.string(),
  duration_ms: z.number().default(0),
});
export type TestSuite = z.infer<typeof TestSuite>;

export const TestRun = z.object({
  id: z.number(),
  status: z.string(),
  suites: z.array(TestSuite).default([]),
  total_passed: z.number(),
  total: z.number(),
});
export type TestRun = z.infer<typeof TestRun>;

export const IncidentSummary = z.object({
  id: z.number(),
  service: z.string(),
  title: z.string(),
  severity: z.string(),
  status: z.string(),
  error_rate: z.number(),
  latency_ms: z.number(),
  db_queries_per_request: z.number().nullable().optional(),
  requests_per_min: z.string(),
  root_cause_summary: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  deployment_version: z.string(),
  repository: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  commit_sha: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  detected_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
});
export type IncidentSummary = z.infer<typeof IncidentSummary>;

export const IncidentDetail = IncidentSummary.extend({
  db_latency_ms: z.number(),
  recovery_version: z.string(),
  metrics_before: z.record(z.any()).default({}),
  metrics_after: z.record(z.any()).nullable().optional(),
  timeline: z.array(TimelineEvent).default([]),
  deployments: z.array(Deployment).default([]),
});
export type IncidentDetail = z.infer<typeof IncidentDetail>;

export const MetricSnapshot = z.object({
  latency_ms: z.number(),
  error_rate: z.number(),
  db_queries_per_request: z.number(),
  db_latency_ms: z.number(),
  requests_per_min: z.string().default("0"),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshot>;

export const MetricsBundle = z.object({
  points: z.array(
    z.object({
      t: z.number(),
      label: z.string(),
      phase: z.string(),
      latency_ms: z.number(),
      error_rate: z.number(),
      db_queries: z.number(),
      db_latency_ms: z.number(),
    })
  ),
  current: MetricSnapshot,
  before: z.record(z.any()),
  after: z.record(z.any()).nullable(),
  baseline: z.object({
    healthy: MetricSnapshot,
    broken: MetricSnapshot,
    recovered: MetricSnapshot,
  }),
});
export type MetricsBundle = z.infer<typeof MetricsBundle>;
export type MetricPoint = MetricsBundle["points"][number];

export const ActionResponse = z.object({
  ok: z.boolean().default(true),
  status: z.string(),
  message: z.string().default(""),
  incident_id: z.number().nullable().optional(),
});
export type ActionResponse = z.infer<typeof ActionResponse>;

export const InvestigationLaunchResponse = z.object({
  success: z.boolean().default(true),
  ok: z.boolean().default(true),
  investigation_id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  incident_id: z.number(),
  status: z.string().default("started"),
  message: z.string().default(""),
});
export type InvestigationLaunchResponse = z.infer<typeof InvestigationLaunchResponse>;

export const VoiceResponse = z.object({
  intent: z.string(),
  incident_id: z.number().nullable().optional(),
  response: z.string(),
  action: z.string().nullable().optional(),
});
export type VoiceResponse = z.infer<typeof VoiceResponse>;

export const ImageAnalysis = z.object({
  detected_service: z.string(),
  error_code: z.string(),
  message: z.string(),
  suggested_incident: z.number().nullable().optional(),
  confidence: z.number().default(0),
  detected_metrics: z.record(z.any()).default({}),
});
export type ImageAnalysis = z.infer<typeof ImageAnalysis>;

export const OfficeKitStatus = z.object({
  connected: z.boolean(),
  bridge: z.string(),
  machine: z.string(),
  project: z.string(),
  branch: z.string(),
  commit: z.string(),
  last_sync: z.string().nullable().optional(),
  latency_ms: z.number().default(0),
});
export type OfficeKitStatus = z.infer<typeof OfficeKitStatus>;

export const OfficeKitSync = z.object({
  ok: z.boolean(),
  action: z.string(),
  message: z.string(),
  detail: z.record(z.any()).default({}),
});
export type OfficeKitSync = z.infer<typeof OfficeKitSync>;

/** The scanner emits `null` (not absent) for issues it could not auto-patch, so
 *  these coalesce rather than relying on a zod default. */
const nullableText = z
  .string()
  .nullish()
  .transform((v) => v ?? "");

export const CodeIssue = z.object({
  id: z.string(),
  category: z.string(),
  severity: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number(),
  snippet: nullableText,
  explanation: nullableText,
  recommendation: nullableText,
  patch_diff: nullableText,
  before_code: nullableText,
  after_code: nullableText,
});
export type CodeIssue = z.infer<typeof CodeIssue>;

export const CodebaseScan = z.object({
  scan_id: z.string(),
  root_path: z.string(),
  health_score: z.number(),
  total_files: z.number(),
  total_lines: z.number(),
  language_counts: z.record(z.number()).default({}),
  issues: z.array(CodeIssue).default([]),
  summary: z.record(z.number()).default({}),
});
export type CodebaseScan = z.infer<typeof CodebaseScan>;

/** GET returns the demo timings too; PUT echoes back only the mutable fields,
 *  so the timing keys are optional on purpose. */
export const UserSettings = z.object({
  theme: z.string().optional(),
  demo_mode: z.boolean().optional(),
  ai_provider: z.string(),
  ai_enabled: z.boolean().optional(),
  llm_base_url: z.string().optional(),
  model_name: z.string().optional(),
  has_api_key: z.boolean().optional(),
  agent_step_seconds: z.number().optional(),
  test_step_seconds: z.number().optional(),
});
export type UserSettings = z.infer<typeof UserSettings>;

export type UserSettingsInput = {
  theme?: string;
  demo_mode?: boolean;
  ai_provider: string;
  llm_api_key?: string;
  llm_base_url?: string;
  model_name?: string;
};
