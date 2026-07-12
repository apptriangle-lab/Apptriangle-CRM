import { endOfMonth, format, isSameDay, parse, startOfMonth, subMonths } from "date-fns";
import type { LunchMonthOption } from "@/components/lunch/LunchMonthFilterDropdown";
import type { LunchDateRange } from "@/components/lunch/lunchDateRangeUtils";

/** yyyy-MM for the current calendar month in Asia/Dhaka (matches lunch poll dates). */
export function currentMonthKey(): string {
  return dhakaTodayIso().slice(0, 7);
}

export function buildMonthOptions(count = 24): LunchMonthOption[] {
  const anchor = parse(`${dhakaTodayIso()}T12:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
  const now = startOfMonth(anchor);
  const currentKey = currentMonthKey();
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(now, i);
    const value = format(d, "yyyy-MM");
    return {
      value,
      label: format(d, "MMMM yyyy"),
      isCurrent: value === currentKey,
    };
  });
}

export function monthToDateRange(monthKey: string): { from: string; to: string } {
  const start = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
  const end = endOfMonth(start);
  return {
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
  };
}

export function monthLabel(monthKey: string): string {
  return format(parse(`${monthKey}-01`, "yyyy-MM-dd", new Date()), "MMMM yyyy");
}

/** Full calendar month as a lunch date range (for vote history filter). */
export function monthKeyToLunchDateRange(monthKey: string): LunchDateRange {
  const start = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
  return { from: startOfMonth(start), to: endOfMonth(start) };
}

/** Returns yyyy-MM when the range is exactly one full calendar month. */
export function lunchDateRangeToMonthKey(range: LunchDateRange): string | null {
  if (!range.from || !range.to) return null;
  const monthStart = startOfMonth(range.from);
  const monthEnd = endOfMonth(range.from);
  if (
    format(range.from, "yyyy-MM") === format(range.to, "yyyy-MM") &&
    isSameDay(range.from, monthStart) &&
    isSameDay(range.to, monthEnd)
  ) {
    return format(range.from, "yyyy-MM");
  }
  return null;
}

/** Calendar date for today in Asia/Dhaka (matches lunch poll dates). */
export function dhakaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}
