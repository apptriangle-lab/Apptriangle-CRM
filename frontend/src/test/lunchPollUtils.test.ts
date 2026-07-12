import { describe, expect, it } from "vitest";
import {
  applyOptimisticVoteCounts,
  isPollManuallyCancelled,
  isPollExpired,
} from "@/components/lunch/lunchPollUtils";

describe("lunch poll closure labels", () => {
  const pastEndsAt = new Date(Date.now() - 60_000).toISOString();
  const futureEndsAt = new Date(Date.now() + 60_000).toISOString();

  it("treats closed poll after end time as expired, not manually cancelled", () => {
    const poll = { status: "closed", endsAt: pastEndsAt };
    expect(isPollManuallyCancelled(poll)).toBe(false);
    expect(isPollExpired(poll)).toBe(true);
  });

  it("treats closed poll before end time as manually cancelled", () => {
    const poll = { status: "closed", endsAt: futureEndsAt };
    expect(isPollManuallyCancelled(poll)).toBe(true);
    expect(isPollExpired(poll)).toBe(true);
  });
});

describe("applyOptimisticVoteCounts", () => {
  const options = [
    { id: "a", count: 3 },
    { id: "b", count: 2 },
  ];

  it("shifts counts when changing vote", () => {
    const { options: next, totalVotes } = applyOptimisticVoteCounts(options, 5, "a", "b");
    expect(next.find((o) => o.id === "a")?.count).toBe(2);
    expect(next.find((o) => o.id === "b")?.count).toBe(3);
    expect(totalVotes).toBe(5);
  });

  it("adds first vote to total", () => {
    const { options: next, totalVotes } = applyOptimisticVoteCounts(options, 5, null, "a");
    expect(next.find((o) => o.id === "a")?.count).toBe(4);
    expect(totalVotes).toBe(6);
  });
});
