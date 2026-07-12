import type { LeaveDto, LeaveDurationType, HalfDayPeriod } from "@/lib/api";

export const DURATION_OPTIONS: { value: LeaveDurationType; label: string }[] = [
  { value: "single_day", label: "Single Day" },
  { value: "half_day", label: "Half Day" },
  { value: "multiple_day", label: "Multiple Day" },
];

export function durationTypeLabel(dt: LeaveDurationType | undefined) {
  const o = DURATION_OPTIONS.find((x) => x.value === dt);
  return o?.label ?? "Multiple Day";
}

export function normalizeHalfDayPeriodValue(
  period: HalfDayPeriod | string | null | undefined,
): HalfDayPeriod | null {
  if (period == null || typeof period !== "string") return null;
  const v = period.trim().toLowerCase().replace(/-/g, "_");
  if (v === "first_half") return "first_half";
  if (v === "second_half") return "second_half";
  return null;
}

export function halfDayPeriodLabel(
  period: HalfDayPeriod | string | null | undefined,
) {
  const n = normalizeHalfDayPeriodValue(period);
  if (n === "first_half") return "First half";
  if (n === "second_half") return "Second half";
  return "—";
}

export function isHalfDayLeaveDetail(leave: LeaveDto) {
  const dt = (leave.durationType || "").toString().trim().toLowerCase();
  if (dt === "half_day") return true;
  const tld = Number(leave.totalLeaveDays);
  if (tld === 0.5 && dt !== "multiple_day") return true;
  return normalizeHalfDayPeriodValue(leave.halfDayPeriod) != null;
}
