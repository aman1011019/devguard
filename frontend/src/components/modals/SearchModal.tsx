import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, AlertTriangle, Server, GitCommit, FileText, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as any)?.tagName))) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api.search(query)
        .then((res: any) => setResults(res.results))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search incidents, services, commits, evidence..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-brand shrink-0" /> : null}
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-elevated hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          {!results && !loading && (
            <p className="text-center py-6 text-faint">
              Type to search across services, active incidents, git commits, and evidence graphs...
            </p>
          )}

          {results?.incidents?.length > 0 && (
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint mb-2">Incidents</p>
              <div className="space-y-1">
                {results.incidents.map((inc: any) => (
                  <button
                    key={inc.id}
                    onClick={() => {
                      navigate(`/incidents/${inc.id}`);
                      onClose();
                    }}
                    className="w-full text-left flex items-center justify-between p-2 rounded-lg bg-elevated/40 hover:bg-elevated border border-line/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-bad" />
                      <span className="font-semibold text-ink">{inc.service}</span>
                      <span className="text-muted truncate max-w-xs">{inc.title}</span>
                    </div>
                    <span className="text-2xs uppercase px-1.5 py-0.5 rounded bg-bad/10 text-bad">
                      {inc.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results?.services?.length > 0 && (
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint mb-2">Services</p>
              <div className="space-y-1">
                {results.services.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      navigate(`/services`);
                      onClose();
                    }}
                    className="w-full text-left flex items-center justify-between p-2 rounded-lg bg-elevated/40 hover:bg-elevated border border-line/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-accent" />
                      <span className="font-semibold text-ink">{s.name}</span>
                    </div>
                    <span className="text-2xs uppercase px-1.5 py-0.5 rounded bg-elevated text-muted">
                      {s.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results?.deployments?.length > 0 && (
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint mb-2">Deployments & Commits</p>
              <div className="space-y-1">
                {results.deployments.map((d: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-elevated/40 border border-line/60"
                  >
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-3.5 w-3.5 text-brand" />
                      <span className="text-ink font-semibold">{d.version}</span>
                      <span className="text-muted">{d.commit_sha} by {d.author}</span>
                    </div>
                    <span className="text-2xs text-faint truncate max-w-xs">{d.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results?.evidence?.length > 0 && (
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint mb-2">Evidence Items</p>
              <div className="space-y-1">
                {results.evidence.map((ev: any) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-elevated/40 border border-line/60"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-ok" />
                      <span className="text-ink font-semibold">{ev.key}</span>
                      <span className="text-muted">{ev.title}</span>
                    </div>
                    <span className="text-2xs text-faint uppercase">{ev.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
