import { getStoredToken } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/apiBase";

const API_BASE = getApiBaseUrl();

async function lunchRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Could not reach the server. Restart the backend and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export type LunchOptionType = "office" | "personal" | "off";

export type LunchPollOptionDto = {
  id: string;
  pollId: string;
  label: string;
  optionType: LunchOptionType;
  orderIndex: number;
};

export type LunchPollDto = {
  id: string;
  date: string;
  title: string;
  status: "active" | "closed";
  costAmount: number;
  allowVoteChange: boolean;
  endTime?: string | null;
  endsAt?: string | null;
  totalVotes?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  options?: LunchPollOptionDto[];
};

export type LunchVoteDto = {
  id: string;
  pollId: string;
  userId: string;
  userName?: string;
  optionId: string;
  optionLabel?: string;
  optionType?: LunchOptionType;
  pollDate?: string;
  pollTitle?: string | null;
  balanceChange?: number | null;
  votedAt?: string;
  runningBalance?: number | null;
};

export type LunchBalanceTransactionDto = {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  reason: string;
  referenceVoteId?: string | null;
  createdBy?: string;
  createdAt?: string;
  runningBalance?: number | null;
};

export type LunchSettingsDto = {
  defaultCostAmount: number;
  allowVoteChange: boolean;
  updatedAt?: string;
};

export type LunchPollSummaryOptionDto = {
  optionId: string;
  label: string;
  optionType: LunchOptionType;
  count: number;
  voters?: { userId: string; userName: string }[];
};

export type LunchPollSummaryDto = {
  poll: LunchPollDto;
  countsByLabel: Record<string, number>;
  options: LunchPollSummaryOptionDto[];
  voters: {
    userId: string;
    userName: string;
    optionId: string;
    optionLabel: string;
    optionType: LunchOptionType;
    balanceChange?: number | null;
    votedAt?: string;
  }[];
  totalVotes: number;
  officeOrderCount: number;
};

export type LunchEmployeeBalanceDto = {
  userId: string;
  userName: string;
  email: string;
  balance: number;
  periodBalanceChange?: number;
};

export type LunchEmployeeBalancesResponse = {
  items: LunchEmployeeBalanceDto[];
  totalPeriodBalanceChange?: number;
  from?: string | null;
  to?: string | null;
};

export type LunchAdminUserMonthPollDto = {
  pollId: string;
  pollDate: string | null;
  pollTitle: string;
  costAmount: number;
  status: "active" | "closed";
  options: LunchPollOptionDto[];
  voteId: string | null;
  optionId: string | null;
  optionLabel: string | null;
  optionType: LunchOptionType | null;
  balanceChange: number | null;
};

export type LunchAdminUserMonthDetailDto = {
  userId: string;
  userName: string;
  email: string;
  month?: string;
  from?: string;
  to?: string;
  periodLabel?: string | null;
  balance: number;
  monthNetChange?: number;
  periodNetChange: number;
  items: LunchAdminUserMonthPollDto[];
};

export type LunchTodayPollItem = {
  poll: LunchPollDto;
  myVote: LunchVoteDto | null;
  selectedOptionId?: string | null;
  results?: LunchPollSummaryDto | null;
};

/** Option row on the lunch page snapshot (counts embedded from DB). */
export type LunchSnapshotOptionDto = LunchPollOptionDto & {
  name?: string;
  count: number;
  percentage: number;
  voters?: { userId: string; userName: string }[];
};

export type LunchSnapshotMyVoteDto = {
  optionId: string;
  option_id?: string;
  optionName?: string | null;
  option_name?: string | null;
  optionType?: LunchOptionType | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  id?: string;
  pollId?: string;
  userId?: string;
  balanceChange?: number | null;
};

export type LunchSnapshotPollItem = {
  poll: LunchPollDto & { options?: LunchSnapshotOptionDto[]; totalVotes?: number };
  myVote: LunchSnapshotMyVoteDto | null;
  my_vote?: LunchSnapshotMyVoteDto | null;
  selectedOptionId?: string | null;
  results?: LunchPollSummaryDto | null;
};

