import { useState } from "react";
import { Flag, User, X } from "lucide-react";
import { toast } from "sonner";
import {
  formatPmsTaskStatusLabel,
  pmsApi,
  PMS_PRIORITIES,
  type PmsTaskDto,
} from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PmsTaskAssigneesPicker,
  type AssigneeOption,
} from "@/components/pms/PmsTaskAssigneesPicker";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";

type Props = {
  selectedIds: string[];
  statusOrder: string[];
  assigneeOptions: AssigneeOption[];
  canUpdateTask: boolean;
  canUpdateTaskStatus: boolean;
  onClear: () => void;
  onApplied: (tasks: PmsTaskDto[]) => void;
};

export function PmsTaskBulkActionBar({
  selectedIds,
  statusOrder,
  assigneeOptions,
  canUpdateTask,
  canUpdateTaskStatus,
  onClear,
  onApplied,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  const runBulk = async (patch: {
    status?: string;
    priority?: string;
    assigneeIds?: string[];
  }) => {
    setBusy(true);
    try {
      const res = await pmsApi.bulkUpdateTasks({ taskIds: selectedIds, ...patch });
      if (res.updated > 0) {
        onApplied(res.tasks);
        toast.success(`Updated ${res.updated} task${res.updated === 1 ? "" : "s"}`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} task${res.failed === 1 ? "" : "s"} could not be updated`);
      }
      if (res.updated > 0) onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBusy(false);
      setAssignOpen(false);
    }
  };

  const applyAssignees = () => {
    void runBulk({ assigneeIds });
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-900 px-4 py-2.5 text-white shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium tabular-nums">
          {count} selected
        </span>

        {canUpdateTaskStatus && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 bg-white/10 text-white hover:bg-white/20"
                disabled={busy}
              >
                Change status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[min(280px,50vh)] overflow-y-auto">
              {statusOrder.map((s, i) => {
                const theme = pmsStatusTheme(s, i);
                return (
                  <DropdownMenuItem key={s} onClick={() => void runBulk({ status: s })}>
                    <span
                      className={cn(
                        "mr-2 inline-block h-2 w-2 rounded-full",
                        theme.dot,
                      )}
                    />
                    {formatPmsTaskStatusLabel(s)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canUpdateTask && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 bg-white/10 text-white hover:bg-white/20"
                  disabled={busy}
                >
                  <Flag className="h-3.5 w-3.5" />
                  Priority
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PMS_PRIORITIES.map((p) => (
                  <DropdownMenuItem key={p.value} onClick={() => void runBulk({ priority: p.value })}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover open={assignOpen} onOpenChange={setAssignOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 bg-white/10 text-white hover:bg-white/20"
                  disabled={busy}
                >
                  <User className="h-3.5 w-3.5" />
                  Assign
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto min-w-[240px] p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Assign to {count} task{count === 1 ? "" : "s"}
                </p>
                <PmsTaskAssigneesPicker
                  value={assigneeIds}
                  onChange={setAssigneeIds}
                  options={assigneeOptions}
                  disabled={busy}
                  open={assignOpen}
                  onOpenChange={setAssignOpen}
                  placeholder="Choose assignees"
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={busy || assigneeIds.length === 0}
                  onClick={applyAssignees}
                >
                  Apply assignees
                </Button>
              </PopoverContent>
            </Popover>
          </>
        )}

        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          onClick={onClear}
          disabled={busy}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
