import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { usePmsHubTasksFilters } from "@/contexts/PmsHubTasksFiltersContext";
import { usePmsHubTasksData } from "@/contexts/PmsHubTasksDataContext";
import { EmptyState } from "@/components/EmptyState";
import { PmsHubTasksListSkeleton } from "@/components/pms/hub-tasks/PmsHubTasksListSkeleton";
import { PmsHubTasksListTable } from "@/components/pms/hub-tasks/PmsHubTasksListTable";
import {
  buildPmsHubRootTasks,
  collectPmsHubParentTaskIds,
  isPmsHubTaskExpanded,
} from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import { pmsApi } from "@/lib/pmsApi";
import type { PmsTaskDto } from "@/lib/pmsApi";

export function PmsHubTasksListView() {
  const { openTask, notifyTaskUpdated } = usePmsTaskModal();
  const { pmsTaskStatuses } = useStatusConfig();
  const { search, projectFilter, statusFilter, assigneeFilter, companyFilter } = usePmsHubTasksFilters();
  const { tasks, projects, users, tasksLoading, patchTask } = usePmsHubTasksData();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const userEmailById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      if (user.email) map.set(user.id, user.email);
    });
    return map;
  }, [users]);

  const getUserEmail = useCallback(
    (userId: string) => userEmailById.get(userId),
    [userEmailById],
  );

  const searchFilteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => task.title.toLowerCase().includes(q));
  }, [tasks, search]);

  const statusOrder = useMemo(() => {
    const order: string[] = pmsTaskStatuses.length ? [...pmsTaskStatuses] : [];
    const seen = new Set(order);
    searchFilteredItems.forEach((task) => {
      if (!seen.has(task.status)) {
        order.push(task.status);
        seen.add(task.status);
      }
    });
    return order;
  }, [pmsTaskStatuses, searchFilteredItems]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      tasks.forEach((task) => {
        if (tasks.some((child) => child.parentTaskId === task.id) && !(task.id in next)) {
          next[task.id] = true;
        }
      });
      return next;
    });
  }, [tasks]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return searchFilteredItems;

    const idMap = new Map(searchFilteredItems.map((task) => [task.id, task]));
    const include = new Set<string>();

    searchFilteredItems.forEach((task) => {
      if (task.status !== statusFilter) return;
      include.add(task.id);
      let current = task;
      while (current.parentTaskId && idMap.has(current.parentTaskId)) {
        include.add(current.parentTaskId);
        current = idMap.get(current.parentTaskId)!;
      }
    });

    return searchFilteredItems.filter((task) => include.has(task.id));
  }, [searchFilteredItems, statusFilter]);

  const rootCount = useMemo(() => buildPmsHubRootTasks(filteredItems).length, [filteredItems]);

  const hasVisibleTasks = filteredItems.length > 0;

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    projectFilter !== "all" ||
    companyFilter !== "all" ||
    assigneeFilter !== "me";

  const emptyTitle = useMemo(() => {
    if (hasActiveFilters) return "No tasks match your filters";
    if (assigneeFilter === "me") return "No tasks linked to you";
    if (assigneeFilter === "all") return "No tasks found";
    return "No tasks for this user";
  }, [hasActiveFilters, assigneeFilter]);

  const emptyDescription = useMemo(() => {
    if (hasActiveFilters) return "Try adjusting your search or filter criteria.";
    if (assigneeFilter === "me") {
      return "Tasks you created, assigned to you, or assigned by you will appear here.";
    }
    return "Try another user or adjust your filters.";
  }, [hasActiveFilters, assigneeFilter]);

  const getCompanyName = useCallback(
    (task: PmsTaskDto) => {
      const project = projectById.get(task.projectId);
      return project?.companyName ?? "—";
    },
    [projectById],
  );

  const getProjectName = useCallback(
    (task: PmsTaskDto) => {
      const project = projectById.get(task.projectId);
      return project?.title ?? task.projectTitle ?? "—";
    },
    [projectById],
  );

  const getAssignByName = useCallback(
    (task: PmsTaskDto) => {
      const assignerId = task.assignedBy ?? task.createdBy;
      if (!assignerId) return "—";
      return userNameById.get(assignerId) ?? "—";
    },
    [userNameById],
  );

  const handleToggleExpand = useCallback((taskId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [taskId]: !isPmsHubTaskExpanded(prev, taskId),
    }));
  }, []);

  const handleToggleExpandAll = useCallback(() => {
    setExpanded((prev) => {
      const parentIds = collectPmsHubParentTaskIds(filteredItems);
      const allExpanded =
        parentIds.length > 0 && parentIds.every((id) => isPmsHubTaskExpanded(prev, id));
      const next = { ...prev };
      parentIds.forEach((id) => {
        next[id] = !allExpanded;
      });
      return next;
    });
  }, [filteredItems]);

  const handleStatusChange = useCallback(
    async (taskId: string, status: string) => {
      try {
        const updated = await pmsApi.patchTaskStatus(taskId, status);
        patchTask(updated);
        notifyTaskUpdated(updated);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update status");
      }
    },
    [patchTask, notifyTaskUpdated],
  );

  const now = useMemo(() => new Date(), [tasks.length, tasksLoading]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        {tasksLoading ? (
          <PmsHubTasksListSkeleton />
        ) : !hasVisibleTasks ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <EmptyState
              icon={CheckSquare}
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : (
          <PmsHubTasksListTable
            items={filteredItems}
            taskCount={rootCount}
            expanded={expanded}
            getCompanyName={getCompanyName}
            getProjectName={getProjectName}
            getAssignByName={getAssignByName}
            getUserEmail={getUserEmail}
            statusOrder={statusOrder}
            canChangeStatus
            onToggleExpand={handleToggleExpand}
            onToggleExpandAll={handleToggleExpandAll}
            onStatusChange={handleStatusChange}
            onRowClick={openTask}
            now={now}
          />
        )}
      </div>
    </div>
  );
}
