import type { PmsDateRange } from "@/components/pms/PmsTaskDatePicker";
import type { PmsTaskDto } from "@/lib/pmsApi";
import { taskOverlapsDateRange } from "@/lib/pmsTaskDates";

export { parsePmsTaskDate as parsePmsDueDate } from "@/lib/pmsTaskDates";

export function taskMatchesDueDateRange(task: PmsTaskDto, range: PmsDateRange): boolean {
  return taskOverlapsDateRange(task, range);
}

/** Keep matching tasks and ancestors so subtasks remain visible under their parent. */
export function filterTasksByDueDateRange(items: PmsTaskDto[], range: PmsDateRange): PmsTaskDto[] {
  if (!range.startDate && !range.endDate) return items;

  const byId = new Map(items.map((t) => [t.id, t]));
  const matchingIds = new Set(
    items.filter((t) => taskMatchesDueDateRange(t, range)).map((t) => t.id),
  );
  const visibleIds = new Set(matchingIds);

  for (const id of matchingIds) {
    let parentId = byId.get(id)?.parentTaskId;
    while (parentId) {
      visibleIds.add(parentId);
      parentId = byId.get(parentId)?.parentTaskId;
    }
  }

  return items.filter((t) => visibleIds.has(t.id));
}
