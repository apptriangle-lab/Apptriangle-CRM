import type { PmsSprintFilter, PmsTaskDto } from "@/lib/pmsApi";

export function taskMatchesSprintFilter(
  task: Pick<PmsTaskDto, "sprintId">,
  sprintFilter: PmsSprintFilter,
): boolean {
  if (sprintFilter === "all") return true;
  if (sprintFilter === "backlog") return !task.sprintId;
  return task.sprintId === sprintFilter;
}

export function collectDescendantIds(parentId: string, tasks: Iterable<PmsTaskDto>): string[] {
  const byParent = new Map<string, PmsTaskDto[]>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const list = byParent.get(task.parentTaskId) ?? [];
    list.push(task);
    byParent.set(task.parentTaskId, list);
  }

  const ids: string[] = [];
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(parentId);
  return ids;
}

function cascadeSprintToDescendants(
  items: PmsTaskDto[],
  parentId: string,
  sprintId: string | null | undefined,
): PmsTaskDto[] {
  const descendantIds = new Set(collectDescendantIds(parentId, items));
  if (descendantIds.size === 0) return items;
  const nextSprint = sprintId ?? null;
  return items.map((task) =>
    descendantIds.has(task.id) ? { ...task, sprintId: nextSprint } : task,
  );
}

function idsToRemoveOnSprintExit(
  updated: PmsTaskDto,
  items: PmsTaskDto[],
): Set<string> {
  if (updated.parentTaskId) return new Set([updated.id]);
  return new Set([updated.id, ...collectDescendantIds(updated.id, items)]);
}

/** Patch a flat task list after a task update without refetching. */
export function applyListTaskUpdate(
  items: PmsTaskDto[],
  updated: PmsTaskDto,
  sprintFilter: PmsSprintFilter,
): PmsTaskDto[] {
  const exists = items.some((task) => task.id === updated.id);
  const matches = taskMatchesSprintFilter(updated, sprintFilter);

  if (exists) {
    let next = items.map((task) => (task.id === updated.id ? { ...task, ...updated } : task));
    if (!updated.parentTaskId && updated.sprintId !== undefined) {
      next = cascadeSprintToDescendants(next, updated.id, updated.sprintId);
    }
    if (!matches) {
      const removeIds = idsToRemoveOnSprintExit(updated, next);
      return next.filter((task) => !removeIds.has(task.id));
    }
    return next;
  }

  if (updated.parentTaskId) {
    if (!matches) return items;
    const parentExists = items.some((task) => task.id === updated.parentTaskId);
    if (!parentExists) return items;
    return [
      ...items.map((task) =>
        task.id === updated.parentTaskId
          ? { ...task, subTaskCount: (task.subTaskCount ?? 0) + 1 }
          : task,
      ),
      updated,
    ];
  }

  if (matches) return [...items, updated];
  return items;
}

/** Patch kanban columns after a task update without refetching. */
export function applyKanbanTaskUpdate(
  columns: Record<string, PmsTaskDto[]>,
  updated: PmsTaskDto,
  sprintFilter: PmsSprintFilter,
): Record<string, PmsTaskDto[]> {
  const allTasks = Object.values(columns).flat();
  const existing = allTasks.find((task) => task.id === updated.id);
  const merged = existing ? { ...existing, ...updated } : updated;
  const matches = taskMatchesSprintFilter(merged, sprintFilter);
  const descendantIds = !merged.parentTaskId ? collectDescendantIds(merged.id, allTasks) : [];

  const removeIds = matches ? new Set<string>() : idsToRemoveOnSprintExit(merged, allTasks);

  const next: Record<string, PmsTaskDto[]> = {};
  for (const [status, tasks] of Object.entries(columns)) {
    next[status] = tasks
      .filter((task) => !removeIds.has(task.id))
      .map((task) => {
        if (task.id === merged.id) return merged;
        if (descendantIds.includes(task.id) && merged.sprintId !== undefined) {
          return { ...task, sprintId: merged.sprintId ?? null };
        }
        return task;
      })
      .filter((task) => task.id !== merged.id);
  }

  if (!matches) return next;

  const status = merged.status;
  next[status] = [...(next[status] ?? []), merged];
  return next;
}
