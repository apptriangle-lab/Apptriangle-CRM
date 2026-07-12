import { Fragment } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import type { PmsTaskDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PMS_HUB_TASKS_COL_GRID,
  PMS_HUB_TASKS_TABLE_MIN_W,
  buildPmsHubRootTasks,
  collectPmsHubParentTaskIds,
  hubTaskHasChildren,
  isPmsHubTaskExpanded,
} from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import {
  CRM_TASKS_LIST_HPAD,
  CRM_TASKS_TITLE_PL,
} from "@/components/tasks/crmTasksListStyles";
import { PmsHubTasksListRow } from "@/components/pms/hub-tasks/PmsHubTasksListRow";
import { buildTaskChildNodes, type PmsTaskTreeNode } from "@/utils/pmsTaskTree";

const COLUMNS = [
  "Title",
  "Due Date",
  "Remaining",
  "Status",
  "Company",
  "Project",
  "Assign To",
  "Assign By",
] as const;

type RowProps = {
  allItems: PmsTaskDto[];
  expanded: Record<string, boolean>;
  getCompanyName: (task: PmsTaskDto) => string;
  getProjectName: (task: PmsTaskDto) => string;
  getAssignByName: (task: PmsTaskDto) => string;
  getUserEmail?: (userId: string) => string | undefined;
  statusOrder: string[];
  canChangeStatus: boolean;
  onToggleExpand: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void | Promise<void>;
  onRowClick: (taskId: string) => void;
  now?: Date;
};

function HubTaskTreeRow({
  node,
  allItems,
  expanded,
  depth = 0,
  getCompanyName,
  getProjectName,
  getAssignByName,
  getUserEmail,
  statusOrder,
  canChangeStatus,
  onToggleExpand,
  onStatusChange,
  onRowClick,
  now,
}: RowProps & { node: PmsTaskTreeNode; depth?: number }) {
  const { task, children } = node;
  const hasChildren = hubTaskHasChildren(task, allItems);
  const isExpanded = isPmsHubTaskExpanded(expanded, task.id);
  const showSubtree = hasChildren && isExpanded;

  return (
    <Fragment>
      <div className={cn(CRM_TASKS_LIST_HPAD, "relative")}>
        {depth > 0 ? (
          <span
            className="pointer-events-none absolute bottom-0 left-5 top-0 w-0.5 rounded-full bg-slate-300/90 sm:left-6"
            aria-hidden
          />
        ) : null}
        <PmsHubTasksListRow
          task={task}
          hasChildren={hasChildren}
          expanded={isExpanded}
          subTaskCount={task.subTaskCount ?? children.length}
          companyName={getCompanyName(task)}
          projectName={getProjectName(task)}
          assignByName={getAssignByName(task)}
          getUserEmail={getUserEmail}
          statuses={statusOrder}
          canChangeStatus={canChangeStatus}
          onToggleExpand={() => onToggleExpand(task.id)}
          onStatusChange={(status) => onStatusChange(task.id, status)}
          onClick={() => onRowClick(task.id)}
          now={now}
        />
      </div>

      {showSubtree
        ? children.map((child) => (
            <HubTaskTreeRow
              key={child.task.id}
              node={child}
              allItems={allItems}
              expanded={expanded}
              depth={depth + 1}
              getCompanyName={getCompanyName}
              getProjectName={getProjectName}
              getAssignByName={getAssignByName}
              getUserEmail={getUserEmail}
              statusOrder={statusOrder}
              canChangeStatus={canChangeStatus}
              onToggleExpand={onToggleExpand}
              onStatusChange={onStatusChange}
              onRowClick={onRowClick}
              now={now}
            />
          ))
        : null}
    </Fragment>
  );
}

type Props = {
  items: PmsTaskDto[];
  taskCount: number;
  expanded: Record<string, boolean>;
  getCompanyName: (task: PmsTaskDto) => string;
  getProjectName: (task: PmsTaskDto) => string;
  getAssignByName: (task: PmsTaskDto) => string;
  getUserEmail?: (userId: string) => string | undefined;
  statusOrder: string[];
  canChangeStatus: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleExpandAll: () => void;
  onStatusChange: (taskId: string, status: string) => void | Promise<void>;
  onRowClick: (taskId: string) => void;
  now?: Date;
};

export function PmsHubTasksListTable({
  items,
  taskCount,
  expanded,
  getCompanyName,
  getProjectName,
  getAssignByName,
  getUserEmail,
  statusOrder,
  canChangeStatus,
  onToggleExpand,
  onToggleExpandAll,
  onStatusChange,
  onRowClick,
  now,
}: Props) {
  const roots = buildPmsHubRootTasks(items).map((task) => ({
    task,
    children: buildTaskChildNodes(task.id, items),
  }));
  const parentIds = collectPmsHubParentTaskIds(items);
  const hasCollapsibleTasks = parentIds.length > 0;
  const allExpanded =
    hasCollapsibleTasks && parentIds.every((id) => isPmsHubTaskExpanded(expanded, id));
  const expandAllLabel = allExpanded ? "Collapse all" : "Expand all";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto scrollbar-table">
        <div className={PMS_HUB_TASKS_TABLE_MIN_W}>
          <div
            role="row"
            className={cn(
              PMS_HUB_TASKS_COL_GRID,
              CRM_TASKS_LIST_HPAD,
              "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm",
            )}
          >
            <span className={cn(CRM_TASKS_TITLE_PL, "flex min-w-0 items-center gap-2")}>
              <span className="truncate">
                {COLUMNS[0]}{" "}
                <span className="font-normal text-slate-400">({taskCount})</span>
              </span>
              {hasCollapsibleTasks ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggleExpandAll}
                      aria-label={expandAllLabel}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                    >
                      {allExpanded ? (
                        <ChevronsUp className="h-3.5 w-3.5" strokeWidth={2.25} />
                      ) : (
                        <ChevronsDown className="h-3.5 w-3.5" strokeWidth={2.25} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {expandAllLabel}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </span>
            {COLUMNS.slice(1).map((col) => (
              <span key={col} className="truncate">
                {col}
              </span>
            ))}
          </div>

          {roots.map((node) => (
            <HubTaskTreeRow
              key={node.task.id}
              node={node}
              allItems={items}
              expanded={expanded}
              getCompanyName={getCompanyName}
              getProjectName={getProjectName}
              getAssignByName={getAssignByName}
              getUserEmail={getUserEmail}
              statusOrder={statusOrder}
              canChangeStatus={canChangeStatus}
              onToggleExpand={onToggleExpand}
              onStatusChange={onStatusChange}
              onRowClick={onRowClick}
              now={now}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
