import { Check, CheckCircle2, Circle, Clock, Database, FlaskConical, GitCommit, Layers, Loader2, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import type { TestRun } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VerificationPipelineProps {
  testRun: TestRun | null;
  status: string;
  recoveryVersion?: string;
  durationSeconds?: number;
}

const PIPELINE_STAGES = [
  { id: "patch", label: "PATCH APPLIED", icon: GitCommit },
  { id: "build", label: "BUILD STARTED", icon: Layers },
  { id: "unit", label: "UNIT TESTS", icon: FlaskConical },
  { id: "integration", label: "INTEGRATION TESTS", icon: Zap },
  { id: "ci", label: "CI VERIFICATION", icon: ShieldCheck },
  { id: "health", label: "SERVICE HEALTH", icon: CheckCircle2 },
];

export function VerificationPipeline({
  testRun,
  status,
  recoveryVersion = "v1.8.5",
  durationSeconds = 402,
}: VerificationPipelineProps) {
  const isTesting = status === "TESTING";
  const isResolved = status === "RESOLVED";
  const isPassed = testRun?.status === "PASSED" || isResolved;

  const totalPassed = isResolved ? 44 : (testRun?.total_passed ?? 0);
  const totalTests = 44;
  const progressRatio = totalTests > 0 ? totalPassed / totalTests : 0;

  // Derive active stage index
  let activeStageIdx = 0;
  if (isResolved) {
    activeStageIdx = 6;
  } else if (isTesting) {
    if (totalPassed >= 36) activeStageIdx = 5;
    else if (totalPassed >= 26) activeStageIdx = 4;
    else if (totalPassed >= 12) activeStageIdx = 3;
    else if (totalPassed > 0) activeStageIdx = 2;
    else activeStageIdx = 1;
  }

  // Format recovery time
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const formattedRecovery = `${minutes}m ${seconds}s`;

  return (
    <div className="space-y-6">
      {/* ── 6-Stage Pipeline Visualization (Section 20 specification) ── */}
      <div className="rounded-2xl border border-line bg-elevated/40 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-faint">
            VERIFICATION PIPELINE
          </span>
          <Badge tone={isPassed ? "ok" : isTesting ? "brand" : "neutral"}>
            {isPassed ? "44/44 PASSED" : isTesting ? "TESTING FIX" : "AWAITING APPROVAL"}
          </Badge>
        </div>

        {/* Pipeline steps desktop horizontal / mobile wrapped */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map((stage, idx) => {
            const StageIcon = stage.icon;
            const isStageDone = activeStageIdx > idx;
            const isStageCurrent = activeStageIdx === idx && isTesting;

            return (
              <div
                key={stage.id}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-300",
                  isStageDone
                    ? "border-ok/40 bg-ok/8 text-ok"
                    : isStageCurrent
                      ? "border-brand/50 bg-brand/10 text-brand shadow-glow animate-pulse"
                      : "border-line bg-surface/60 text-muted opacity-60"
                )}
              >
                <div className="mb-2">
                  {isStageDone ? (
                    <Check className="h-4 w-4 text-ok" />
                  ) : isStageCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  ) : (
                    <StageIcon className="h-4 w-4" />
                  )}
                </div>
                <span className="font-mono text-[0.65rem] font-bold tracking-tight">
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Streaming Test Suites ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-black text-ink tabular-nums sm:text-3xl">
              {totalPassed} / {totalTests}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-ok">
              TESTS PASSED
            </span>
          </div>

          <div className="w-40 sm:w-56">
            <Progress value={progressRatio} tone={isPassed ? "ok" : "brand"} label="Test progress" />
          </div>
        </div>

        {/* Named Test Suites */}
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {(testRun?.suites ?? [
            { name: "CheckoutServiceTest", passed: isResolved ? 12 : 0, total: 12, status: isResolved ? "PASSED" : "PENDING" },
            { name: "OrderServiceTest", passed: isResolved ? 14 : 0, total: 14, status: isResolved ? "PASSED" : "PENDING" },
            { name: "ProductRepositoryTest", passed: isResolved ? 10 : 0, total: 10, status: isResolved ? "PASSED" : "PENDING" },
            { name: "PaymentFlowTest", passed: isResolved ? 8 : 0, total: 8, status: isResolved ? "PASSED" : "PENDING" },
          ]).map((suite) => {
            const passed = suite.status === "PASSED" || isResolved;
            return (
              <li
                key={suite.name}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 transition-colors duration-200",
                  passed ? "border-ok/35 bg-ok/8" : "border-line bg-elevated/40"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {passed ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ok/20 text-ok shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-surface text-muted shrink-0">
                      <Circle className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="truncate text-xs font-bold text-ink font-mono">
                    {suite.name}
                  </span>
                </div>

                <div className="font-mono text-2xs tabular-nums text-muted font-bold shrink-0">
                  {passed ? suite.total : suite.passed} / {suite.total} passed
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Incident Resolved Card (Section 20 & 21) ──────────────────── */}
      {isResolved && (
        <div className="rounded-2xl border border-ok/40 bg-ok/10 p-5 sm:p-6 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ok/25 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ok animate-ping" />
              <span className="text-sm font-extrabold uppercase tracking-widest text-ok font-mono">
                ● INCIDENT RESOLVED
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink">
              <span>Deployment: <span className="text-ok">{recoveryVersion}</span></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-ok">
                <Clock className="h-3.5 w-3.5" /> {formattedRecovery}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-ok/30 bg-surface/70 p-3">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted block">
                Latency
              </span>
              <span className="mt-1 font-mono text-lg font-bold text-ok block">
                200ms
              </span>
              <span className="text-2xs text-muted">Baseline restored</span>
            </div>

            <div className="rounded-xl border border-ok/30 bg-surface/70 p-3">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted block">
                Error Rate
              </span>
              <span className="mt-1 font-mono text-lg font-bold text-ok block">
                1%
              </span>
              <span className="text-2xs text-muted">21.8% → 1%</span>
            </div>

            <div className="rounded-xl border border-ok/30 bg-surface/70 p-3">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted block">
                DB Queries
              </span>
              <span className="mt-1 font-mono text-lg font-bold text-ok block">
                3/request
              </span>
              <span className="text-2xs text-muted">25 → 3/req</span>
            </div>

            <div className="rounded-xl border border-ok/30 bg-surface/70 p-3">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted block">
                Recovery Time
              </span>
              <span className="mt-1 font-mono text-lg font-bold text-ok block">
                {formattedRecovery}
              </span>
              <span className="text-2xs text-muted">Zero data loss</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
