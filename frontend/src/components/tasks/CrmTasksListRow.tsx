import { Building2, Clock, Hourglass } from "lucide-react";
import type { Task } from "@/data/mockData";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";
import {
  CRM_TASKS_COL_GRID,
  crmTaskDueDateClass,
  crmTaskRemainingPrefix,
  crmTaskRemainingTextClass,
  crmTaskTitleClass,
  crmTaskTitleOverdueClass,
  CRM_TASKS_TITLE_PL,
  formatCrmTaskDueDate,
  formatCrmTaskRemaining,
  isCrmTaskOverdue,
  type CrmTaskRemainingTone,
} from "@/components/tasks/crmTasksListStyles";
import { CrmTaskStatusCell } from "@/components/tasks/CrmTaskStatusCell";

function CrmTaskRemainingCell({ tone, label }: { tone: CrmTaskRemainingTone; label: string }) {
  if (tone === "done") {
    return <span className="text-slate-400">—</span>;
  }

  const prefix = crmTaskRemainingPrefix(tone);
  const textClass = crmTaskRemainingTextClass(tone);

  if (tone === "overdue") {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", textClass)}>
        <Clock className="h-3.5 w-3.5 shrink-0 text-rose-400/90" aria-hidden />
        <span className="truncate">
          <span className="text-rose-600/80">{prefix}</span>
          <span className="mx-1 text-rose-300">·</span>
          <span>{label}</span>
        </span>
      </span>
    );
  }

  if (tone === "today") {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", textClass)}>
        <Hourglass className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 tabular-nums", textClass)}>
      <span className="truncate">{label}</span>
      {tone === "normal" ? <span className="shrink-0 text-slate-400">left</span> : null}
    </span>
  );
}

type Props = {
  task: Task;
  companyName: string;
  assignToName: string;
  assignByName: string;
  statuses: string[];
  canChangeStatus: boolean;
  onStatusChange: (status: string) => void | Promise<void>;
  onClick: () => void;
  now?: Date;
};

export function CrmTasksListRow({
  task,
  companyName,
  assignToName,
  assignByName,
  statuses,
  canChangeStatus,
  onStatusChange,
  onClick,
  now = new Date(),
}: Props) {
  const overdue = isCrmTaskOverdue(task.dueDatetime, task.status, now);
  const remaining = formatCrmTaskRemaining(task.dueDatetime, task.status, now);
  const isDone = task.status === "completed" || task.status === "cancelled";

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
        CRM_TASKS_COL_GRID,
        "group cursor-pointer border-b border-slate-100 py-2.5 text-[13px] transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center self-stretch -my-2.5 py-2.5 pr-2",
          CRM_TASKS_TITLE_PL,
          crmTaskTitleOverdueClass(overdue),
        )}
      >
        <span className={cn("min-w-0 truncate font-medium", crmTaskTitleClass(isDone, overdue))}>
          {task.title}
        </span>
      </div>

      <span className={cn("truncate tabular-nums", crmTaskDueDateClass(overdue))}>
        {formatCrmTaskDueDate(task.dueDatetime)}
      </span>

      <CrmTaskRemainingCell tone={remaining.tone} label={remaining.label} />

      <CrmTaskStatusCell
        status={task.status}
        statuses={statuses}
        canChange={canChangeStatus}
        onStatusChange={onStatusChange}
      />

      <div className="flex min-w-0 items-center gap-1.5 text-slate-700">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{companyName}</span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <PmsMemberAvatar name={assignToName} userId={task.assignToUserId} size="xs" />
        <span className="truncate text-slate-700">{assignToName}</span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <PmsMemberAvatar name={assignByName} userId={task.assignByUserId} size="xs" />
        <span className="truncate text-slate-700">{assignByName}</span>
      </div>
    </div>
  );
}
