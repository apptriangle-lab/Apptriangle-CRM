import { useState } from "react";
import { format, isToday } from "date-fns";
import { CalendarDays, ChevronDown, CircleDashed } from "lucide-react";
import type { PmsTaskDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import { PmsKanbanTaskCard } from "@/components/pms/PmsKanbanTaskCard";

type Props = {
  selectedDay: Date;
  tasks: PmsTaskDto[];
  unscheduled: PmsTaskDto[];
  onOpenTask: (id: string) => void;
  className?: string;
};

export function PmsCalendarSelectedDayPanel({
  selectedDay,
  tasks,
  unscheduled,
  onOpenTask,
  className,
}: Props) {
  const today = isToday(selectedDay);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-l border-slate-200/90 bg-[#f4f5f7]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Selected day
            </p>
            <h3 className="truncate text-[14px] font-bold leading-tight text-slate-900">
              {format(selectedDay, "EEEE")}
            </h3>
            <p className="truncate text-[11px] font-medium text-slate-500">
              {format(selectedDay, "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
              {tasks.length}
            </span>
            {today && (
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 ring-1 ring-blue-100">
                Today
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center">
            <CalendarDays className="mb-2 h-8 w-8 text-slate-300" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-slate-600">No tasks scheduled</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-400">
              Pick another day or add dates to tasks in the project.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tasks.map((task) => (
              <PmsKanbanTaskCard key={task.id} task={task} onClick={() => onOpenTask(task.id)} />
            ))}
          </div>
        )}
      </div>

      {unscheduled.length > 0 && (
        <div className="shrink-0 border-t-2 border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-violet-50/80 to-cyan-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <button
            type="button"
            onClick={() => setUnscheduledOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors",
              unscheduledOpen
                ? "bg-indigo-100/40"
                : "hover:bg-indigo-100/50",
            )}
            aria-expanded={unscheduledOpen}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm shadow-indigo-500/25">
              <CircleDashed className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-700">
                Unscheduled
              </p>
              <p className="text-[11px] font-medium text-indigo-500/90">
                Tasks without dates
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm">
              {unscheduled.length}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-indigo-400 transition-transform duration-200",
                unscheduledOpen && "rotate-180",
              )}
              strokeWidth={2.25}
            />
          </button>
          {unscheduledOpen && (
            <div className="max-h-[min(40vh,280px)] overflow-y-auto border-t border-indigo-200/60 bg-white/50 px-3 pb-3 pt-2 backdrop-blur-[2px] scrollbar-thin">
              <div className="flex flex-col gap-2">
                {unscheduled.map((task) => (
                  <PmsKanbanTaskCard key={task.id} task={task} onClick={() => onOpenTask(task.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
