/** Format milliseconds remaining as a compact countdown (e.g. "1h 5m 30s"). */
import { formatTime12Label } from "@/components/pms/PmsTimePicker";

export function formatPollCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const DHAKA_TZ = "Asia/Dhaka";

export function getPollRemainingMs(endsAt: string | null | undefined, nowMs = Date.now()): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  return end - nowMs;
}

/** HH:MM in Asia/Dhaka for a time N minutes from now (used by quick-pick chips). */
export function pollEndTimeFromNow(minutes: number, nowMs = Date.now()): string {
  const target = new Date(nowMs + minutes * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(target);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function defaultPollEndTime(): string {
  return pollEndTimeFromNow(60);
}

/** Display label for when a poll was scheduled to end / did end. */
export function formatPollEndTimeLabel(poll: {
  endTime?: string | null;
  endsAt?: string | null;
}): string | null {
  if (poll.endTime) return formatTime12Label(poll.endTime);
  if (!poll.endsAt) return null;
  const end = new Date(poll.endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return formatTime12Label(
    `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
  );
}

export function isPollPastEndTime(endsAt: string | null | undefined, nowMs = Date.now()): boolean {
  const remaining = getPollRemainingMs(endsAt, nowMs);
  return remaining !== null && remaining <= 0;
}

/** True when an admin cancelled the poll before its end time (not auto-expired). */
export function isPollManuallyCancelled(
  poll: { status: string; endsAt?: string | null },
  nowMs = Date.now(),
): boolean {
  if (poll.status !== "closed") return false;
  const remaining = getPollRemainingMs(poll.endsAt, nowMs);
  if (remaining === null) return true;
  return remaining > 0;
}

export function isPollEndTimeInFuture(
  pollDate: string,
  endTime: string,
  nowMs = Date.now(),
): boolean {
  const [h, m] = endTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const end = new Date(
    `${pollDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
  );
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > nowMs;
}

export function isPollExpired(
  poll: { status: string; endsAt?: string | null },
  nowMs = Date.now(),
): boolean {
  if (poll.status === "closed") return true;
  const remaining = getPollRemainingMs(poll.endsAt, nowMs);
  return remaining !== null && remaining <= 0;
}

type PollCountOption = { id: string; count?: number | null };

/** Shift vote counts immediately when the user picks a new option (before snapshot refetch). */
export function applyOptimisticVoteCounts<T extends PollCountOption>(
  options: T[],
  totalVotes: number,
  previousOptionId: string | null | undefined,
  optimisticOptionId: string | null | undefined,
): { options: T[]; totalVotes: number } {
  if (!optimisticOptionId) {
    return { options, totalVotes };
  }

  const nextOptions = options.map((opt) => ({ ...opt, count: opt.count ?? 0 }));

  if (previousOptionId == null) {
    const target = nextOptions.find((o) => String(o.id) === String(optimisticOptionId));
    if (target) target.count = (target.count ?? 0) + 1;
    return { options: nextOptions, totalVotes: totalVotes + 1 };
  }

  for (const opt of nextOptions) {
    if (String(opt.id) === String(previousOptionId)) {
      opt.count = Math.max(0, (opt.count ?? 0) - 1);
    }
    if (String(opt.id) === String(optimisticOptionId)) {
      opt.count = (opt.count ?? 0) + 1;
    }
  }

  return { options: nextOptions, totalVotes };
}
