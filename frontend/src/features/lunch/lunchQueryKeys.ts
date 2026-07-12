export const lunchQueryKeys = {
  /** Full lunch page state — invalidate this on any vote update. */
  snapshot: (date: string, month: string) => ["lunchSnapshot", date, month] as const,
  snapshotPrefix: ["lunchSnapshot"] as const,
  todayPoll: ["todayLunchPoll"] as const,
  monthBalance: (month: string) => ["lunchMonthTotal", month] as const,
  myVote: (pollId: string, userId: string) => ["myLunchVote", pollId, userId] as const,
  voteHistory: (params: { from?: string; to?: string; userId?: string; month?: string }) =>
    ["voteHistory", params] as const,
  adminUserMonth: (userId: string, period: string) => ["lunchAdminUserMonth", userId, period] as const,
};
