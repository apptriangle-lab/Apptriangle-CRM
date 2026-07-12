import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import { getGithubDayColors, githubIntensityLevel } from "@/components/pms/resource/resourceGithubTheme";
import { CalendarDayTaskPreview } from "@/components/pms/resource/calendar/CalendarDayTaskPreview";
import {
  FUTURE_DAY_ACTIVE_COLORS,
  FUTURE_DAY_COMPLETE_COLORS,
  getDateContext,
  getFutureDayHighlight,
  getPreviousDayHighlight,
  getTodayDayHighlight,
  PREVIOUS_DAY_COMPLETE_COLORS,
  PREVIOUS_DAY_INCOMPLETE_COLORS,
  type FutureDayHighlight,
  type PreviousDayHighlight,
} from "@/components/pms/resource/calendar/resourceCalendarDayStatus";

type DayPalette = {
  style: { backgroundColor: string; borderColor: string };
  hoverStyle: { backgroundColor: string };
  dateText: string;
  taskText: string;
  moreText: string;
  badge: string;
  ring: string;
  onDarkBackground: boolean;
};

type Props = {
  day: Date;
  dateKey: string;
  inRange: boolean;
  tasks: PmsResourceTaskDto[];
  summary?: PmsResourceDaySummary;
  selected: boolean;
  multiMonth: boolean;
  onSelect: (dateKey: string) => void;
};

function githubDayPalette(taskCount: number): DayPalette {
  const level = githubIntensityLevel(taskCount);
  const colors = getGithubDayColors(taskCount);
  const hasTasks = taskCount > 0;
  const darkCell = level === "l3" || level === "l4";

  return {
    style: { backgroundColor: colors.bg, borderColor: colors.border },
    hoverStyle: { backgroundColor: colors.hover },
    dateText: hasTasks ? (darkCell ? "text-white" : "text-[#116329]") : "text-[#57606a]",
    taskText: darkCell ? "text-emerald-50" : "text-[#116329]",
    moreText: darkCell ? "text-emerald-100" : "text-[#1a7f37]",
    badge: darkCell ? "bg-[#116329] text-white" : "bg-[#1a7f37] text-white",
    ring: "ring-[#2da44e]",
    onDarkBackground: darkCell,
  };
}

function previousDayPalette(highlight: PreviousDayHighlight): DayPalette {
  const colors =
    highlight === "all-complete" ? PREVIOUS_DAY_COMPLETE_COLORS : PREVIOUS_DAY_INCOMPLETE_COLORS;
  const isPending = highlight === "has-incomplete";

  return {
    style: { backgroundColor: colors.bg, borderColor: colors.border },
    hoverStyle: { backgroundColor: colors.hover },
    dateText: isPending ? "text-[#991b1b]" : "text-white",
    taskText: isPending ? "text-[#b91c1c]" : "text-emerald-50",
    moreText: isPending ? "text-[#dc2626]" : "text-emerald-100",
    badge: isPending ? "bg-[#ef4444] text-white" : "bg-[#14532d] text-white",
    ring: isPending ? "ring-[#f87171]" : "ring-[#15803d]",
    onDarkBackground: !isPending,
  };
}

function futureDayPalette(highlight: FutureDayHighlight): DayPalette {
  if (highlight === "all-complete") {
    const colors = FUTURE_DAY_COMPLETE_COLORS;
    return {
      style: { backgroundColor: colors.bg, borderColor: colors.border },
      hoverStyle: { backgroundColor: colors.hover },
      dateText: "text-slate-800",
      taskText: "text-slate-700",
      moreText: "text-slate-600",
      badge: "bg-slate-600 text-white",
      ring: "ring-slate-500",
      onDarkBackground: false,
    };
  }

  const colors = FUTURE_DAY_ACTIVE_COLORS;
  return {
    style: { backgroundColor: colors.bg, borderColor: colors.border },
    hoverStyle: { backgroundColor: colors.hover },
    dateText: "text-[#14532d]",
    taskText: "text-[#166534]",
    moreText: "text-[#15803d]",
    badge: "bg-[#15803d] text-white",
    ring: "ring-[#16a34a]",
    onDarkBackground: false,
  };
}

