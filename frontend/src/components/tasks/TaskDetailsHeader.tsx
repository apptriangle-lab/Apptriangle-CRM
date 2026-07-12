import { Building2, Calendar, ChevronLeft, Clock, Pencil, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { CrmTaskStatusCell } from "@/components/tasks/CrmTaskStatusCell";
import {
  CRM_TASK_DETAIL_PILL,
} from "@/components/tasks/taskDetailsConstants";
import {
  crmTaskTitleClass,
  crmTaskTitleOverdueClass,
  formatCrmTaskDueDate,
  formatCrmTaskRemaining,
  isCrmTaskOverdue,
} from "@/components/tasks/crmTasksListStyles";
import { cn } from "@/lib/utils";

export type TaskDetailsHeaderProps = {
  title: string;
  companyName: string;
  status: string;
  taskStatuses: string[];
  dueDatetime: string;
  assignByUserId: string;
  assignByName: string;
  assignToUserId: string;
  assignToName: string;
  createdLabel: string;
  canEdit: boolean;
  canChangeStatus: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void | Promise<void>;
};

export function TaskDetailsHeader({
  title,
  companyName,
  status,
  taskStatuses,
  dueDatetime,
  assignByUserId,
  assignByName,
  assignToUserId,
  assignToName,
  createdLabel,
  canEdit,
  canChangeStatus,
  onBack,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskDetailsHeaderProps) {
  const now = new Date();
  const overdue = isCrmTaskOverdue(dueDatetime, status, now);
  const remaining = formatCrmTaskRemaining(dueDatetime, status, now);
  const isDone = status === "completed" || status === "cancelled";

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Tasks
        </button>

        {canEdit ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              className="h-8 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              className="h-8 rounded-lg border-red-200 bg-white px-3 text-[13px] font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <div
          className={cn(
            "-mx-2 rounded-lg px-2 py-1",
            overdue && crmTaskTitleOverdueClass(true),
          )}
        >
          <h1
            className={cn(
              "text-[26px] font-medium leading-tight tracking-tight sm:text-[28px]",
              crmTaskTitleClass(isDone, overdue),
            )}
          >
            {title}
          </h1>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CrmTaskStatusCell
            status={status}
            statuses={taskStatuses}
            canChange={canChangeStatus}
            onStatusChange={onStatusChange}
          />

          <span className={cn(CRM_TASK_DETAIL_PILL, overdue && "border-rose-200 bg-rose-50/50 text-rose-800")}>
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            {formatCrmTaskDueDate(dueDatetime)}
          </span>

          {remaining.tone === "overdue" ? (
            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-rose-50/60 px-2.5 text-[12px] font-medium text-rose-700">
              <Clock className="h-3.5 w-3.5" />
              Late · {remaining.label}
            </span>
          ) : null}

          <span className={CRM_TASK_DETAIL_PILL}>
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="max-w-[180px] truncate">{companyName}</span>
          </span>

          <span className={CRM_TASK_DETAIL_PILL}>
            <PmsMemberAvatar name={assignToName} userId={assignToUserId} size="xs" />
            <span className="max-w-[140px] truncate">{assignToName}</span>
          </span>

          <span className={CRM_TASK_DETAIL_PILL}>
            <PmsMemberAvatar name={assignByName} userId={assignByUserId} size="xs" />
            <span className="max-w-[140px] truncate">{assignByName}</span>
          </span>

          <span className={CRM_TASK_DETAIL_PILL}>
            <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-500">Created {createdLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
