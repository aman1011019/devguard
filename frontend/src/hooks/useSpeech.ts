import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API wrapper with an honest capability flag.
 *
 * Recognition is Chromium-only, so `supported` is exposed and the Voice modal
 * falls back to a text box everywhere else — the feature always works, it just
 * changes input method. Synthesis is used for spoken replies when available.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const finalRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((final || interim).trim());
      if (final.trim()) finalRef.current?.(final.trim());
    };
    rec.onerror = (event: any) => {
      setError(
        event?.error === "not-allowed"
          ? "Microphone permission denied — type your command instead."
          : `Speech error: ${event?.error ?? "unknown"}`
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, []);

  const start = useCallback((onFinal?: (text: string) => void) => {
    const rec = recRef.current;
    if (!rec) return;
    finalRef.current = onFinal ?? null;
    setError(null);
    setTranscript("");
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start() throws if already running — harmless */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    } catch {
      /* synthesis unavailable — the reply is still shown on screen */
    }
  }, []);

  return { supported, listening, transcript, error, start, stop, speak, setTranscript };
}
