import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

export type LunchDateRange = {
  from?: Date;
  to?: Date;
};

export function lunchDateRangeToIso(range: LunchDateRange): { from?: string; to?: string } {
  return {
    from: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
    to: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
  };
}

export function currentMonthDateRange(): LunchDateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export function lastSevenDaysRange(): LunchDateRange {
  const now = new Date();
  return { from: subDays(now, 6), to: now };
}

export function lastWeekRange(): LunchDateRange {
  const prevWeek = subWeeks(new Date(), 1);
  return {
    from: startOfWeek(prevWeek, { weekStartsOn: 1 }),
    to: endOfWeek(prevWeek, { weekStartsOn: 1 }),
  };
}

export function thisWeekRange(): LunchDateRange {
  const now = new Date();
  return {
    from: startOfWeek(now, { weekStartsOn: 1 }),
    to: endOfWeek(now, { weekStartsOn: 1 }),
  };
}

export function lastMonthDateRange(): LunchDateRange {
  const prev = subMonths(new Date(), 1);
  return { from: startOfMonth(prev), to: endOfMonth(prev) };
}

export function hasLunchDateRange(range: LunchDateRange): boolean {
  return Boolean(range.from || range.to);
}

export function formatLunchDateRangeLabel(range: LunchDateRange): string {
  if (range.from && range.to) {
    return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
  }
  if (range.from) return `From ${format(range.from, "MMM d, yyyy")}`;
  if (range.to) return `Until ${format(range.to, "MMM d, yyyy")}`;
  return "Selected period";
}
