import type { PmsTaskDto } from "@/lib/pmsApi";

export function isPmsSubtask(task: Pick<PmsTaskDto, "parentTaskId"> | null | undefined): boolean {
  return Boolean(task?.parentTaskId);
}

export function isPmsParentTask(task: Pick<PmsTaskDto, "parentTaskId"> | null | undefined): boolean {
  return Boolean(task) && !task?.parentTaskId;
}
