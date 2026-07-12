import { startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPmsTaskStatusLabel, type PmsResourceTaskDto } from "@/lib/pmsApi";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { TaskStatusIndicator } from "@/components/pms/resource/calendar/TaskStatusIndicator";
import type { DateContext } from "@/components/pms/resource/calendar/resourceCalendarDayStatus";
import {
  getTaskDayLabel,
  getTaskDayVisualStatus,
  isTaskDayCompleteForSummary,
} from "@/components/pms/resource/calendar/resourceTaskDayStatus";
import { formatTaskDateRange } from "@/utils/pmsResourceDates";
import { isTaskCompleted } from "@/utils/pmsTaskTree";

type Props = {
  task: PmsResourceTaskDto;
  day?: Date;
  dateContext?: DateContext;
  onClick?: () => void;
};

export function TaskItem({ task, day, dateContext = "today", onClick }: Props) {
  const theme = pmsStatusTheme(task.status);
  const effectiveDay = day ?? startOfDay(new Date());
  const visualStatus = day ? getTaskDayVisualStatus(task, effectiveDay) : null;
  const dayComplete = day
    ? isTaskDayCompleteForSummary(task, effectiveDay, dateContext)
    : isTaskCompleted(task);
  const showCompletedStyle = day
    ? visualStatus === "future-complete"
    : isTaskCompleted(task);
  const showOverdueStyle = visualStatus === "overdue";
  const isFuture = dateContext === "future";
  const dayLabel = getTaskDayLabel(visualStatus);
  const description = task.description?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors",
        showCompletedStyle
          ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
          : showOverdueStyle
            ? "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-50"
            : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-semibold",
              showCompletedStyle && "text-slate-400 line-through",
              showOverdueStyle && "text-red-800",
              !showCompletedStyle && !showOverdueStyle && "text-slate-900 group-hover:text-[#116329]",
            )}
          >
            {task.title}
          </p>
          {description ? (
            <p
              className={cn(
                "mt-1 line-clamp-3 text-xs leading-relaxed",
                showCompletedStyle && "text-slate-400 line-through",
                showOverdueStyle && "text-red-700/90",
                !showCompletedStyle && !showOverdueStyle && "text-slate-600",
              )}
            >
              {description}
            </p>
          ) : null}
          {task.projectTitle ? (
            <p
              className={cn(
                "mt-1 truncate text-[11px] font-medium",
                showCompletedStyle && "text-slate-400",
                showOverdueStyle && "text-red-600/80",
                !showCompletedStyle && !showOverdueStyle && "text-slate-500",
              )}
            >
              {task.projectTitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isFuture ? <TaskStatusIndicator completed={dayComplete} /> : null}
          {dayLabel ? (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                showCompletedStyle && "border-slate-200 bg-slate-200 text-slate-500",
                showOverdueStyle && "border-red-200 bg-red-100 text-red-700",
                !showCompletedStyle && !showOverdueStyle && theme.kanbanCardPill,
              )}
            >
              {dayLabel}
            </span>
          ) : (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                showCompletedStyle ? "border-slate-200 bg-slate-200 text-slate-500" : theme.kanbanCardPill,
              )}
            >
              {formatPmsTaskStatusLabel(task.status)}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
          showCompletedStyle && "text-slate-400",
          showOverdueStyle && "text-red-700/90",
          !showCompletedStyle && !showOverdueStyle && "text-slate-600",
        )}
      >
        <span className={showCompletedStyle ? "line-through" : undefined}>{formatTaskDateRange(task)}</span>
        {task.sprintName ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-medium",
              showCompletedStyle && "bg-slate-200 text-slate-500",
              showOverdueStyle && "bg-red-100 text-red-700",
              !showCompletedStyle && !showOverdueStyle && "bg-emerald-50 text-[#1a7f37]",
            )}
          >
            {task.sprintName}
          </span>
        ) : (
          <span className="text-slate-400">Backlog</span>
        )}
      </div>
    </button>
  );
}
