import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateLunchQueries, refetchLunchSnapshotQueries } from "@/features/lunch/applyLunchVoteUpdatedEvent";
import type { LunchRealtimeEvent } from "@/features/lunch/lunchRealtimeTypes";
import { parseEventUpdatedAt } from "@/features/lunch/lunchRealtimeTypes";
import { normalizeLunchRealtimeEvent } from "@/features/lunch/normalizeVoteEvent";
import { useLunchRealtime } from "@/features/lunch/useLunchRealtime";

type LunchRealtimeContextValue = {
  lastServerUpdateAt: () => number;
  noteServerUpdate: (updatedAt?: string | null) => void;
  isServerUpdateNewer: (updatedAt?: string | null) => boolean;
};

const LunchRealtimeContext = createContext<LunchRealtimeContextValue | null>(null);

/**
 * Lunch realtime: vote events only trigger a full snapshot refetch.
 * Selected option always comes from GET /api/lunch/me/snapshot.
 */
export function LunchRealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastUpdateRef = useRef(0);

  const ctx = useMemo<LunchRealtimeContextValue>(
    () => ({
      lastServerUpdateAt: () => lastUpdateRef.current,
      noteServerUpdate: (updatedAt) => {
        const t = parseEventUpdatedAt(updatedAt);
        if (t >= lastUpdateRef.current) lastUpdateRef.current = t;
      },
      isServerUpdateNewer: (updatedAt) => {
        const t = parseEventUpdatedAt(updatedAt);
        return t === 0 || t >= lastUpdateRef.current;
      },
    }),
    [],
  );

  const handleEvent = useCallback(
    (event: LunchRealtimeEvent) => {
      const normalized = normalizeLunchRealtimeEvent(event);
      if (
        normalized.event === "lunch_vote_updated" ||
        normalized.event === "lunch_poll_summary_updated"
      ) {
        if (normalized.data?.updatedAt) ctx.noteServerUpdate(normalized.data.updatedAt);
        if (import.meta.env.DEV) {
          console.log("[lunch SSE] refetch full snapshot", normalized.data);
        }
        void refetchLunchSnapshotQueries(queryClient);
      }
    },
    [queryClient, ctx],
  );

  useLunchRealtime({
    enabled: Boolean(user),
    onEvent: handleEvent,
    onReconnect: () => invalidateLunchQueries(queryClient),
  });

  return <LunchRealtimeContext.Provider value={ctx}>{children}</LunchRealtimeContext.Provider>;
}

export function useLunchRealtimeContext(): LunchRealtimeContextValue {
  const ctx = useContext(LunchRealtimeContext);
  if (!ctx) {
    return {
      lastServerUpdateAt: () => 0,
      noteServerUpdate: () => {},
      isServerUpdateNewer: () => true,
    };
  }
  return ctx;
}