export type LunchSnapshotMonthTotal = {
  month: string;
  amount: number;
  wallet: number;
  status: "credit" | "debit" | "neutral" | string;
};

/** Full lunch page state — single source of truth. */
export type LunchSnapshotDto = {
  date: string;
  month: string;
  items: LunchSnapshotPollItem[];
  poll: LunchSnapshotPollItem["poll"] | null;
  myVote: LunchSnapshotMyVoteDto | null;
  my_vote?: LunchSnapshotMyVoteDto | null;
  results?: LunchPollSummaryDto | null;
  monthTotal: LunchSnapshotMonthTotal;
  month_total?: LunchSnapshotMonthTotal;
  balance: number;
  monthNetChange: number;
  voteHistory: LunchVoteDto[];
  vote_history?: LunchVoteDto[];
};

export type LunchDashboardDto = {
  today: string;
  hasActivePoll: boolean;
  todayPoll: LunchPollDto | null;
  totalVotesToday: number;
  officeOrderCount: number;
  activePolls: number;
  options?: LunchPollSummaryDto["options"];
};

export type CreatePollOptionInput = {
  label: string;
  optionType: LunchOptionType;
  orderIndex?: number;
};

export type UpdatePollOptionInput = {
  id: string;
  label: string;
  optionType: LunchOptionType;
};

export type LunchVoteHistoryResponse = {
  items: LunchVoteDto[];
  totalBalanceChange: number;
  from?: string | null;
  to?: string | null;
};

