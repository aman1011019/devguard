import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportIncidentModal({ isOpen, onClose }: ReportIncidentModalProps) {
  const [service, setService] = useState("Checkout API");
  const [severity, setSeverity] = useState("CRITICAL");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("checkout-api");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a description of the incident.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.reportIncident({
        service,
        severity,
        description,
        repository,
        branch,
      });
      onClose();
      if (res?.id) {
        navigate(`/incidents/${res.id}`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 text-bad">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold text-ink text-sm uppercase tracking-wider">
              Report Production Incident
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-elevated hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-mono">
          {error && (
            <div className="p-2.5 rounded-lg border border-bad/30 bg-bad/10 text-bad text-2xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs uppercase text-faint mb-1.5 font-sans">
                Service Affected
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-lg border border-line bg-elevated/60 px-3 py-2 text-ink focus:border-brand focus:outline-none"
              >
                <option value="Checkout API">Checkout API</option>
                <option value="Payments API">Payments API</option>
                <option value="Auth Service">Auth Service</option>
                <option value="Orders Service">Orders Service</option>
                <option value="Database">Database</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs uppercase text-faint mb-1.5 font-sans">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-lg border border-line bg-elevated/60 px-3 py-2 text-ink focus:border-brand focus:outline-none"
              >
                <option value="CRITICAL">CRITICAL (P0)</option>
                <option value="HIGH">HIGH (P1)</option>
                <option value="MEDIUM">MEDIUM (P2)</option>
                <option value="LOW">LOW (P3)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-2xs uppercase text-faint mb-1.5 font-sans">
              Incident Description / Observed Anomaly
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Checkout API latency spiked past 4800ms following deployment v1.8.4..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-line bg-elevated/60 p-3 text-ink placeholder:text-faint focus:border-brand focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs uppercase text-faint mb-1.5 font-sans">
                Repository
              </label>
              <input
                type="text"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                className="w-full rounded-lg border border-line bg-elevated/60 px-3 py-2 text-ink focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-2xs uppercase text-faint mb-1.5 font-sans">
                Branch / Ref
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-lg border border-line bg-elevated/60 px-3 py-2 text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-line/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink hover:bg-elevated transition-colors font-sans text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bad text-white font-semibold text-xs hover:bg-bad/90 transition-colors shadow-sm disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Trigger AI Investigation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
