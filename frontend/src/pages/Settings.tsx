import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Laptop,
  Link2,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RadioTower,
  Server,
  Sun,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import {
  useHealth,
  useOfficeKit,
  useOfficeKitSync,
  useUpdateSettings,
  useUserSettings,
} from "@/hooks/useQueries";
import { useRedLight } from "@/providers/RedLightProvider";
import { useTheme, type ThemeChoice } from "@/providers/ThemeProvider";
import { cn, relativeTime } from "@/lib/utils";

const THEMES: { key: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

const PROVIDERS: { key: string; label: string; hint: string }[] = [
  { key: "demo", label: "Demo", hint: "Deterministic scripted reasoning — no API key" },
  { key: "gemini", label: "Gemini", hint: "Google Gemini via API key" },
  { key: "openai", label: "OpenAI", hint: "GPT-class models via API key" },
  { key: "ollama", label: "Ollama", hint: "Local on-device model host" },
];

const SPEED_OPTIONS = [
  { key: "fast", label: "Fast (0.5s)", desc: "Quick verification for testing" },
  { key: "normal", label: "Normal (1.3s)", desc: "Balanced realistic streaming" },
  { key: "demo", label: "Demo (2.0s)", desc: "Audience-friendly pacing" },
];

const OFFICE_KIT_ACTIONS: { action: string; label: string }[] = [
  { action: "SYNC_INCIDENT", label: "Sync incident" },
  { action: "OPEN_PROJECT", label: "Open project" },
  { action: "VIEW_CODE", label: "View code" },
  { action: "RUN_TESTS", label: "Run tests" },
];

export default function Settings() {
  const { choice, setChoice } = useTheme();
  const { redLightMode, toggleRedLightMode } = useRedLight();
  const health = useHealth();
  const settings = useUserSettings();
  const updateSettings = useUpdateSettings();
  const office = useOfficeKit();
  const sync = useOfficeKitSync();

  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [speed, setSpeed] = useState<string>(() => {
    return localStorage.getItem("devguard_investigation_speed") || "normal";
  });

  const handleSpeedChange = (newSpeed: string) => {
    setSpeed(newSpeed);
    localStorage.setItem("devguard_investigation_speed", newSpeed);
  };

  const provider = settings.data?.ai_provider ?? "demo";
  const effectiveDemo = demoMode ?? settings.data?.demo_mode ?? true;

  const saveProvider = (next: string) =>
    updateSettings.mutate({ theme: choice, demo_mode: effectiveDemo, ai_provider: next });

  const saveDemoMode = (next: boolean) => {
    setDemoMode(next);
    updateSettings.mutate({ theme: choice, demo_mode: next, ai_provider: provider });
  };

  return (
    <div className="space-y-5">
      <section data-rise className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand">
              <Cpu className="h-4 w-4" aria-hidden />
              <span className="label-eyebrow text-brand">Configuration & Control</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Settings</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              Red Light operational mode, incident replay speed, AI reasoning engines, and Office Kit bridge.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-card/60 px-3.5 py-2">
            <Server className={cn("h-4 w-4", health.isSuccess ? "text-emerald-500" : "text-amber-500")} />
            <div className="text-left">
              <p className="font-mono text-2xs uppercase tracking-wider text-faint">System Status</p>
              <p className="font-mono text-xs font-semibold text-ink">
                {health.isSuccess ? "BACKEND CONNECTED (8000)" : "CONNECTING..."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Red Light Mode ──────────────────────────────────────────────── */}
        <Card data-rise className={cn(
          "transition-all duration-300",
          redLightMode ? "border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20" : ""
        )}>
          <CardHeader
            icon={<AlertTriangle className={cn("h-4 w-4", redLightMode ? "text-red-500" : "text-brand")} />}
            title="Red Light Mode"
            subtitle="Incident response command display"
            actions={
              <Badge tone={redLightMode ? "bad" : "neutral"} dot pulse={redLightMode}>
                {redLightMode ? "RED LIGHT ACTIVE" : "STANDBY"}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-elevated/40 p-3.5">
              <div>
                <p className="text-sm font-semibold text-ink">Emergency Operations Indicator</p>
                <p className="text-2xs text-muted">
                  PHONE + OFFICE KIT · NO LAPTOP REQUIRED mode. High-urgency alert banners across topbar and dashboard.
                </p>
              </div>
              <Switch
                checked={redLightMode}
                onChange={toggleRedLightMode}
                label=""
              />
            </div>
            <p className="text-2xs text-faint">
              Designed for on-call engineers resolving outages from mobile devices without opening a terminal or IDE.
            </p>
          </CardBody>
        </Card>

        {/* ── Investigation Speed ─────────────────────────────────────────── */}
        <Card data-rise>
          <CardHeader
            icon={<Gauge className="h-4 w-4 text-brand" />}
            title="Investigation Replay Speed"
            subtitle="Agent thinking & verification cadence"
            actions={
              <Badge tone="ok" dot>
                {speed.toUpperCase()}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSpeedChange(opt.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                    speed === opt.key
                      ? "border-brand/50 bg-brand/10 text-brand shadow-sm"
                      : "border-line bg-elevated/40 text-muted hover:border-strong hover:text-ink"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[0.625rem] text-faint line-clamp-1">{opt.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-2xs text-faint">
              Controls simulated agent streaming delay for presentations, rapid testing, or real-time simulation.
            </p>
          </CardBody>
        </Card>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <Card data-rise>
          <CardHeader icon={<Palette className="h-4 w-4" />} title="Appearance" subtitle="Theme preference" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChoice(key)}
                  aria-pressed={choice === key}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-200",
                    choice === key
                      ? "border-brand/50 bg-brand/8 text-brand shadow-glow"
                      : "border-line bg-elevated/40 text-muted hover:border-strong hover:text-ink"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-2xs leading-relaxed text-faint">
              Light and dark are independently tuned palettes. System follows your OS preference.
            </p>
          </CardBody>
        </Card>

        {/* ── Reasoning engine ────────────────────────────────────────────── */}
        <Card data-rise>
          <CardHeader
            icon={<Zap className="h-4 w-4" />}
            title="Reasoning engine"
            subtitle="Which brain powers the agents"
            actions={
              <Badge tone={settings.data?.ai_enabled ? "ok" : "neutral"} dot>
                {settings.data?.ai_enabled ? "Live AI" : "Demo"}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <div className="space-y-2">
              {PROVIDERS.map((p) => {
                const selected = provider === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => saveProvider(p.key)}
                    disabled={updateSettings.isPending}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200",
                      selected
                        ? "border-brand/50 bg-brand/8"
                        : "border-line bg-elevated/40 hover:border-strong"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                        selected ? "border-brand" : "border-strong"
                      )}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{p.label}</span>
                      <span className="block truncate text-2xs text-muted">{p.hint}</span>
                    </span>
                    {selected && updateSettings.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line/70 pt-1">
              <Switch
                checked={effectiveDemo}
                onChange={saveDemoMode}
                label="Demo mode"
                description="Deterministic incident so the flagship walkthrough is identical every run."
                disabled={updateSettings.isPending}
              />
            </div>
          </CardBody>
        </Card>

        {/* ── Office Kit bridge ───────────────────────────────────────────── */}
        <Card data-rise className="lg:col-span-2">
          <CardHeader
            icon={<Link2 className="h-4 w-4" />}
            title="Office Kit bridge"
            subtitle="Phone ↔ development machine"
            actions={
              <Badge tone={office.data?.connected ? "ok" : "warn"} dot pulse={office.data?.connected}>
                {office.data?.connected ? "Connected" : "Offline"}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BridgeStat icon={Laptop} label="Machine" value={office.data?.machine ?? "—"} />
              <BridgeStat icon={RadioTower} label="Bridge" value={office.data?.bridge ?? "—"} />
              <BridgeStat
                icon={Cpu}
                label="Project"
                value={office.data ? `${office.data.project} · ${office.data.branch}` : "—"}
              />
              <BridgeStat
                icon={Link2}
                label="Last sync"
                value={
                  office.data?.last_sync
                    ? `${office.data.last_sync} · ${office.data.latency_ms}ms`
                    : "never"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {OFFICE_KIT_ACTIONS.map((a) => (
                <Button
                  key={a.action}
                  variant="secondary"
                  size="sm"
                  loading={sync.isPending && sync.variables === a.action}
                  onClick={() => sync.mutate(a.action)}
                >
                  {a.label}
                </Button>
              ))}
            </div>

            {sync.data ? (
              <div
                className={cn(
                  "rounded-xl border px-3.5 py-2.5 text-xs",
                  sync.data.ok
                    ? "border-ok/30 bg-ok/8 text-ok"
                    : "border-bad/30 bg-bad/8 text-bad"
                )}
              >
                {sync.data.message}
              </div>
            ) : (
              <p className="text-2xs leading-relaxed text-faint">
                These mirror the demo phone actions: pushing incident context to the laptop, opening
                the offending file in the IDE, and kicking off the verification suite remotely.
              </p>
            )}

            {office.data?.commit ? (
              <p className="font-mono text-2xs text-faint">
                HEAD · {office.data.commit.slice(0, 12)}
                {office.dataUpdatedAt
                  ? ` · refreshed ${relativeTime(new Date(office.dataUpdatedAt).toISOString())}`
                  : ""}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function BridgeStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-elevated/40 p-3.5">
      <div className="flex items-center gap-2 text-faint">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
