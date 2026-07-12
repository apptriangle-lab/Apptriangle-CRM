import { useEffect, useRef } from "react";
import { getStoredToken } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/apiBase";
import type { LunchRealtimeEvent } from "@/features/lunch/lunchRealtimeTypes";

const API_BASE = getApiBaseUrl();

type Options = {
  enabled: boolean;
  onEvent: (event: LunchRealtimeEvent) => void;
  onReconnect?: () => void;
};

/** SSE connection for lunch poll real-time updates (Flask-compatible). */
export function useLunchRealtime({ enabled, onEvent, onReconnect }: Options): void {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let retryTimer: number | undefined;
    let retryMs = 1000;
    let cancelled = false;
    let hadDisconnect = false;

    const open = () => {
      if (cancelled) return;
      const token = getStoredToken();
      if (!token) return;

      es?.close();
      const url = `${API_BASE}/api/lunch/events/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as LunchRealtimeEvent;
          if (payload.event === "ping") return;
          onEventRef.current(payload);
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onopen = () => {
        if (hadDisconnect) {
          onReconnectRef.current?.();
        }
        hadDisconnect = false;
        retryMs = 1000;
      };

      es.onerror = () => {
        hadDisconnect = true;
        es?.close();
        es = null;
        if (cancelled) return;
        retryTimer = window.setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30_000);
          open();
        }, retryMs);
      };
    };

    open();

    const onVisible = () => {
      if (document.visibilityState === "visible" && (!es || es.readyState === EventSource.CLOSED)) {
        open();
        if (hadDisconnect) {
          onReconnectRef.current?.();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
    };
  }, [enabled]);
}
