import { useContext, useEffect } from "react";
import { PmsProjectContext } from "@/contexts/PmsProjectContext";
import { usePmsTaskViewContext } from "@/contexts/PmsTaskViewContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { canViewAllHubTasks } from "@/lib/pmsHubTasksAccess";
import { PMS_MY_TASKS_FILTER_SCOPE } from "@/lib/pmsMyTasksScope";
import type { AssigneeFilter } from "@/lib/pmsViewFiltersStorage";

/** Hub = cross-project tasks tab; project = single project details tasks tab. */
export type PmsAssigneeFilterScope = "hub" | "project";

function useAssigneeFilterScopeId(): string {
  const { filterScopeId: taskViewScopeId } = usePmsTaskViewContext();
  const projectCtx = useContext(PmsProjectContext);
  return taskViewScopeId || projectCtx?.projectId || "";
}

/** Hub: user access is personal-only. Project: members may filter by any project assignee. */
export function usePmsAssigneeFilterAccess(
  assigneeFilter: AssigneeFilter,
  setAssigneeFilter: (value: AssigneeFilter) => void,
  scope: PmsAssigneeFilterScope = "hub",
): boolean {
  const { perms } = usePmsPermissions();
  const filterScopeId = useAssigneeFilterScopeId();
  const canViewAllAssignees = scope === "project" || canViewAllHubTasks(perms);

  useEffect(() => {
    if (scope !== "project") return;
    if (!filterScopeId || filterScopeId === PMS_MY_TASKS_FILTER_SCOPE) return;
    setAssigneeFilter("all");
  }, [scope, filterScopeId, setAssigneeFilter]);

  useEffect(() => {
    if (canViewAllAssignees) return;
    if (assigneeFilter !== "me") setAssigneeFilter("me");
  }, [canViewAllAssignees, assigneeFilter, setAssigneeFilter]);

  return canViewAllAssignees;
}

export function appendPersonalTaskScopeParams(
  params: Record<string, string | number>,
  opts: { canViewAllAssignees: boolean; assigneeFilter: AssigneeFilter; userId?: string },
): void {
  if (opts.canViewAllAssignees) {
    if (opts.assigneeFilter === "me" && opts.userId) {
      params.assignedTo = opts.userId;
    } else if (opts.assigneeFilter !== "all") {
      params.assignedTo = opts.assigneeFilter;
    }
    return;
  }
  params.mine = "true";
}
