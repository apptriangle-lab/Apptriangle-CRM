import { Building2, Calendar, UserRound } from "lucide-react";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { CrmTaskStatusCell } from "@/components/tasks/CrmTaskStatusCell";
import { formatCrmTaskDueDate, formatCrmTaskRemaining, isCrmTaskOverdue } from "@/components/tasks/crmTasksListStyles";
import {
  CRM_TASK_DETAIL_CARD,
  CRM_TASK_DETAIL_META_LABEL,
  CRM_TASK_DETAIL_META_VALUE,
  CRM_TASK_DETAIL_SECTION_TITLE,
} from "./taskDetailsConstants";
import { cn } from "@/lib/utils";

type TaskDetailsPropertiesProps = {
  status: string;
  taskStatuses: string[];
  dueDatetime: string;
  companyName: string;
  assignByUserId: string;
  assignByName: string;
  assignToUserId: string;
  assignToName: string;
  createdLabel: string;
  canChangeStatus: boolean;
  onStatusChange: (status: string) => void | Promise<void>;
};

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className={cn(CRM_TASK_DETAIL_META_LABEL, "shrink-0 pt-0.5")}>{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

export function TaskDetailsStatusCard({
  status,
  taskStatuses,
  dueDatetime,
  companyName,
  assignByUserId,
  assignByName,
  assignToUserId,
  assignToName,
  createdLabel,
  canChangeStatus,
  onStatusChange,
}: TaskDetailsPropertiesProps) {
  const overdue = isCrmTaskOverdue(dueDatetime, status);
  const remaining = formatCrmTaskRemaining(dueDatetime, status);

  return (
    <div className={CRM_TASK_DETAIL_CARD}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className={CRM_TASK_DETAIL_SECTION_TITLE}>Properties</h2>
      </div>
      <div className="px-4 py-1">
        <PropertyRow label="Status">
          <CrmTaskStatusCell
            status={status}
            statuses={taskStatuses}
            canChange={canChangeStatus}
            onStatusChange={onStatusChange}
          />
        </PropertyRow>

        <PropertyRow label="Due date">
          <span
            className={cn(
              CRM_TASK_DETAIL_META_VALUE,
              "inline-flex items-center gap-1.5",
              overdue && "text-rose-700",
            )}
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {formatCrmTaskDueDate(dueDatetime)}
          </span>
        </PropertyRow>

        {remaining.tone === "overdue" ? (
          <PropertyRow label="Remaining">
            <span className="text-[13px] font-medium text-rose-600">Late · {remaining.label}</span>
          </PropertyRow>
        ) : null}

        <PropertyRow label="Company">
          <span className={cn(CRM_TASK_DETAIL_META_VALUE, "inline-flex items-center gap-1.5")}>
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{companyName}</span>
          </span>
        </PropertyRow>

        <PropertyRow label="Assign to">
          <span className={cn(CRM_TASK_DETAIL_META_VALUE, "inline-flex items-center gap-1.5")}>
            <PmsMemberAvatar name={assignToName} userId={assignToUserId} size="xs" />
            <span className="truncate">{assignToName}</span>
          </span>
        </PropertyRow>

        <PropertyRow label="Assign by">
          <span className={cn(CRM_TASK_DETAIL_META_VALUE, "inline-flex items-center gap-1.5")}>
            <PmsMemberAvatar name={assignByName} userId={assignByUserId} size="xs" />
            <span className="truncate">{assignByName}</span>
          </span>
        </PropertyRow>

        <PropertyRow label="Created">
          <span className={cn(CRM_TASK_DETAIL_META_VALUE, "inline-flex items-center gap-1.5")}>
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            {createdLabel}
          </span>
        </PropertyRow>
      </div>
    </div>
  );
}
