import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Send, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useSpeech } from "@/hooks/useSpeech";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { VoiceResponse } from "@/lib/types";

const SUGGESTIONS = [
  "What's broken?",
  "Investigate the checkout incident",
  "What was the root cause?",
  "Show me the fix",
  "Run the tests",
  "System status",
];

/**
 * Voice control. Speech recognition is Chromium-only, so the same intent
 * endpoint is always reachable through a text box — the feature never becomes
 * a dead button on an unsupported browser.
 */
export function VoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { supported, listening, transcript, error, start, stop, speak, setTranscript } = useSpeech();
  const [reply, setReply] = useState<VoiceResponse | null>(null);
  const [speakBack, setSpeakBack] = useState(true);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const ask = useMutation({
    mutationFn: (command: string) => api.voice(command),
    onSuccess: (data) => {
      setReply(data);
      void qc.invalidateQueries();
      if (speakBack) speak(data.response);
    },
  });

  const submit = useCallback(
    (text: string) => {
      const command = text.trim();
      if (!command) return;
      setReply(null);
      ask.mutate(command);
    },
    [ask]
  );

  useEffect(() => {
    if (!open) {
      stop();
      setReply(null);
      setTranscript("");
    }
  }, [open, stop, setTranscript]);

  const goToIncident = () => {
    if (reply?.incident_id) {
      navigate(`/incidents/${reply.incident_id}`);
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Voice command"
      subtitle={
        supported
          ? "Speak or type — DevGuard resolves the intent against live incident state."
          : "This browser has no speech recognition; type the command instead."
      }
      icon={<Mic className="h-4 w-4" aria-hidden />}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={speakBack}
              onChange={(e) => setSpeakBack(e.target.checked)}
              className="h-3.5 w-3.5 accent-current"
            />
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
            Speak the reply
          </label>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={ask.isPending}
            onClick={() => submit(transcript)}
            icon={<Send className="h-3.5 w-3.5" />}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!supported}
            onClick={() => (listening ? stop() : start((text) => submit(text)))}
            aria-label={listening ? "Stop listening" : "Start listening"}
            className={cn(
              "relative grid h-14 w-14 shrink-0 place-items-center rounded-full border transition-colors duration-200",
              listening
                ? "border-bad/50 bg-bad/15 text-bad"
                : "border-line bg-elevated text-muted hover:border-strong hover:text-ink",
              !supported && "cursor-not-allowed opacity-50"
            )}
          >
            {listening ? (
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-bad/30" aria-hidden />
            ) : null}
            {listening ? (
              <MicOff className="relative h-5 w-5" aria-hidden />
            ) : (
              <Mic className="relative h-5 w-5" aria-hidden />
            )}
          </button>
          <textarea
            data-autofocus
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(transcript);
              }
            }}
            rows={2}
            placeholder={listening ? "Listening…" : "Ask DevGuard anything about production…"}
            className="min-h-[3.5rem] flex-1 resize-none rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-faint"
          />
        </div>

        {error ? <p className="text-xs text-warn">{error}</p> : null}

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setTranscript(s);
                submit(s);
              }}
              className="chip transition-colors duration-200 hover:border-strong hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>

        {ask.isError ? (
          <p className="text-xs text-bad">
            {(ask.error as Error)?.message ?? "The voice endpoint did not respond."}
          </p>
        ) : null}

        {reply ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/8 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-brand">
                {reply.intent.replace(/_/g, " ")}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">{reply.response}</p>
            {reply.incident_id ? (
              <Button className="mt-3" size="sm" variant="secondary" onClick={goToIncident}>
                Open incident #{reply.incident_id}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
