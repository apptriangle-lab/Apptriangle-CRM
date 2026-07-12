import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export const CALENDAR_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarRow =
  | { type: "month"; label: string; monthKey: string }
  | { type: "week"; days: Date[] };

export function calendarDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function rangeSpansMultipleMonths(from: string, to: string): boolean {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));
  return format(start, "yyyy-MM") !== format(end, "yyyy-MM");
}

export function buildCalendarGridDays(rangeStart: Date, rangeEnd: Date): Date[] {
  const gridStart = startOfWeek(rangeStart);
  const gridEnd = endOfWeek(rangeEnd);
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function buildCalendarRows(
  days: Date[],
  rangeStart: Date,
  rangeEnd: Date,
  multiMonth: boolean,
): CalendarRow[] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  if (!multiMonth) {
    return weeks.map((week) => ({ type: "week" as const, days: week }));
  }

  const rows: CalendarRow[] = [];
  let currentMonthKey: string | null = null;

  weeks.forEach((week) => {
    const firstOfMonth = week.find((day) => day.getDate() === 1);
    const inRangeDays = week.filter((day) => isWithinInterval(day, { start: rangeStart, end: rangeEnd }));
    const anchorDay = firstOfMonth ?? inRangeDays[0] ?? week[0];
    const monthKey = format(anchorDay, "yyyy-MM");

    if (monthKey !== currentMonthKey) {
      rows.push({
        type: "month",
        label: format(anchorDay, "MMMM yyyy"),
        monthKey,
      });
      currentMonthKey = monthKey;
    }

    rows.push({ type: "week", days: week });
  });

  return rows;
}