export const lunchApi = {
  getSettings: () => lunchRequest<LunchSettingsDto>("/api/lunch/settings"),

  /** Full lunch page snapshot — my_vote always from database. */
  getSnapshot: (params?: { date?: string; month?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set("date", params.date);
    if (params?.month) q.set("month", params.month);
    const qs = q.toString();
    return lunchRequest<LunchSnapshotDto>(`/api/lunch/me/snapshot${qs ? `?${qs}` : ""}`);
  },

  updateSettings: (body: Partial<LunchSettingsDto>) =>
    lunchRequest<LunchSettingsDto>("/api/lunch/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getDashboard: () => lunchRequest<LunchDashboardDto>("/api/lunch/dashboard"),

  getTodayPoll: () =>
    lunchRequest<{
      items: LunchTodayPollItem[];
      poll: LunchPollDto | null;
      myVote: LunchVoteDto | null;
      results?: LunchPollSummaryDto | null;
      balance?: number;
      monthNetChange?: number;
    }>("/api/lunch/polls/today"),

  listPolls: (params?: { from?: string; to?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return lunchRequest<LunchPollDto[]>(`/api/lunch/polls${qs ? `?${qs}` : ""}`);
  },

  createPoll: (body: {
    date?: string;
    title?: string;
    costAmount?: number;
    allowVoteChange?: boolean;
    endTime?: string;
    options: CreatePollOptionInput[];
  }) =>
    lunchRequest<LunchPollDto>("/api/lunch/polls", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updatePoll: (
    id: string,
    body: {
      title?: string;
      costAmount?: number;
      allowVoteChange?: boolean;
      endTime?: string;
      extendMinutes?: number;
      options?: CreatePollOptionInput[];
      optionUpdates?: UpdatePollOptionInput[];
    },
  ) =>
    lunchRequest<LunchPollDto>(`/api/lunch/polls/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getPoll: (id: string) =>
    lunchRequest<{
      poll: LunchPollDto;
      results: LunchPollSummaryDto;
      myVote?: LunchVoteDto | null;
    }>(`/api/lunch/polls/${id}`),

  setPollStatus: (id: string, status: "active" | "closed") =>
    lunchRequest<LunchPollDto>(`/api/lunch/polls/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deletePoll: (id: string) =>
    lunchRequest<{ ok: boolean }>(`/api/lunch/polls/${id}`, { method: "DELETE" }),

  castVote: (pollId: string, optionId: string) =>
    lunchRequest<{
      vote: LunchVoteDto;
      selectedOptionId?: string;
      balance: number;
      monthNetChange?: number;
      updatedAt?: string;
      results: LunchPollSummaryDto;
    }>(`/api/lunch/polls/${pollId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    }),

  adminSetUserVote: (pollId: string, userId: string, optionId: string) =>
    lunchRequest<{
      pollId: string;
      vote: LunchVoteDto;
      selectedOptionId: string;
      selectedOptionName?: string;
      balance: number;
      balanceChange: number | null;
      monthNetChange: number;
      updatedAt?: string;
      results?: LunchPollSummaryDto;
      myVote?: LunchVoteDto;
    }>(`/api/lunch/polls/${pollId}/admin-vote`, {
        method: "POST",
        body: JSON.stringify({ userId, optionId }),
      },
    ),

  getAdminUserMonthDetail: (userId: string, params?: { month?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.month) q.set("month", params.month);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return lunchRequest<LunchAdminUserMonthDetailDto>(
      `/api/lunch/admin/users/${userId}/month${qs ? `?${qs}` : ""}`,
    );
  },

  getPollSummary: (pollId: string) => lunchRequest<LunchPollSummaryDto>(`/api/lunch/polls/${pollId}/summary`),

  getVoteHistory: async (params?: {
    userId?: string;
    from?: string;
    to?: string;
    optionType?: string;
  }): Promise<LunchVoteHistoryResponse> => {
    const q = new URLSearchParams();
    if (params?.userId) q.set("userId", params.userId);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.optionType) q.set("optionType", params.optionType);
    const qs = q.toString();
    const data = await lunchRequest<LunchVoteHistoryResponse | LunchVoteDto[]>(
      `/api/lunch/votes/history${qs ? `?${qs}` : ""}`,
    );

    if (Array.isArray(data)) {
      return {
        items: data,
        totalBalanceChange: data.reduce((sum, row) => sum + (row.balanceChange ?? 0), 0),
      };
    }

    const items = Array.isArray(data.items) ? data.items : [];
    return {
      items,
      totalBalanceChange: data.totalBalanceChange ?? items.reduce((sum, row) => sum + (row.balanceChange ?? 0), 0),
      from: data.from,
      to: data.to,
    };
  },

  getMyBalance: (params?: { month?: string }) => {
    const q = new URLSearchParams();
    if (params?.month) q.set("month", params.month);
    const qs = q.toString();
    return lunchRequest<{ balance: number; month: string; monthNetChange: number }>(
      `/api/lunch/balance/me${qs ? `?${qs}` : ""}`,
    );
  },

  getBalanceTransactions: (params?: { userId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.userId) q.set("userId", params.userId);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return lunchRequest<{ items: LunchBalanceTransactionDto[] }>(
      `/api/lunch/balance/transactions${qs ? `?${qs}` : ""}`,
    );
  },

  listEmployeeBalances: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return lunchRequest<LunchEmployeeBalancesResponse>(
      `/api/lunch/balance/employees${qs ? `?${qs}` : ""}`,
    );
  },

  adjustBalance: (body: { userId: string; amount: number; reason: string }) =>
    lunchRequest<{ transaction: LunchBalanceTransactionDto; balance: number }>("/api/lunch/balance/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function formatBdt(amount: number): string {
  const sign = amount < 0 ? "-" : amount > 0 ? "+" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-BD")} TK`;
}

export function formatBalanceBdt(amount: number): string {
  const sign = amount < 0 ? "-" : amount > 0 ? "+" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-BD")} TK`;
}

/** User-facing balance with +/- sign. */
export function formatBalanceDisplay(amount: number): string {
  return formatBalanceBdt(amount);
}

export const DEFAULT_POLL_OPTIONS: CreatePollOptionInput[] = [
  { label: "Personal", optionType: "personal", orderIndex: 0 },
  { label: "Off", optionType: "off", orderIndex: 1 },
];
