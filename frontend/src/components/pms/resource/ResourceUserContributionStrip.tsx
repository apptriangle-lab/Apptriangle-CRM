import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import {
  getFutureDayHighlight,
  getPreviousDayHighlight,
  resolveDayCellColors,
  resolveDaySummary,
} from "@/components/pms/resource/calendar/resourceCalendarDayStatus";
import {
  contributionSpansMultipleMonths,
  getContributionDays,
  RESOURCE_CONTRIBUTION_DAYS,
  RESOURCE_DEFAULT_FUTURE_DAYS,
  RESOURCE_DEFAULT_PAST_DAYS,
} from "@/components/pms/resource/resourceContributionDays";

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

type Props = {
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  tasksByDateSummary?: Record<string, PmsResourceDaySummary>;
};

/** Fixed ±14/15 day preview — does not follow the date range filter. */
export function ResourceUserContributionStrip({ tasksByDate, tasksByDateSummary }: Props) {
  const days = useMemo(() => getContributionDays(), []);
  const spansMultipleMonths = useMemo(() => contributionSpansMultipleMonths(days), [days]);

  return (
    <div
      className="hidden min-w-0 w-full md:grid md:gap-1"
      aria-label={`${RESOURCE_DEFAULT_PAST_DAYS} days past and ${RESOURCE_DEFAULT_FUTURE_DAYS} days future task activity`}
      style={{ gridTemplateColumns: `repeat(${RESOURCE_CONTRIBUTION_DAYS}, minmax(0, 1fr))` }}
    >
      {days.map((day, index) => {
        const key = dateKey(day);
        const dayTasks = tasksByDate[key] ?? [];
        const summary = resolveDaySummary(key, dayTasks, tasksByDateSummary);
        const previousHighlight = getPreviousDayHighlight(day, summary);
        const futureHighlight = getFutureDayHighlight(day, summary);
        const colors = resolveDayCellColors(day, summary, dayTasks.length);

        const tooltip =
          summary && summary.totalTasks > 0
            ? previousHighlight || futureHighlight
              ? `${format(day, "MMM d")} · ${summary.completedTasks}/${summary.totalTasks} done${
                  summary.incompleteTasks > 0 ? ` · ${summary.incompleteTasks} pending` : ""
                }`
              : `${format(day, "MMM d")} · ${summary.totalTasks} task${summary.totalTasks === 1 ? "" : "s"}`
            : `${format(day, "MMM d")} · No tasks`;
        const today = isToday(day);
        const isMonthStart = day.getDate() === 1;
        const showMonthDivider = spansMultipleMonths && isMonthStart && index > 0;

        return (
          <div
            key={key}
            className={cn(
              "flex min-w-0 flex-col items-stretch justify-end gap-0.5",
              showMonthDivider && "border-l border-slate-300/90 pl-1",
            )}
          >
            {showMonthDivider ? (
              <span
                className="w-full truncate text-center text-[7px] font-bold uppercase leading-none tracking-wide text-[#57606a]"
                title={format(day, "MMMM yyyy")}
              >
                {format(day, "MMM")}
              </span>
            ) : (
              <span className="h-[7px]" aria-hidden />
            )}
            <div
              className={cn(
                "flex min-w-0 flex-col items-stretch gap-0.5",
                today && "rounded-[4px] border-[1.5px] border-dashed border-[#cf222e]/55 px-1.5 py-1",
              )}
            >
              <span
                className={cn(
                  "w-full truncate text-center text-[8px] font-semibold leading-none text-[#8b949e]",
                  today && "font-bold text-[#cf222e]",
                )}
                title={format(day, "EEEE, MMM d, yyyy")}
              >
                {format(day, "d")}
              </span>
              <span
                title={tooltip}
                className="h-3 w-full min-w-0 rounded-sm border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
