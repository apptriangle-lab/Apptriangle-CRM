import { useEffect, useMemo, useState } from "react";
import { isWithinInterval, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import { formatResourceRangeMonthLabel } from "@/utils/pmsResourceDates";
import { CalendarDayBlock } from "@/components/pms/resource/calendar/CalendarDayBlock";
import { TaskListPerDay } from "@/components/pms/resource/calendar/TaskListPerDay";
import { TaskItem } from "@/components/pms/resource/calendar/TaskItem";
import {
  FUTURE_DAY_ACTIVE_COLORS,
  FUTURE_DAY_COMPLETE_COLORS,
  PREVIOUS_DAY_COMPLETE_COLORS,
  PREVIOUS_DAY_INCOMPLETE_COLORS,
  resolveDaySummary,
} from "@/components/pms/resource/calendar/resourceCalendarDayStatus";
import {
  buildCalendarGridDays,
  buildCalendarRows,
  CALENDAR_WEEKDAY_LABELS,
  calendarDateKey,
  rangeSpansMultipleMonths,
} from "@/components/pms/resource/calendar/resourceCalendarGrid";

type Props = {
  from: string;
  to: string;
  tasks: PmsResourceTaskDto[];
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  tasksByDateSummary?: Record<string, PmsResourceDaySummary>;
  onTaskClick?: (taskId: string) => void;
};

export function CalendarView({ from, to, tasks, tasksByDate, tasksByDateSummary, onTaskClick }: Props) {
  const rangeStart = startOfDay(parseISO(from));
  const rangeEnd = startOfDay(parseISO(to));

  const calendarDays = useMemo(
    () => buildCalendarGridDays(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const multiMonth = useMemo(() => rangeSpansMultipleMonths(from, to), [from, to]);

  const calendarRows = useMemo(
    () => buildCalendarRows(calendarDays, rangeStart, rangeEnd, multiMonth),
    [calendarDays, rangeStart, rangeEnd, multiMonth],
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [from, to]);

  const firstDayWithTasks = useMemo(() => {
    const keys = Object.keys(tasksByDate)
      .filter((k) => k !== "unscheduled")
      .filter((k) => {
        const day = startOfDay(parseISO(k));
        return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
      })
      .sort();
    return keys[0] ?? null;
  }, [tasksByDate, rangeStart, rangeEnd]);

  const activeDay = selectedDay ?? firstDayWithTasks;
  const activeTasks = activeDay ? (tasksByDate[activeDay] ?? []) : [];
  const activeSummary = activeDay
    ? resolveDaySummary(activeDay, activeTasks, tasksByDateSummary)
    : undefined;
  const monthLabel = formatResourceRangeMonthLabel(from, to);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-[#d0d7de] bg-[#f6f8fa] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#57606a]">Calendar</p>
            {monthLabel ? (
              <p className="text-xs font-semibold text-[#24292f]">
                {monthLabel} · {from} → {to}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#57606a]">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded border border-[#d0d7de] bg-[#ebedf0]" /> No tasks
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-3 w-3 rounded border"
                style={{
                  backgroundColor: PREVIOUS_DAY_COMPLETE_COLORS.bg,
                  borderColor: PREVIOUS_DAY_COMPLETE_COLORS.border,
                }}
              />{" "}
              Past · all done
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-3 w-3 rounded border"
                style={{
                  backgroundColor: PREVIOUS_DAY_INCOMPLETE_COLORS.bg,
                  borderColor: PREVIOUS_DAY_INCOMPLETE_COLORS.border,
                }}
              />{" "}
              Past · pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-3 w-3 rounded border"
                style={{
                  backgroundColor: FUTURE_DAY_ACTIVE_COLORS.bg,
                  borderColor: FUTURE_DAY_ACTIVE_COLORS.border,
                }}
              />{" "}
              Future · upcoming
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-3 w-3 rounded border"
                style={{
                  backgroundColor: FUTURE_DAY_COMPLETE_COLORS.bg,
                  borderColor: FUTURE_DAY_COMPLETE_COLORS.border,
                }}
              />{" "}
              Future · all done
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded border border-[#4ac26b] bg-[#9be9a8]" /> Today
            </span>
          </div>
        </div>

        <div className="min-w-[560px]">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {CALENDAR_WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#8b949e]"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {calendarRows.map((row, rowIndex) => {
              if (row.type === "month") {
                return (
                  <div
                    key={`month-${row.monthKey}-${rowIndex}`}
                    className={cn(
                      "flex items-center gap-3",
                      rowIndex > 0 ? "mt-4 border-t border-[#d0d7de] pt-3" : "pb-0.5",
                    )}
                  >
                    <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-[#24292f]">
                      {row.label}
                    </span>
                    <div className="h-px flex-1 bg-[#d0d7de]" />
                  </div>
                );
              }

              return (
                <div key={`week-${rowIndex}`} className="grid grid-cols-7 gap-1">
                  {row.days.map((day) => {
                    const key = calendarDateKey(day);
                    const inRange = isWithinInterval(day, { start: rangeStart, end: rangeEnd });
                    const dayTasks = inRange ? (tasksByDate[key] ?? []) : [];
                    const summary = resolveDaySummary(key, dayTasks, tasksByDateSummary);

                    return (
                      <CalendarDayBlock
                        key={key}
                        day={day}
                        dateKey={key}
                        inRange={inRange}
                        tasks={dayTasks}
                        summary={summary}
                        selected={activeDay === key}
                        multiMonth={multiMonth}
                        onSelect={setSelectedDay}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeDay && activeTasks.length ? (
        <TaskListPerDay
          dateKey={activeDay}
          tasks={activeTasks}
          summary={activeSummary}
          onTaskClick={onTaskClick}
        />
      ) : null}

      {tasksByDate.unscheduled?.length ? (
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#57606a]">Unscheduled</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {tasksByDate.unscheduled.map((task) => (
              <TaskItem key={task.id} task={task} onClick={() => onTaskClick?.(task.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No tasks in this date range. Calendar days stay gray.
        </p>
      ) : null}
    </div>
  );
}
