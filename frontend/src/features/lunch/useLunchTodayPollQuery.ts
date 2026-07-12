import { useQuery } from "@tanstack/react-query";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { findVotedOptionIdFromResults } from "@/features/lunch/lunchPollSelectionUtils";
import type { LunchTodayPollResponse } from "@/features/lunch/lunchRealtimeTypes";
import { lunchApi, type LunchTodayPollItem } from "@/lib/lunchApi";

function normalizeTodayPollItem(item: LunchTodayPollItem, userId?: string): LunchTodayPollItem {
  const fromResults = userId ? findVotedOptionIdFromResults(userId, item.results) : null;
  const optionId = fromResults ?? item.selectedOptionId ?? item.myVote?.optionId ?? null;
  if (optionId == null) return item;
  return {
    ...item,
    selectedOptionId: String(optionId),
    myVote: item.myVote ? { ...item.myVote, optionId: String(optionId) } : item.myVote,
  };
}

export function fetchTodayPoll(userId?: string): Promise<LunchTodayPollResponse> {
  return lunchApi.getTodayPoll().then((r) => {
    const rawItems = Array.isArray(r.items)
      ? r.items
      : r.poll
        ? [{ poll: r.poll, myVote: r.myVote, results: r.results ?? null, selectedOptionId: r.myVote?.optionId ?? null }]
        : [];
    const items = rawItems.map((item) => normalizeTodayPollItem(item, userId));
    return {
      items,
      poll: r.poll ?? null,
      myVote: r.myVote ?? null,
      results: r.results ?? null,
      balance: r.balance,
      monthNetChange: r.monthNetChange,
    };
  });
}

export function useLunchTodayPollQuery(userId?: string) {
  return useQuery({
    queryKey: lunchQueryKeys.todayPoll,
    queryFn: () => fetchTodayPoll(userId),
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.items?.some((i) => i.poll.status === "active");
      return hasActive ? 60_000 : 120_000;
    },
    refetchOnWindowFocus: true,
  });
}
