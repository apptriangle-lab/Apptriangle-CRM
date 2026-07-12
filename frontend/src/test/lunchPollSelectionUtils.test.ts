import { describe, expect, it } from "vitest";
import {
  findVotedOptionIdFromResults,
  getMyVoteOptionId,
  resolveSelectedOptionId,
} from "@/features/lunch/lunchPollSelectionUtils";
import type { LunchTodayPollItem } from "@/lib/lunchApi";

const userId = "user-1";

function makeItem(overrides: Partial<LunchTodayPollItem> = {}): LunchTodayPollItem {
  return {
    poll: {
      id: "poll-1",
      title: "Lunch",
      date: "2026-07-06",
      status: "active",
      costAmount: 100,
      allowVoteChange: true,
      options: [
        { id: "opt-a", label: "Option A", optionType: "office", sortOrder: 0 },
        { id: "opt-b", label: "Option B", optionType: "office", sortOrder: 1 },
      ],
    },
    myVote: { id: "vote-1", pollId: "poll-1", userId, optionId: "opt-a", optionLabel: "Option A" },
    selectedOptionId: "opt-a",
    results: {
      totalVotes: 1,
      voters: [{ userId, userName: "Test User", optionId: "opt-b", optionLabel: "Option B", optionType: "office" }],
      options: [
        {
          optionId: "opt-b",
          label: "Option B",
          optionType: "office",
          count: 1,
          voters: [{ userId, userName: "Test User" }],
        },
      ],
    },
    ...overrides,
  };
}

describe("lunchPollSelectionUtils", () => {
  it("prefers results voters over stale myVote after admin override", () => {
    const item = makeItem();
    expect(resolveSelectedOptionId(userId, item)).toBe("opt-b");
    expect(getMyVoteOptionId(item, userId)).toBe("opt-b");
  });

  it("falls back to myVote when user is not in results voters", () => {
    const item = makeItem({
      results: {
        totalVotes: 0,
        options: [],
      },
    });
    expect(resolveSelectedOptionId(userId, item)).toBe("opt-a");
  });

  it("finds voted option from results voters list", () => {
    const optionId = findVotedOptionIdFromResults(userId, makeItem().results);
    expect(optionId).toBe("opt-b");
  });

  it("prefers results over a sticky SSE server pick from an earlier self-vote", () => {
    const item = makeItem();
    // User had selected opt-a locally; admin moved them to opt-b in results.
    expect(resolveSelectedOptionId(userId, item, { optionId: "opt-a" })).toBe("opt-b");
  });

  it("uses SSE server pick when results do not list the user yet", () => {
    const item = makeItem({
      results: { totalVotes: 0, options: [], voters: [] },
      myVote: undefined,
      selectedOptionId: null,
    });
    expect(resolveSelectedOptionId(userId, item, { optionId: "opt-b" })).toBe("opt-b");
  });
});
