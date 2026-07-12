import type {
  LunchPollSummaryDto,
  LunchTodayPollItem,
  LunchVoteDto,
} from "@/lib/lunchApi";

export type LunchTodayPollResponse = {
  items: LunchTodayPollItem[];
  poll: LunchTodayPollItem["poll"] | null;
  myVote: LunchVoteDto | null;
  results?: LunchPollSummaryDto | null;
  balance?: number;
  monthNetChange?: number;
};

export type LunchVoteUpdatedEventData = {
  pollId?: string;
  date?: string | null;
  month?: string | null;
  affectedUserId?: string;
  affected_user_id?: string;
  selectedOptionId?: string;
  selectedOptionName?: string | null;
  selectedOptionType?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  results?: LunchPollSummaryDto | null;
  balance?: number;
  monthNetChange?: number;
  monthTotal?: {
    month: string;
    amount: number;
    wallet: number;
  };
  myVote?: LunchVoteDto | null;
};

export type LunchRealtimeEvent = {
  event: "lunch_vote_updated" | "ping" | string;
  data?: LunchVoteUpdatedEventData;
};

export function parseEventUpdatedAt(updatedAt?: string | null): number {
  if (!updatedAt) return 0;
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) ? t : 0;
}
