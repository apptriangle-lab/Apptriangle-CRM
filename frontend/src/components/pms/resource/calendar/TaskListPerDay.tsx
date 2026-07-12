import { format, parseISO, startOfDay } from "date-fns";
import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import { TaskItem } from "@/components/pms/resource/calendar/TaskItem";
import { getDateContext } from "@/components/pms/resource/calendar/resourceCalendarDayStatus";

type Props = {
  dateKey: string;
  tasks: PmsResourceTaskDto[];
  summary?: PmsResourceDaySummary;
  onTaskClick?: (taskId: string) => void;
};

export function TaskListPerDay({ dateKey, tasks, summary, onTaskClick }: Props) {
  if (!tasks.length) return null;

  const dateContext = getDateContext(startOfDay(parseISO(dateKey)));

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#57606a]">
          {format(parseISO(dateKey), "EEEE, MMM d, yyyy")}
        </h4>
        {summary ? (
          <p className="text-[11px] font-medium text-[#57606a]">
            {summary.totalTasks} total · {summary.completedTasks} done · {summary.incompleteTasks} pending
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            day={startOfDay(parseISO(dateKey))}
            dateContext={dateContext}
            onClick={() => onTaskClick?.(task.id)}
          />
        ))}
      </div>
    </section>
  );
}
