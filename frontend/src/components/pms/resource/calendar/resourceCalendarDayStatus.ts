import { isAfter, isBefore, isToday, parseISO, startOfDay } from "date-fns";
import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import { getGithubDayColors } from "@/components/pms/resource/resourceGithubTheme";
import { summarizeDayTasksForDate } from "@/components/pms/resource/calendar/resourceTaskDayStatus";

export type PreviousDayHighlight = "all-complete" | "has-incomplete" | null;
export type FutureDayHighlight = "all-complete" | "has-incomplete" | null;
export type TodayDayHighlight = "ongoing" | "overdue" | null;
export type DateContext = "past" | "today" | "future";

export type DayCellColors = {
  bg: string;
  border: string;
  hover: string;
};

export const PREVIOUS_DAY_COMPLETE_COLORS: DayCellColors = {
  bg: "#22c55e",
  border: "#15803d",
  hover: "#16a34a",
};

export const PREVIOUS_DAY_INCOMPLETE_COLORS: DayCellColors = {
  bg: "#fecaca",
  border: "#f87171",
  hover: "#fca5a5",
};

/** Future day — all tasks completed early (gray). */
export const FUTURE_DAY_COMPLETE_COLORS: DayCellColors = {
  bg: "#9ca3af",
  border: "#4b5563",
  hover: "#6b7280",
};

/** Future day — at least one pending task (active green). */
export const FUTURE_DAY_ACTIVE_COLORS: DayCellColors = {
  bg: "#4ade80",
  border: "#16a34a",
  hover: "#22c55e",
};

export function summarizeDayTasks(
  tasks: PmsResourceTaskDto[],
  day: Date,
  today: Date = startOfDay(new Date()),
): PmsResourceDaySummary {
  return summarizeDayTasksForDate(tasks, day, today);
}

export function isPreviousDay(day: Date, today: Date = startOfDay(new Date())): boolean {
  return isBefore(startOfDay(day), today);
}

export function isFutureDay(day: Date, today: Date = startOfDay(new Date())): boolean {
  return isAfter(startOfDay(day), today);
}

export function getDateContext(day: Date, today: Date = startOfDay(new Date())): DateContext {
  if (isToday(day)) return "today";
  if (isPreviousDay(day, today)) return "past";
  if (isFutureDay(day, today)) return "future";
  return "today";
}

export function getPreviousDayHighlight(
  day: Date,
  summary: PmsResourceDaySummary | undefined,
): PreviousDayHighlight {
  if (!summary || summary.totalTasks === 0) return null;
  if (!isPreviousDay(day)) return null;
  return summary.incompleteTasks === 0 ? "all-complete" : "has-incomplete";
}

export function getFutureDayHighlight(
  day: Date,
  summary: PmsResourceDaySummary | undefined,
): FutureDayHighlight {
  if (!summary || summary.totalTasks === 0) return null;
  if (!isFutureDay(day)) return null;
  return summary.incompleteTasks === 0 ? "all-complete" : "has-incomplete";
}

export function getTodayDayHighlight(
  day: Date,
  summary: PmsResourceDaySummary | undefined,
): TodayDayHighlight {
  if (!summary || summary.totalTasks === 0) return null;
  if (!isToday(day)) return null;
  return summary.incompleteTasks > 0 ? "overdue" : "ongoing";
}

export function resolveDayCellColors(
  day: Date,
  summary: PmsResourceDaySummary | undefined,
  taskCount: number,
): DayCellColors {
  const previous = getPreviousDayHighlight(day, summary);
  if (previous === "all-complete") return PREVIOUS_DAY_COMPLETE_COLORS;
  if (previous === "has-incomplete") return PREVIOUS_DAY_INCOMPLETE_COLORS;

  const todayHighlight = getTodayDayHighlight(day, summary);
  if (todayHighlight === "overdue") return PREVIOUS_DAY_INCOMPLETE_COLORS;
  if (todayHighlight === "ongoing") return FUTURE_DAY_ACTIVE_COLORS;

  const future = getFutureDayHighlight(day, summary);
  if (future === "all-complete") return FUTURE_DAY_COMPLETE_COLORS;
  if (future === "has-incomplete") return FUTURE_DAY_ACTIVE_COLORS;

  const github = getGithubDayColors(taskCount);
  return { bg: github.bg, border: github.border, hover: github.hover };
}

/** @deprecated Use resolveDayCellColors */
export function getDayCellColors(highlight: PreviousDayHighlight, taskCount: number): DayCellColors {
  if (highlight === "all-complete") return PREVIOUS_DAY_COMPLETE_COLORS;
  if (highlight === "has-incomplete") return PREVIOUS_DAY_INCOMPLETE_COLORS;
  const github = getGithubDayColors(taskCount);
  return { bg: github.bg, border: github.border, hover: github.hover };
}

export function resolveDaySummary(
  dateKey: string,
  tasks: PmsResourceTaskDto[],
  summaries?: Record<string, PmsResourceDaySummary>,
): PmsResourceDaySummary | undefined {
  const day = startOfDay(parseISO(dateKey));
  if (tasks.length) return summarizeDayTasks(tasks, day);
  if (summaries?.[dateKey]?.totalTasks) return summaries[dateKey];
  return undefined;
}
