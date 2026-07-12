import type { QueryClient } from "@tanstack/react-query";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { lunchIdsEqual } from "@/features/lunch/lunchIdUtils";
import { findVotedOptionIdFromResults } from "@/features/lunch/lunchPollSelectionUtils";
import type { LunchTodayPollResponse } from "@/features/lunch/lunchRealtimeTypes";
import type { LunchPollSummaryDto } from "@/lib/lunchApi";

/** Keep myVote/selectedOptionId in sync when live results move the user to another option. */
export function syncPollSelectionFromResults(
  queryClient: QueryClient,
  pollId: string,
  userId: string | undefined,
  results: LunchPollSummaryDto | null | undefined,
  forcedOptionId?: string | null,
): void {
  if (!userId || !pollId) return;

  const optionId =
    (forcedOptionId ? String(forcedOptionId) : null) ?? findVotedOptionIdFromResults(userId, results);
  if (!optionId) return;

  queryClient.setQueryData<LunchTodayPollResponse>(lunchQueryKeys.todayPoll, (old) => {
    if (!old?.items?.length) return old;

    let changed = false;
    const items = old.items.map((item) => {
      if (!lunchIdsEqual(item.poll.id, pollId)) return item;

      const currentId = item.selectedOptionId ?? item.myVote?.optionId ?? null;
      if (currentId != null && lunchIdsEqual(currentId, optionId)) return item;

      changed = true;
      return {
        ...item,
        selectedOptionId: optionId,
        myVote: item.myVote
          ? { ...item.myVote, optionId }
          : {
              id: "",
              pollId: String(pollId),
              userId: String(userId),
              optionId,
            },
      };
    });

    return changed ? { ...old, items } : old;
  });
}
