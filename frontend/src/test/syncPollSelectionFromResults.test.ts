import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { syncPollSelectionFromResults } from "@/features/lunch/syncPollSelectionFromResults";
import type { LunchTodayPollResponse } from "@/features/lunch/lunchRealtimeTypes";

describe("syncPollSelectionFromResults", () => {
  it("updates myVote when results show user on a different option", () => {
    const client = new QueryClient();
    const pollId = "poll-1";
    const userId = "user-1";

    client.setQueryData<LunchTodayPollResponse>(lunchQueryKeys.todayPoll, {
      items: [
        {
          poll: { id: pollId, title: "Lunch", date: "2026-07-06", status: "active", costAmount: 100, allowVoteChange: true, options: [] },
          myVote: { id: "v1", pollId, userId, optionId: "personal", optionLabel: "Personal" },
          selectedOptionId: "personal",
          results: {
            totalVotes: 1,
            voters: [{ userId, userName: "U", optionId: "office", optionLabel: "Office", optionType: "office" }],
            options: [{ optionId: "office", label: "Office", optionType: "office", count: 1, voters: [{ userId, userName: "U" }] }],
          },
        },
      ],
      poll: null,
      myVote: null,
    });

    syncPollSelectionFromResults(client, pollId, userId, client.getQueryData(lunchQueryKeys.todayPoll)!.items[0].results);

    const next = client.getQueryData<LunchTodayPollResponse>(lunchQueryKeys.todayPoll)!;
    expect(next.items[0].selectedOptionId).toBe("office");
    expect(next.items[0].myVote?.optionId).toBe("office");
  });
});
