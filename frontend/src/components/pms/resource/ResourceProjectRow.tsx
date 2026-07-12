import { ChevronDown, FolderKanban } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn, formatStatusLabel } from "@/lib/utils";
import type { PmsResourceProjectDto } from "@/lib/pmsApi";
import { ResourceTaskCalendar } from "@/components/pms/resource/ResourceTaskCalendar";

const STATUS_BADGE: Record<string, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

type Props = {
  project: PmsResourceProjectDto;
  from: string;
  to: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onTaskClick?: (taskId: string) => void;
};

export function ResourceProjectRow({
  project,
  from,
  to,
  expanded,
  onExpandedChange,
  onTaskClick,
}: Props) {
  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange} className="border-b border-border/60 last:border-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 transition-transform",
              expanded && "rotate-0",
            )}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")}
            />
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FolderKanban className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-foreground">{project.projectTitle}</p>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  STATUS_BADGE[project.status] ?? "border-border bg-muted/40",
                )}
              >
                {formatStatusLabel(project.status)}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{project.projectCode}</p>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {project.taskCount} task{project.taskCount === 1 ? "" : "s"}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid transition-[grid-template-rows] duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="border-t border-border/40 bg-muted/10 px-4 py-4 sm:px-6">
            <ResourceTaskCalendar
              tasks={project.tasks}
              tasksByDate={project.tasksByDate}
              from={from}
              to={to}
              onTaskClick={onTaskClick}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