function resolveDayPalette(day: Date, tasks: PmsResourceTaskDto[], summary?: PmsResourceDaySummary): DayPalette {
  const previousHighlight = getPreviousDayHighlight(day, summary);
  if (previousHighlight) return previousDayPalette(previousHighlight);

  const todayHighlight = getTodayDayHighlight(day, summary);
  if (todayHighlight === "overdue") return previousDayPalette("has-incomplete");
  if (todayHighlight === "ongoing") return futureDayPalette("has-incomplete");

  const futureHighlight = getFutureDayHighlight(day, summary);
  if (futureHighlight) return futureDayPalette(futureHighlight);

  return githubDayPalette(tasks.length);
}

export function CalendarDayBlock({
  day,
  dateKey,
  inRange,
  tasks,
  summary,
  selected,
  multiMonth,
  onSelect,
}: Props) {
  const hasTasks = tasks.length > 0;
  const today = isToday(day);
  const isFirstOfMonth = day.getDate() === 1;
  const dateContext = getDateContext(day);
  const palette = resolveDayPalette(day, tasks, summary);
  const isPrevious = dateContext === "past" && summary && summary.totalTasks > 0;
  const isFuture = dateContext === "future" && summary && summary.totalTasks > 0;
  const isTodayWithTasks = dateContext === "today" && summary && summary.totalTasks > 0;

  return (
    <button
      type="button"
      disabled={!inRange}
      onClick={() => inRange && onSelect(dateKey)}
      style={inRange ? palette.style : undefined}
      className={cn(
        "relative flex min-h-[88px] flex-col rounded-md border p-1.5 text-left transition-[background-color,border-color,box-shadow]",
        !inRange && "cursor-default border-transparent bg-transparent opacity-40",
        inRange && !hasTasks && "hover:brightness-[0.98]",
        inRange && hasTasks && "hover:brightness-105",
        selected && inRange && cn("ring-2 ring-offset-1", palette.ring),
        multiMonth && isFirstOfMonth && inRange && !isPrevious && !isFuture && "border-l-2 border-l-[#2da44e]",
      )}
      onMouseEnter={(e) => {
        if (!inRange) return;
        e.currentTarget.style.backgroundColor = palette.hoverStyle.backgroundColor;
      }}
      onMouseLeave={(e) => {
        if (!inRange) return;
        e.currentTarget.style.backgroundColor = palette.style.backgroundColor;
      }}
    >
      <span
        className={cn(
          "text-[11px] font-semibold",
          !inRange && "text-slate-300",
          inRange && !today && palette.dateText,
          today &&
            inRange &&
            "w-fit self-start rounded border border-[#cf222e] px-0.5 font-bold leading-none text-[#cf222e]",
          multiMonth && isFirstOfMonth && inRange && !today && "font-bold",
        )}
      >
        {multiMonth && isFirstOfMonth && inRange ? format(day, "MMM d") : format(day, "d")}
      </span>
      {hasTasks ? (
        <div className="mt-1 space-y-1">
          <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold", palette.badge)}>
            {isPrevious || isFuture || isTodayWithTasks
              ? `${summary!.completedTasks}/${summary!.totalTasks}`
              : tasks.length}
          </span>
          {isPrevious && summary ? (
            <p className={cn("text-[9px] font-medium leading-tight", palette.taskText)}>
              {summary.incompleteTasks === 0 ? "All done" : `${summary.incompleteTasks} overdue`}
            </p>
          ) : null}
          {isTodayWithTasks && summary ? (
            <p className={cn("text-[9px] font-medium leading-tight", palette.taskText)}>
              {summary.incompleteTasks === 0 ? "On track" : `${summary.incompleteTasks} overdue`}
            </p>
          ) : null}
          {isFuture && summary ? (
            <p className={cn("text-[9px] font-medium leading-tight", palette.taskText)}>
              {summary.incompleteTasks === 0 ? "All done" : `${summary.incompleteTasks} upcoming`}
            </p>
          ) : null}
          {isFuture
            ? tasks.slice(0, 2).map((task) => (
                <CalendarDayTaskPreview
                  key={task.id}
                  task={task}
                  day={day}
                  onDarkBackground={palette.onDarkBackground}
                />
              ))
            : null}
          {!isFuture
            ? tasks.slice(0, 2).map((task) => (
                <CalendarDayTaskPreview
                  key={task.id}
                  task={task}
                  day={day}
                  compact
                  onDarkBackground={palette.onDarkBackground}
                />
              ))
            : null}
          {tasks.length > 2 ? (
            <p className={cn("text-[9px] font-medium", palette.moreText)}>+{tasks.length - 2} more</p>
          ) : null}
        </div>
      ) : inRange ? (
        <span className="mt-auto text-[9px] text-[#8b949e]">—</span>
      ) : null}
    </button>
  );
}
