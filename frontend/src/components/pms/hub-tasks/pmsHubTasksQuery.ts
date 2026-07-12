import type { AssigneeFilter } from "@/lib/pmsViewFiltersStorage";
import type { PmsTaskDto } from "@/lib/pmsApi";

export const HUB_TASKS_STALE_MS = 60_000;
export const HUB_PROJECTS_STALE_MS = 120_000;
export const HUB_USERS_STALE_MS = 300_000;

export function hubTasksQueryKey(
  assigneeFilter: AssigneeFilter,
  projectFilter: string,
  companyFilter: string,
) {
  return ["pms-hub-tasks", assigneeFilter, projectFilter, companyFilter] as const;
}

export function hubProjectsQueryKey(
  assigneeFilter: AssigneeFilter,
  currentUserId: string | undefined,
  companyFilter: string,
) {
  return ["pms-hub-projects", assigneeFilter, currentUserId ?? "", companyFilter] as const;
}

export const hubUsersQueryKey = ["pms-hub-users", "active"] as const;

export function buildKanbanColumnsFromTasks(
  tasks: PmsTaskDto[],
  statusOrder: string[],
): Record<string, PmsTaskDto[]> {
  const columns: Record<string, PmsTaskDto[]> = {};
  for (const status of statusOrder) {
    columns[status] = [];
  }
  const fallback = statusOrder[0] ?? "to_do";
  for (const task of tasks) {
    const col = task.status in columns ? task.status : fallback;
    columns[col].push(task);
  }
  return columns;
}
