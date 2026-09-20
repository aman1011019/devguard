/** Resilient auto-reconnecting WebSocket hook with event catch-up. */
import { useEffect, useRef } from "react";
import { api, wsUrl } from "@/lib/api";
import { realtimeStore } from "@/store/realtimeStore";

export function useWebSocket(
  channel: number | string = "system",
  onEvent?: (event: any) => void
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const retryCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    retryCountRef.current = 0;

    const connect = () => {
      if (!aliveRef.current) return;
      const url = wsUrl(channel);

      realtimeStore.setConnectionStatus(
        retryCountRef.current === 0 ? "LIVE" : "RECONNECTING"
      );

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!aliveRef.current) {
          ws.close();
          return;
        }
        realtimeStore.setConnectionStatus("LIVE");
        const wasReconnecting = retryCountRef.current > 0;
        retryCountRef.current = 0;

        // If reconnecting, fetch missed events using the stored lastEventId
        if (wasReconnecting) {
          const lastId = realtimeStore.getState().lastEventId;
          if (lastId) {
            if (String(channel).toLowerCase() === "system" || channel === 0) {
              api.systemEvents(lastId).then((missed: any) => {
                if (Array.isArray(missed)) {
                  missed.forEach((e) => realtimeStore.addEvent(e));
                }
              }).catch(() => {});
            } else if (typeof channel === "number") {
              api.incidentEvents(channel, lastId).then((missed: any) => {
                if (Array.isArray(missed)) {
                  missed.forEach((e) => realtimeStore.addEvent(e));
                }
              }).catch(() => {});
            }
          }
        }
      };

      ws.onmessage = (ev) => {
        if (!aliveRef.current) return;
        try {
          const data = JSON.parse(ev.data);
          realtimeStore.addEvent(data);
          if (handlerRef.current) {
            handlerRef.current(data);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (!aliveRef.current) return;
        ws.close();
      };
    };

    const scheduleReconnect = () => {
      realtimeStore.setConnectionStatus("RECONNECTING");
      retryCountRef.current += 1;
      const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
      timerRef.current = window.setTimeout(() => {
        if (aliveRef.current) {
          connect();
        }
      }, delay);
    };

    connect();

    return () => {
      aliveRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [channel]);
}
