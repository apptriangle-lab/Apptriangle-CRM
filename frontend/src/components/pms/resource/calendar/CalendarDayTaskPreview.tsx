import { cn } from "@/lib/utils";
import type { PmsResourceTaskDto } from "@/lib/pmsApi";
import { TaskStatusIndicator } from "@/components/pms/resource/calendar/TaskStatusIndicator";
import {
  getTaskDayVisualStatus,
  isTaskDayCompleteForSummary,
} from "@/components/pms/resource/calendar/resourceTaskDayStatus";
import { getDateContext } from "@/components/pms/resource/calendar/resourceCalendarDayStatus";

type Props = {
  task: PmsResourceTaskDto;
  day: Date;
  compact?: boolean;
  onDarkBackground?: boolean;
};

export function CalendarDayTaskPreview({ task, day, compact = false, onDarkBackground }: Props) {
  const visualStatus = getTaskDayVisualStatus(task, day);
  const dateContext = getDateContext(day);
  const showCompletedStyle = visualStatus === "future-complete";
  const showOverdueStyle = visualStatus === "overdue";
  const dayComplete = isTaskDayCompleteForSummary(task, day, dateContext);
  const description = task.description?.trim();

  return (
    <div className="space-y-0.5">
      <div className="flex items-start gap-1">
        <p
          className={cn(
            compact ? "truncate text-[9px] font-medium leading-tight" : "min-w-0 flex-1 truncate text-[9px] font-semibold leading-tight",
            showCompletedStyle && "text-slate-400 line-through",
            showOverdueStyle && !onDarkBackground && "text-[#991b1b]",
            showOverdueStyle && onDarkBackground && "text-red-100",
            !showCompletedStyle && !showOverdueStyle && onDarkBackground && "text-white",
            !showCompletedStyle && !showOverdueStyle && !onDarkBackground && "text-[#116329]",
          )}
          title={task.title}
        >
          {task.title}
        </p>
        {!compact && dateContext === "future" ? (
          <TaskStatusIndicator completed={dayComplete} compact />
        ) : null}
      </div>
      {!compact && description ? (
        <p
          className={cn(
            "line-clamp-2 text-[8px] leading-tight",
            showCompletedStyle && "text-slate-400 line-through",
            showOverdueStyle && !onDarkBackground && "text-[#b91c1c]",
            showOverdueStyle && onDarkBackground && "text-red-100/90",
            !showCompletedStyle && !showOverdueStyle && onDarkBackground && "text-emerald-50",
            !showCompletedStyle && !showOverdueStyle && !onDarkBackground && "text-[#1a7f37]",
          )}
          title={description}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
