import type { QueryClient } from "@tanstack/react-query";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import type { LunchRealtimeEvent } from "@/features/lunch/lunchRealtimeTypes";
import { normalizeLunchRealtimeEvent } from "@/features/lunch/normalizeVoteEvent";

/**
 * Vote events are signals only. Replace lunch page state via full snapshot refetch.
 * Do not patch selected option / progress bars from the event payload.
 */
export async function refetchLunchSnapshotQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: lunchQueryKeys.snapshotPrefix }),
    queryClient.refetchQueries({ queryKey: lunchQueryKeys.snapshotPrefix }),
    queryClient.invalidateQueries({ queryKey: lunchQueryKeys.todayPoll }),
    queryClient.invalidateQueries({ queryKey: ["lunchMonthTotal"] }),
    queryClient.invalidateQueries({ queryKey: ["voteHistory"] }),
  ]);
}

/** Handle SSE vote event: refetch full lunch snapshot (source of truth). */
export async function handleLunchVoteUpdatedEvent(
  queryClient: QueryClient,
  event: LunchRealtimeEvent,
): Promise<void> {
  const normalized = normalizeLunchRealtimeEvent(event);
  if (
    normalized.event !== "lunch_vote_updated" &&
    normalized.event !== "lunch_poll_summary_updated"
  ) {
    return;
  }

  if (import.meta.env.DEV) {
    console.debug("[lunch SSE] signal → refetch snapshot", {
      event: normalized.event,
      data: normalized.data,
    });
  }

  await refetchLunchSnapshotQueries(queryClient);
}

/** Reconnect / reconnect: full snapshot refresh. */
export function invalidateLunchQueries(queryClient: QueryClient): void {
  void refetchLunchSnapshotQueries(queryClient);
}

/** No-op — selection must come from snapshot refetch only. */
export function applyLunchVoteUpdatedEvent(
  _queryClient: QueryClient,
  _event: LunchRealtimeEvent,
  _currentUserId?: string,
): void {
  // Intentionally empty: do not patch selected option from SSE payload.
}
