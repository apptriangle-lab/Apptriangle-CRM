import { format, isWeekend, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPmsTaskStatusLabel, type PmsResourceTaskDto } from "@/lib/pmsApi";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { buildTimelineDays, formatTaskDateRange, getTaskSpanDays } from "@/utils/pmsResourceDates";

type Props = {
  tasks: PmsResourceTaskDto[];
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  from: string;
  to: string;
  onTaskClick?: (taskId: string) => void;
};

function TaskChip({
  task,
  onClick,
}: {
  task: PmsResourceTaskDto;
  onClick?: () => void;
}) {
  const theme = pmsStatusTheme(task.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-950">{task.title}</p>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            theme.kanbanCardPill,
          )}
        >
          {formatPmsTaskStatusLabel(task.status)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>{formatTaskDateRange(task)}</span>
        {task.sprintName ? (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">
            {task.sprintName}
          </span>
        ) : (
          <span className="text-slate-400">Backlog</span>
        )}
      </div>
    </button>
  );
}

export function ResourceTaskCalendar({ tasks, tasksByDate, from, to, onTaskClick }: Props) {
  const timelineDays = buildTimelineDays(from, to);
  const rangeFrom = parseISO(from);
  const rangeTo = parseISO(to);

  const taskLanes = tasks.map((task) => ({
    task,
    days: getTaskSpanDays(task, rangeFrom, rangeTo),
  }));

  const datedKeys = Object.keys(tasksByDate)
    .filter((k) => k !== "unscheduled")
    .sort();

  return (
    <div className="space-y-5">
      {timelineDays.length > 0 && tasks.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Timeline</p>
          <div className="min-w-[640px]">
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(28px, 1fr))` }}
            >
              {timelineDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "px-0.5 pb-1 text-center text-[10px] font-semibold",
                    isWeekend(day) ? "text-slate-400" : "text-slate-600",
                  )}
                >
                  {format(day, "d")}
                  <div className="text-[9px] font-medium uppercase">{format(day, "EEE")}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {taskLanes.map(({ task, days }) => (
                <div key={task.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "140px 1fr" }}>
                  <p className="truncate text-xs font-medium text-slate-700" title={task.title}>
                    {task.title}
                  </p>
                  <div
                    className="relative grid h-7 gap-px"
                    style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(28px, 1fr))` }}
                  >
                    {timelineDays.map((day) => {
                      const active = days.some((d) => d.getTime() === day.getTime());
                      return (
                        <div
                          key={`${task.id}-${day.toISOString()}`}
                          className={cn(
                            "rounded-sm",
                            active ? "bg-indigo-400/80" : "bg-slate-200/50",
                            isWeekend(day) && !active && "bg-slate-100",
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {datedKeys.map((dateKey) => (
          <section key={dateKey}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {format(parseISO(dateKey), "EEEE, MMM d, yyyy")}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {tasksByDate[dateKey]?.map((task) => (
                <TaskChip key={`${dateKey}-${task.id}`} task={task} onClick={() => onTaskClick?.(task.id)} />
              ))}
            </div>
          </section>
        ))}

        {tasksByDate.unscheduled?.length ? (
          <section>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Unscheduled</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {tasksByDate.unscheduled.map((task) => (
                <TaskChip key={task.id} task={task} onClick={() => onTaskClick?.(task.id)} />
              ))}
            </div>
          </section>
        ) : null}

        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No tasks for this user in this project during the selected range.
          </p>
        ) : null}
      </div>
    </div>
  );
}
