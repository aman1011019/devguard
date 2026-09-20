import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wsUrl } from "@/lib/api";
import type { WsEvent } from "@/lib/events";

export type SocketStatus = "connecting" | "open" | "closed";

const MAX_EVENTS = 300;

/**
 * Live WebSocket channel for an incident (`0` = global dashboard channel).
 *
 * Three things make this cheap enough to leave running for a whole demo:
 *  - incoming frames are buffered and flushed once per animation frame, so a
 *    burst of agent events costs one re-render instead of a dozen;
 *  - `onEvent` is held in a ref, so passing an inline arrow function does not
 *    tear down the socket;
 *  - the event log is bounded, so long sessions cannot grow without limit.
 *
 * Reconnection uses capped exponential backoff. The backend replays its last
 * 200 events on connect, so a reconnect mid-investigation still ends up with
 * the complete story rather than a hole.
 */
export function useSocket(incidentId: number | null, onEvent?: (e: WsEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [events, setEvents] = useState<WsEvent[]>([]);

  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const socketRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<WsEvent[]>([]);
  const frameRef = useRef<number | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  const flush = useCallback(() => {
    frameRef.current = null;
    const batch = bufferRef.current;
    if (!batch.length) return;
    bufferRef.current = [];
    setEvents((prev) => {
      const next = prev.concat(batch);
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }, []);

  useEffect(() => {
    if (incidentId === null) return;
    aliveRef.current = true;
    setEvents([]);
    bufferRef.current = [];

    const connect = () => {
      if (!aliveRef.current) return;
      setStatus((s) => (s === "open" ? s : "connecting"));

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl(incidentId));
      } catch {
        schedule();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };

      ws.onmessage = (ev) => {
        let parsed: WsEvent;
        try {
          parsed = JSON.parse(ev.data as string) as WsEvent;
        } catch {
          return;
        }
        // Imperative listeners fire immediately (GSAP flashes, cache
        // invalidation); state updates are batched to the next frame.
        handlerRef.current?.(parsed);
        bufferRef.current.push(parsed);
        if (frameRef.current === null) {
          frameRef.current = requestAnimationFrame(flush);
        }
      };

      ws.onclose = () => {
        socketRef.current = null;
        if (!aliveRef.current) return;
        setStatus("closed");
        schedule();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* already closing */
        }
      };
    };

    const schedule = () => {
      if (!aliveRef.current || timerRef.current !== null) return;
      const delay = Math.min(800 * 2 ** retryRef.current, 8000);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        connect();
      }, delay);
    };

    connect();

    return () => {
      aliveRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      timerRef.current = null;
      frameRef.current = null;
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          ws.close();
        } catch {
          /* noop */
        }
      }
    };
  }, [incidentId, flush]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setEvents([]);
  }, []);

  const last = events.length ? events[events.length - 1] : null;

  return useMemo(() => ({ status, events, last, clear }), [status, events, last, clear]);
}

/** Channel 0: incident detection + system resets, watched app-wide. */
export const useGlobalSocket = (onEvent?: (e: WsEvent) => void) => useSocket(0, onEvent);
