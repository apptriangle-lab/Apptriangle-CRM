import type { Task, TaskStatus } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { CrmTasksListRow } from "@/components/tasks/CrmTasksListRow";
import { CRM_TASKS_COL_GRID, CRM_TASKS_LIST_HPAD, CRM_TASKS_TABLE_MIN_W, CRM_TASKS_TITLE_PL } from "@/components/tasks/crmTasksListStyles";

const COLUMNS = [
  "Title",
  "Due Date",
  "Remaining",
  "Status",
  "Company",
  "Assign To",
  "Assign By",
] as const;

type Props = {
  tasks: Task[];
  taskCount: number;
  getCompanyName: (companyId: string) => string;
  getUserName: (userId: string) => string;
  statusOrder: string[];
  canChangeStatus: (task: Task) => boolean;
  onStatusChange: (taskId: string, status: string) => void | Promise<void>;
  onRowClick: (taskId: string) => void;
  now?: Date;
};

export function CrmTasksListTable({
  tasks,
  taskCount,
  getCompanyName,
  getUserName,
  statusOrder,
  canChangeStatus,
  onStatusChange,
  onRowClick,
  now,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto scrollbar-table">
        <div className={CRM_TASKS_TABLE_MIN_W}>
          <div
            role="row"
            className={cn(
              CRM_TASKS_COL_GRID,
              CRM_TASKS_LIST_HPAD,
              "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm",
            )}
          >
            <span className={CRM_TASKS_TITLE_PL}>
              {COLUMNS[0]} <span className="font-normal text-slate-400">({taskCount})</span>
            </span>
            {COLUMNS.slice(1).map((col) => (
              <span key={col} className="truncate">
                {col}
              </span>
            ))}
          </div>

          {tasks.map((task) => (
            <div key={task.id} className={CRM_TASKS_LIST_HPAD}>
              <CrmTasksListRow
                task={task}
                companyName={getCompanyName(task.companyId)}
                assignToName={getUserName(task.assignToUserId)}
                assignByName={getUserName(task.assignByUserId)}
                statuses={statusOrder}
                canChangeStatus={canChangeStatus(task)}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onClick={() => onRowClick(task.id)}
                now={now}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
