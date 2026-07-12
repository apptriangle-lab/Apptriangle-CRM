import type { LunchVoteUpdatedEventData, LunchRealtimeEvent } from "@/features/lunch/lunchRealtimeTypes";

type RawRecord = Record<string, unknown>;

function pickString(obj: RawRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== "") return String(val);
  }
  return undefined;
}

function normalizeMyVote(raw: unknown): LunchVoteUpdatedEventData["myVote"] {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as RawRecord;
  const optionId = obj.optionId ?? obj.option_id;
  if (optionId == null) return raw as LunchVoteUpdatedEventData["myVote"];
  return {
    ...(obj as LunchVoteUpdatedEventData["myVote"] & RawRecord),
    optionId: String(optionId),
  };
}

/** Normalize SSE payload — supports camelCase and snake_case field names. */
export function normalizeVoteEventData(raw: unknown): LunchVoteUpdatedEventData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as RawRecord;

  const pollId = pickString(obj, "pollId", "poll_id");
  const affectedUserId = pickString(obj, "affectedUserId", "affected_user_id");
  const selectedOptionId = pickString(obj, "selectedOptionId", "selected_option_id");
  const date = pickString(obj, "date");
  const month = pickString(obj, "month");
  const updatedAt = pickString(obj, "updatedAt", "updated_at");

  // Signal-only payloads may omit pollId; still valid if date or affected user present.
  if (!pollId && !date && !affectedUserId) return null;

  return {
    pollId: pollId ?? "",
    date: date ?? null,
    month: month ?? null,
    affectedUserId: affectedUserId ?? "",
    affected_user_id: affectedUserId ?? "",
    selectedOptionId: selectedOptionId ?? "",
    selectedOptionName:
      (pickString(obj, "selectedOptionName", "selected_option_name") as string | undefined) ?? null,
    selectedOptionType:
      (pickString(obj, "selectedOptionType", "selected_option_key", "selected_option_type") as
        | string
        | undefined) ?? null,
    updatedAt: updatedAt ?? null,
    updated_at: updatedAt ?? null,
    results: obj.results as LunchVoteUpdatedEventData["results"],
    balance: typeof obj.balance === "number" ? obj.balance : undefined,
    monthNetChange:
      typeof obj.monthNetChange === "number"
        ? obj.monthNetChange
        : typeof (obj.month_total as RawRecord | undefined)?.amount === "number"
          ? ((obj.month_total as RawRecord).amount as number)
          : undefined,
    monthTotal: (obj.monthTotal ?? obj.month_total) as LunchVoteUpdatedEventData["monthTotal"],
    myVote: normalizeMyVote(obj.myVote ?? obj.my_vote),
  };
}

export function normalizeLunchRealtimeEvent(event: LunchRealtimeEvent): LunchRealtimeEvent {
  if (!event.data) return event;
  const normalized = normalizeVoteEventData(event.data);
  if (!normalized) return event;
  return { ...event, data: normalized };
}

export function getCurrentUserId(user: { id?: string; user_id?: string; employee_id?: string } | null): string | undefined {
  if (!user) return undefined;
  return user.id ?? user.user_id ?? user.employee_id;
}
