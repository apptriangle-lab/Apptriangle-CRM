import { isAfter, isBefore, startOfDay } from "date-fns";
import type { PmsResourceTaskDto } from "@/lib/pmsApi";
import { getPmsTaskDateSpan } from "@/lib/pmsTaskDates";
import { isTaskCompleted } from "@/utils/pmsTaskTree";
import { getDateContext, type DateContext } from "@/components/pms/resource/calendar/resourceCalendarDayStatus";

/** Per-day visual state for a task on a specific calendar day. */
export type TaskDayVisualStatus = "ongoing" | "overdue" | "complete" | "future-complete";

export function isTaskOnDay(
  task: Pick<PmsResourceTaskDto, "startDate" | "endDate">,
  day: Date,
): boolean {
  const { start, end } = getPmsTaskDateSpan(task);
  if (!start || !end) return false;
  const d = startOfDay(day);
  return !isBefore(d, startOfDay(start)) && !isAfter(d, startOfDay(end));
}

/** Task deadline has passed without completion (end_date < today). */
export function isTaskOverdue(
  task: PmsResourceTaskDto,
  today: Date = startOfDay(new Date()),
): boolean {
  if (isTaskCompleted(task)) return false;
  const { end } = getPmsTaskDateSpan(task);
  if (!end) return false;
  return isBefore(startOfDay(end), today);
}

/**
 * Day-by-day status for resource calendar coloring.
 *
 * Incomplete + today ≤ end_date → ongoing (GREEN on every span day)
 * Incomplete + end_date < today  → overdue (RED on every span day)
 * Completed + day > today        → future-complete (GRAY + strikethrough)
 * Completed + day ≤ today        → complete (GREEN)
 */
export function getTaskDayVisualStatus(
  task: PmsResourceTaskDto,
  day: Date,
  today: Date = startOfDay(new Date()),
): TaskDayVisualStatus | null {
  if (!isTaskOnDay(task, day)) return null;

  const d = startOfDay(day);

  if (isTaskCompleted(task)) {
    return isAfter(d, today) ? "future-complete" : "complete";
  }

  return isTaskOverdue(task, today) ? "overdue" : "ongoing";
}

export function isTaskIncompleteOnDay(task: PmsResourceTaskDto, day: Date, today?: Date): boolean {
  return getTaskDayVisualStatus(task, day, today) === "overdue";
}

export function isTaskPendingOnFutureDay(task: PmsResourceTaskDto, day: Date, today?: Date): boolean {
  return getTaskDayVisualStatus(task, day, today) === "ongoing";
}

export function isTaskFutureCompleteOnDay(task: PmsResourceTaskDto, day: Date, today?: Date): boolean {
  return getTaskDayVisualStatus(task, day, today) === "future-complete";
}

export function isTaskDayCompleteForSummary(
  task: PmsResourceTaskDto,
  day: Date,
  dateContext: DateContext,
  today?: Date,
): boolean {
  const status = getTaskDayVisualStatus(task, day, today);
  if (!status) return true;
  if (dateContext === "future") return status === "future-complete" || status === "complete";
  return status !== "overdue";
}

export function getTaskDayLabel(status: TaskDayVisualStatus | null): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "ongoing":
      return "In progress";
    case "complete":
      return "Completed";
    case "future-complete":
      return "Done early";
    default:
      return "";
  }
}

export function summarizeDayTasksForDate(
  tasks: PmsResourceTaskDto[],
  day: Date,
  today: Date = startOfDay(new Date()),
): { totalTasks: number; completedTasks: number; incompleteTasks: number } {
  const dateContext = getDateContext(day, today);
  let incompleteTasks = 0;

  for (const task of tasks) {
    const status = getTaskDayVisualStatus(task, day, today);
    if (!status) continue;

    if (dateContext === "future") {
      if (status === "ongoing") incompleteTasks += 1;
    } else if (status === "overdue") {
      incompleteTasks += 1;
    }
  }

  const totalTasks = tasks.length;
  return {
    totalTasks,
    completedTasks: totalTasks - incompleteTasks,
    incompleteTasks,
  };
}
