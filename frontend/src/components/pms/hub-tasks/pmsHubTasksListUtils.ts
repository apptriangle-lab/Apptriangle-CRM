import type { PmsTaskDto } from "@/lib/pmsApi";
import { taskHasSubtasks, buildTaskChildNodes, type PmsTaskTreeNode } from "@/utils/pmsTaskTree";
import { isPmsTaskOverdue } from "@/lib/pmsTaskDates";
import {
  formatCrmTaskDueDate,
  formatCrmTaskRemaining,
  type CrmTaskRemainingTone,
} from "@/components/tasks/crmTasksListStyles";

/** 8-column grid: title → dates → remaining → status → company → project → assign to → assign by */
export const PMS_HUB_TASKS_COL_GRID =
  "grid grid-cols-[minmax(240px,420px)_minmax(148px,168px)_92px_108px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(168px,1fr)_minmax(168px,1fr)] items-center gap-x-4";

export const PMS_HUB_TASKS_TABLE_MIN_W = "min-w-[1280px]";

export function pmsTaskDueIso(endDate: string | null | undefined): string | null {
  if (!endDate) return null;
  return endDate.includes("T") ? endDate : `${endDate}T23:59:59`;
}

export function isPmsHubTaskDone(status: string): boolean {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("cancel")
  );
}

export function formatPmsHubTaskDueDate(endDate: string | null | undefined): string {
  const iso = pmsTaskDueIso(endDate);
  if (!iso) return "—";
  return formatCrmTaskDueDate(iso);
}

export function formatPmsHubTaskRemaining(
  task: Pick<PmsTaskDto, "endDate" | "status">,
  now = new Date(),
): { label: string; tone: CrmTaskRemainingTone } {
  const iso = pmsTaskDueIso(task.endDate);
  if (!iso) return { label: "—", tone: "done" };
  return formatCrmTaskRemaining(iso, task.status, now);
}

export function isPmsHubTaskOverdue(task: Pick<PmsTaskDto, "startDate" | "endDate" | "status">, now = new Date()) {
  return isPmsTaskOverdue(task, now);
}

export type PmsHubTaskAssignee = { userId: string; name: string };

export function getPmsHubTaskAssignees(task: PmsTaskDto): PmsHubTaskAssignee[] {
  const seen = new Set<string>();
  const assignees: PmsHubTaskAssignee[] = [];

  for (const entry of task.assignees ?? []) {
    if (!entry.userId || seen.has(entry.userId)) continue;
    seen.add(entry.userId);
    assignees.push({
      userId: entry.userId,
      name: entry.userName?.trim() || "—",
    });
  }

  if (assignees.length > 0) return assignees;

  if (task.assignedTo && !seen.has(task.assignedTo)) {
    return [
      {
        userId: task.assignedTo,
        name: task.assigneeName?.trim() || "—",
      },
    ];
  }

  return [];
}

/** Task created by, assigned to, or assigned by the user. */
export function isHubTaskOwnedByUser(task: PmsTaskDto, userId: string): boolean {
  if (!userId) return false;
  if (task.createdBy === userId) return true;
  if (task.assignedBy === userId) return true;
  return getPmsHubTaskAssignees(task).some((assignee) => assignee.userId === userId);
}

/** Client-side scope for PMS user access — keeps owned tasks and ancestor rows for the tree. */
export function filterHubTasksForUser(tasks: PmsTaskDto[], userId: string): PmsTaskDto[] {
  if (!userId) return tasks;

  const ownedIds = new Set(
    tasks.filter((task) => isHubTaskOwnedByUser(task, userId)).map((task) => task.id),
  );
  if (ownedIds.size === 0) return [];

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const include = new Set(ownedIds);

  for (const id of ownedIds) {
    let current = byId.get(id);
    while (current?.parentTaskId && byId.has(current.parentTaskId)) {
      include.add(current.parentTaskId);
      current = byId.get(current.parentTaskId)!;
    }
  }

  return tasks.filter((task) => include.has(task.id));
}

/** @deprecated Use getPmsHubTaskAssignees for multi-assignee display */
export function primaryAssignee(task: PmsTaskDto): { userId?: string; name: string } {
  const first = getPmsHubTaskAssignees(task)[0];
  if (first) return { userId: first.userId, name: first.name };
  return { name: "—" };
}

export type PmsHubTaskRow = {
  task: PmsTaskDto;
  depth: number;
  hasChildren: boolean;
};

/** Root tasks for the hub list — includes orphans whose parent is not in the set. */
export function buildPmsHubRootTasks(items: PmsTaskDto[]): PmsTaskDto[] {
  const idSet = new Set(items.map((task) => task.id));
  return items
    .filter((task) => !task.parentTaskId || !idSet.has(task.parentTaskId))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function buildPmsHubTaskTreeNodes(items: PmsTaskDto[]): PmsTaskTreeNode[] {
  return buildPmsHubRootTasks(items).map((task) => ({
    task,
    children: buildTaskChildNodes(task.id, items),
  }));
}

export function isPmsHubTaskExpanded(expanded: Record<string, boolean>, taskId: string): boolean {
  return expanded[taskId] !== false;
}

export function hubTaskHasChildren(task: PmsTaskDto, items: PmsTaskDto[]): boolean {
  return taskHasSubtasks(task, items);
}

/** Task ids that have at least one child in the given item set (any depth). */
export function collectPmsHubParentTaskIds(items: PmsTaskDto[]): string[] {
  const parentIds = new Set<string>();
  items.forEach((task) => {
    if (task.parentTaskId) parentIds.add(task.parentTaskId);
  });
  return [...parentIds];
}

/** @deprecated Use tree rendering in PmsHubTasksListTable */
export function buildPmsHubTaskRows(
  items: PmsTaskDto[],
  expanded: Record<string, boolean>,
): PmsHubTaskRow[] {
  const rows: PmsHubTaskRow[] = [];

  const walk = (node: PmsTaskTreeNode, depth: number) => {
    const hasChildren = hubTaskHasChildren(node.task, items);
    rows.push({ task: node.task, depth, hasChildren });
    if (hasChildren && isPmsHubTaskExpanded(expanded, node.task.id)) {
      node.children.forEach((child) => walk(child, depth + 1));
    }
  };

  buildPmsHubTaskTreeNodes(items).forEach((root) => walk(root, 0));
  return rows;
}
