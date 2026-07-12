import type { PmsTaskDto } from "@/lib/pmsApi";

export type PmsTaskTreeNode = {
  task: PmsTaskDto;
  children: PmsTaskTreeNode[];
};

/** Stable sibling order: oldest created first, then title. */
export function comparePmsSiblingTasks(a: PmsTaskDto, b: PmsTaskDto): number {
  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (aCreated !== bCreated) return aCreated - bCreated;
  return a.title.localeCompare(b.title);
}

export function buildTaskChildNodes(parentId: string, allItems: PmsTaskDto[]): PmsTaskTreeNode[] {
  return allItems
    .filter((t) => t.parentTaskId === parentId)
    .sort(comparePmsSiblingTasks)
    .map((task) => ({
      task,
      children: buildTaskChildNodes(task.id, allItems),
    }));
}

export function rootTasksForStatus(status: string, allItems: PmsTaskDto[]): PmsTaskDto[] {
  return allItems.filter((t) => t.status === status && !t.parentTaskId);
}

export function taskHasSubtasks(task: PmsTaskDto, allItems: PmsTaskDto[]): boolean {
  if ((task.subTaskCount ?? 0) > 0) return true;
  return allItems.some((t) => t.parentTaskId === task.id);
}

/** All tasks in the subtree under rootId (not including rootId itself). */
export function collectDescendants(rootId: string, allItems: PmsTaskDto[]): PmsTaskDto[] {
  const out: PmsTaskDto[] = [];
  const walk = (parentId: string) => {
    allItems.filter((t) => t.parentTaskId === parentId).forEach((t) => {
      out.push(t);
      walk(t.id);
    });
  };
  walk(rootId);
  return out;
}

export function isTaskCompleted(task: PmsTaskDto): boolean {
  const s = task.status.toLowerCase();
  return s === "completed" || s.includes("done") || !!task.completedAt;
}
