import { addDays, eachDayOfInterval, format, parseISO, startOfDay, subDays } from "date-fns";

export const RESOURCE_DEFAULT_PAST_DAYS = 14;
export const RESOURCE_DEFAULT_FUTURE_DAYS = 15;

export const RESOURCE_CONTRIBUTION_PAST_DAYS = RESOURCE_DEFAULT_PAST_DAYS;
export const RESOURCE_CONTRIBUTION_FUTURE_DAYS = RESOURCE_DEFAULT_FUTURE_DAYS;
export const RESOURCE_CONTRIBUTION_DAYS =
  RESOURCE_CONTRIBUTION_PAST_DAYS + RESOURCE_CONTRIBUTION_FUTURE_DAYS + 1;

export function getDefaultResourceFilterDateRange(): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  return {
    from: subDays(today, RESOURCE_DEFAULT_PAST_DAYS),
    to: addDays(today, RESOURCE_DEFAULT_FUTURE_DAYS),
  };
}

export function getContributionDays(): Date[] {
  const today = startOfDay(new Date());
  return eachDayOfInterval({
    start: subDays(today, RESOURCE_CONTRIBUTION_PAST_DAYS),
    end: addDays(today, RESOURCE_CONTRIBUTION_FUTURE_DAYS),
  });
}

export function getContributionDateRange(): { from: string; to: string } {
  const days = getContributionDays();
  return {
    from: format(days[0], "yyyy-MM-dd"),
    to: format(days[days.length - 1], "yyyy-MM-dd"),
  };
}

/** All days in an inclusive ISO date range (for calendar / strip when filter is applied). */
export function getDaysInRange(from: string, to: string): Date[] {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));
  if (start > end) return [];
  return eachDayOfInterval({ start, end });
}

/** Widen a filter range so strip/calendar always have task data for ±15 days around today. */
export function mergeResourceDateRanges(
  filterRange: { from: string; to: string },
  contributionRange: { from: string; to: string } = getContributionDateRange(),
): { from: string; to: string } {
  return {
    from: filterRange.from < contributionRange.from ? filterRange.from : contributionRange.from,
    to: filterRange.to > contributionRange.to ? filterRange.to : contributionRange.to,
  };
}

export function contributionSpansMultipleMonths(days: Date[]): boolean {
  if (days.length < 2) return false;
  return format(days[0], "yyyy-MM") !== format(days[days.length - 1], "yyyy-MM");
}

/** Shared grid columns for resource user rows (md+). */
export const RESOURCE_USER_TABLE_GRID_CLASS =
  "grid w-full md:grid-cols-[2rem_2.5rem_11rem_minmax(0,1fr)_13rem] md:gap-x-3";

export const RESOURCE_USER_ROW_SUBGRID_CLASS = "col-span-full grid w-full grid-cols-subgrid items-center gap-x-3";

export const RESOURCE_USER_ROW_GRID_CLASS =
  "md:grid md:w-full md:grid-cols-[2rem_2.5rem_11rem_minmax(0,1fr)_13rem] md:items-center md:gap-x-3";
