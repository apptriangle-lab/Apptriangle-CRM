import { Building2, ChevronDown, ChevronRight, FolderKanban, GitBranch } from "lucide-react";
import type { PmsTaskDto } from "@/lib/pmsApi";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";
import {
  crmTaskTitleClass,
  crmTaskTitleOverdueClass,
  CRM_TASKS_TITLE_PL,
} from "@/components/tasks/crmTasksListStyles";
import {
  formatPmsTaskDateRange,
  pmsTaskDateTextClass,
} from "@/components/pms/pmsTaskListStyles";
import { PmsHubTasksAssigneesCell } from "@/components/pms/hub-tasks/PmsHubTasksAssigneesCell";
import { PMS_HUB_TASKS_COL_GRID } from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import { PmsHubTaskStatusCell } from "@/components/pms/hub-tasks/PmsHubTaskStatusCell";
import { PmsHubTasksRemainingCell } from "@/components/pms/hub-tasks/PmsHubTasksRemainingCell";
import {
  formatPmsHubTaskRemaining,
  getPmsHubTaskAssignees,
  isPmsHubTaskDone,
  isPmsHubTaskOverdue,
} from "@/components/pms/hub-tasks/pmsHubTasksListUtils";

type Props = {
  task: PmsTaskDto;
  hasChildren: boolean;
  expanded: boolean;
  subTaskCount?: number;
  companyName: string;
  projectName: string;
  assignByName: string;
  getUserEmail?: (userId: string) => string | undefined;
  statuses: string[];
  canChangeStatus: boolean;
  onToggleExpand: () => void;
  onStatusChange: (status: string) => void | Promise<void>;
  onClick: () => void;
  now?: Date;
};

export function PmsHubTasksListRow({
  task,
  hasChildren,
  expanded,
  subTaskCount = 0,
  companyName,
  projectName,
  assignByName,
  getUserEmail,
  statuses,
  canChangeStatus,
  onToggleExpand,
  onStatusChange,
  onClick,
  now = new Date(),
}: Props) {
  const overdue = isPmsHubTaskOverdue(task, now);
  const remaining = formatPmsHubTaskRemaining(task, now);
  const isDone = isPmsHubTaskDone(task.status);
  const assignees = getPmsHubTaskAssignees(task);

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        PMS_HUB_TASKS_COL_GRID,
        "group cursor-pointer border-b border-slate-100 py-2.5 text-[13px] transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1 self-stretch -my-2.5 py-2.5 pr-2",
          CRM_TASKS_TITLE_PL,
          crmTaskTitleOverdueClass(overdue),
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden />
        )}
        <span className={cn("min-w-0 truncate font-medium", crmTaskTitleClass(isDone, overdue))}>
          {task.title}
        </span>
        {subTaskCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] text-slate-400">
            <GitBranch className="h-3 w-3" />
            {subTaskCount}
          </span>
        ) : null}
      </div>

      <span
        className={cn("min-w-0 truncate text-xs tabular-nums", pmsTaskDateTextClass(task))}
        title={formatPmsTaskDateRange(task)}
      >
        {formatPmsTaskDateRange(task)}
      </span>

      <PmsHubTasksRemainingCell tone={remaining.tone} label={remaining.label} />

      <PmsHubTaskStatusCell
        status={task.status}
        statuses={statuses}
        canChange={canChangeStatus}
        onStatusChange={onStatusChange}
      />

      <div className="flex min-w-0 items-center gap-1.5 text-slate-700">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{companyName}</span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-slate-700">
        <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{projectName}</span>
      </div>

      <div className="flex min-w-0 items-center">
        <PmsHubTasksAssigneesCell assignees={assignees} getUserEmail={getUserEmail} />
      </div>

      <div className="flex min-w-0 items-center">
        {assignByName !== "—" ? (
          <PmsMemberAvatar
            name={assignByName}
            userId={task.assignedBy ?? task.createdBy}
            size="xs"
          />
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}
