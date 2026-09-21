import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Key,
  Laptop,
  Link2,
  Loader2,
  RadioTower,
  Save,
  Server,
  Sparkles,
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
import { cn, relativeTime } from "@/lib/utils";

interface ProviderConfig {
  key: string;
  label: string;
  hint: string;
  defaultModel: string;
  hasKeyField: boolean;
  hasUrlField: boolean;
  defaultUrl?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: "gemini",
    label: "Google Gemini",
    hint: "Google Gemini (gemini-1.5-pro / 1.5-flash / 2.0) via Google AI Studio API key",
    defaultModel: "gemini-1.5-pro",
    hasKeyField: true,
    hasUrlField: false,
  },
  {
    key: "openai",
    label: "OpenAI",
    hint: "GPT-4o, GPT-4 Turbo, or OpenAI-compatible endpoint",
    defaultModel: "gpt-4o",
    hasKeyField: true,
    hasUrlField: true,
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    key: "ollama",
    label: "Ollama (Local LLM)",
    hint: "Local on-device models (llama3, deepseek, mistral, qwen) with zero external API calls",
    defaultModel: "llama3",
    hasKeyField: false,
    hasUrlField: true,
    defaultUrl: "http://localhost:11434",
  },
];

const SPEED_OPTIONS = [
  { key: "fast", label: "Fast (0.5s)", desc: "Quick verification for testing" },
  { key: "normal", label: "Normal (1.3s)", desc: "Balanced realistic streaming" },
  { key: "deliberate", label: "Careful (2.0s)", desc: "Step-by-step verification" },
];

const OFFICE_KIT_ACTIONS: { action: string; label: string }[] = [
  { action: "SYNC_INCIDENT", label: "Sync incident" },
  { action: "OPEN_PROJECT", label: "Open project" },
  { action: "VIEW_CODE", label: "View code" },
  { action: "RUN_TESTS", label: "Run tests" },
];

export default function Settings() {
  const { redLightMode, toggleRedLightMode } = useRedLight();
  const health = useHealth();
  const settings = useUserSettings();
  const updateSettings = useUpdateSettings();
  const office = useOfficeKit();
  const sync = useOfficeKitSync();

  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [modelName, setModelName] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [speed, setSpeed] = useState<string>(() => {
    return localStorage.getItem("devguard_investigation_speed") || "normal";
  });

  const handleSpeedChange = (newSpeed: string) => {
    setSpeed(newSpeed);
    localStorage.setItem("devguard_investigation_speed", newSpeed);
  };

  // Synchronize settings from backend / localStorage
  useEffect(() => {
    if (settings.data) {
      const p = settings.data.ai_provider;
      const initialP = p && p !== "demo" ? p : "gemini";
      setSelectedProvider(initialP);
      setModelName(settings.data.model_name || "");
      setBaseUrl(settings.data.llm_base_url || "");
    }
  }, [settings.data]);

  const handleSelectProvider = (key: string) => {
    setSelectedProvider(key);
    setSaveSuccess(false);
    const cfg = PROVIDERS.find((p) => p.key === key);
    if (cfg && !modelName) {
      setModelName(cfg.defaultModel);
    }
    if (cfg?.hasUrlField && !baseUrl) {
      setBaseUrl(cfg.defaultUrl || "");
    }
  };

  const handleSaveProviderConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveSuccess(false);

    try {
      await updateSettings.mutateAsync({
        ai_provider: selectedProvider,
        llm_api_key: apiKey || undefined,
        model_name: modelName || undefined,
        llm_base_url: baseUrl || undefined,
        demo_mode: false,
      });

      // Also persist to localStorage for client-side resiliency
      localStorage.setItem("devguard_ai_provider", selectedProvider);
      if (modelName) localStorage.setItem("devguard_ai_model", modelName);
      if (baseUrl) localStorage.setItem("devguard_ai_base_url", baseUrl);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to save provider config", err);
    }
  };

  const currentConfig = PROVIDERS.find((p) => p.key === selectedProvider) || PROVIDERS[0];

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
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
              Configure real AI reasoning engines, operational emergency modes, investigation speed, and Office Kit bridge.
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
        {/* ── Reasoning Engine (AI Brain) ─────────────────────────────────── */}
        <Card data-rise className="lg:col-span-2">
          <CardHeader
            icon={<Zap className="h-4 w-4 text-blue-600" />}
            title="Reasoning Engine"
            subtitle="Configure real AI model providers for the autonomous diagnostic swarm"
            actions={
              <Badge tone="ok" dot>
                {selectedProvider.toUpperCase()} ACTIVE
              </Badge>
            }
          />
          <CardBody className="space-y-5">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROVIDERS.map((p) => {
                const selected = selectedProvider === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectProvider(p.key)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
                      selected
                        ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs"
                        : "border-line bg-elevated/40 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-slate-900">{p.label}</span>
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                          selected ? "border-blue-600" : "border-slate-300"
                        )}
                      >
                        {selected ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Provider Form */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>Configure {currentConfig.label} Credentials & Model Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentConfig.hasKeyField && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={settings.data?.has_api_key ? "••••••••••••••••" : "Paste API key (e.g. AIzaSy... or sk-...)"}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Stored securely on backend and used for live code AST root-cause synthesis.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={currentConfig.defaultModel}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default: <span className="font-mono text-slate-600">{currentConfig.defaultModel}</span>
                  </p>
                </div>

                {currentConfig.hasUrlField && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Base URL / Host Endpoint
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={currentConfig.defaultUrl || "http://localhost:11434"}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Target URL for model inference requests.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <div className="text-xs">
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Configuration saved & {currentConfig.label} engine active!
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveProviderConfig()}
                  disabled={updateSettings.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Apply & Activate Engine
                    </>
                  )}
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

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
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200 cursor-pointer",
                    speed === opt.key
                      ? "border-brand/50 bg-brand/10 text-brand shadow-sm font-semibold"
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
              Controls agent streaming delay for presentations, rapid automated checks, or step-by-step verification.
            </p>
          </CardBody>
        </Card>

        {/* ── Office Kit bridge ───────────────────────────────────────────── */}
        <Card data-rise className="lg:col-span-2">
          <CardHeader
            icon={<Link2 className="h-4 w-4" />}
            title="Office Kit Bridge"
            subtitle="Phone ↔ development machine integration"
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
                Remote bridge actions: pushing incident context to the workstation, opening
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
