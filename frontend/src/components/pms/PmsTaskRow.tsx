import { formatPmsTaskStatusLabel, type PmsTaskDto } from "@/lib/pmsApi";
import { formatPmsTaskDateRange, pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { cn } from "@/lib/utils";

type PmsTaskRowProps = {
  task: PmsTaskDto;
  onClick?: () => void;
  showProject?: boolean;
};

export function PmsTaskRow({ task, onClick, showProject }: PmsTaskRowProps) {
  const theme = pmsStatusTheme(task.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-left text-sm transition-colors",
        onClick && "hover:border-primary/25 hover:bg-muted/50 cursor-pointer",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate text-foreground">{task.title}</p>
        {showProject && task.projectTitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.projectTitle}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {task.startDate || task.endDate ? formatPmsTaskDateRange(task) : null}
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            theme.pill,
          )}
        >
          {formatPmsTaskStatusLabel(task.status)}
        </span>
      </div>
    </button>
  );
}
