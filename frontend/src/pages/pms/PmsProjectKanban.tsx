import { PmsKanbanBoard } from "@/components/pms/PmsKanbanBoard";

/** ClickUp-style Kanban board grouped by task status. */
export default function PmsProjectKanban() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PmsKanbanBoard />
    </div>
  );
}
