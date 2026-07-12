import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";

/** Fixed 7-column grid: title → due date → remaining → status → company → assign to → assign by */
export const CRM_TASKS_COL_GRID =
  "grid grid-cols-[minmax(240px,420px)_118px_92px_108px_minmax(180px,1.1fr)_minmax(168px,1fr)_minmax(168px,1fr)] items-center gap-x-4";

/** Minimum table width so column proportions stay consistent on smaller viewports. */
export const CRM_TASKS_TABLE_MIN_W = "min-w-[1100px]";

export const CRM_TASKS_LIST_HPAD = "px-5 sm:px-6";

/** Extra inset for the title column (header + rows). */
export const CRM_TASKS_TITLE_PL = "pl-2.5";

export type CrmTaskRemainingTone = "done" | "overdue" | "today" | "soon" | "normal";

export function formatCrmTaskDueDate(iso: string): string {
  try {
    const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
    if (!isValid(d)) return "—";
    const today = startOfDay(new Date());
    const due = startOfDay(d);
    const diff = differenceInCalendarDays(due, today);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return format(d, "MMM d");
  } catch {
    return "—";
  }
}

export function formatCrmTaskRemaining(
  dueDatetime: string,
  status: string,
  now = new Date(),
): { label: string; tone: CrmTaskRemainingTone } {
  const isDone = status === "completed" || status === "cancelled";
  if (isDone) return { label: "—", tone: "done" };

  const dueDate = new Date(dueDatetime);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d`, tone: "overdue" };
  if (diffDays === 0) return { label: "Today", tone: "today" };
  if (diffDays === 1) return { label: "Tomorrow", tone: "soon" };
  return { label: `${diffDays}d`, tone: "normal" };
}

export function isCrmTaskOverdue(dueDatetime: string, status: string, now = new Date()): boolean {
  if (status === "completed" || status === "cancelled") return false;
  return startOfDay(new Date(dueDatetime)) < startOfDay(now);
}

/** Red highlight for overdue tasks — title column only. */
export function crmTaskTitleOverdueClass(overdue: boolean): string {
  return overdue
    ? "relative bg-gradient-to-r from-rose-50/95 via-rose-50/50 to-transparent before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r-full before:bg-rose-400"
    : "";
}

export function crmTaskTitleClass(isDone: boolean, overdue: boolean): string {
  if (isDone) return "text-slate-500 line-through decoration-slate-300";
  if (overdue) return "text-rose-700";
  return "text-slate-800";
}

export function crmTaskDueDateClass(_overdue: boolean): string {
  return "text-slate-600";
}

export function crmTaskRemainingTextClass(tone: CrmTaskRemainingTone): string {
  switch (tone) {
    case "overdue":
      return "text-rose-700/90";
    case "today":
      return "text-amber-800/90";
    case "soon":
      return "text-slate-700";
    case "done":
      return "text-slate-400";
    default:
      return "text-slate-600";
  }
}

export function crmTaskRemainingPrefix(tone: CrmTaskRemainingTone): string | null {
  switch (tone) {
    case "overdue":
      return "Late";
    case "today":
      return "Due";
    case "soon":
    case "normal":
      return null;
    default:
      return null;
  }
}
