import type { LunchPollSummaryDto, LunchTodayPollItem } from "@/lib/lunchApi";
import { lunchIdsEqual } from "@/features/lunch/lunchIdUtils";

/** Find which option the user voted for from poll summary (flat voters list or per-option voters). */
export function findVotedOptionIdFromResults(
  userId: string | undefined,
  results: LunchPollSummaryDto | null | undefined,
): string | null {
  if (!userId || !results) return null;

  const flat = results.voters?.find((v) => lunchIdsEqual(v.userId, userId));
  if (flat?.optionId != null) return String(flat.optionId);

  if (!results.options?.length) return null;
  for (const opt of results.options) {
    if (opt.voters?.some((v) => lunchIdsEqual(v.userId, userId))) {
      return String(opt.optionId);
    }
  }
  return null;
}

/**
 * Resolve highlighted poll option for the current user.
 * Prefer live results (same source as progress bars) so admin overrides win over
 * a sticky local SSE pick from the user's earlier self-vote.
 */
export function resolveSelectedOptionId(
  userId: string | undefined,
  item: LunchTodayPollItem,
  serverPick?: { optionId: string } | null,
): string | null {
  const fromResults = findVotedOptionIdFromResults(userId, item.results);
  if (fromResults != null) return fromResults;

  if (item.selectedOptionId != null) return String(item.selectedOptionId);
  if (item.myVote?.optionId != null) return String(item.myVote.optionId);
  if (serverPick?.optionId) return String(serverPick.optionId);
  return null;
}

export function isOptionSelected(selectedOptionId: string | null, optionId: string): boolean {
  return selectedOptionId != null && lunchIdsEqual(selectedOptionId, optionId);
}

export function getMyVoteOptionId(
  item: LunchTodayPollItem,
  userId?: string,
  serverPick?: { optionId: string } | null,
): string | null {
  return resolveSelectedOptionId(userId, item, serverPick);
}
