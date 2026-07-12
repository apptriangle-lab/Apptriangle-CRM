import {
  ArchiveRestore,
  CheckSquare,
  GitBranch,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatPmsTaskStatusLabel, type PmsTaskDto } from "@/lib/pmsApi";
import { cn, formatTableDate } from "@/lib/utils";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";

type Props = {
  task: PmsTaskDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  subtaskCount?: number;
};

export function PmsTaskRestoreDialog({
  task,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  subtaskCount = 0,
}: Props) {
  const statusTheme = task ? pmsStatusTheme(task.status) : null;

  const handleClose = () => {
    if (!loading) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        showClose={false}
        className="max-w-[440px] gap-0 overflow-hidden border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl sm:rounded-xl"
        onPointerDownOutside={(e) => loading && e.preventDefault()}
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
      >
        <div className="relative px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-4 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <ArchiveRestore className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogTitle className="text-[17px] font-semibold leading-snug text-slate-900">
                Restore this task?
              </DialogTitle>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                This task will be added back to your task list.
              </p>
            </div>
          </div>

          {task && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/60">
              <div className="flex items-start gap-3 px-4 py-3.5">
                <CheckSquare
                  className={cn("mt-0.5 h-4 w-4 shrink-0", statusTheme?.rowIcon ?? "text-slate-400")}
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug text-slate-900">{task.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {statusTheme && (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          statusTheme.pill,
                        )}
                      >
                        {formatPmsTaskStatusLabel(task.status)}
                      </span>
                    )}
                    {task.projectTitle && (
                      <span className="truncate text-[11px] text-slate-500">{task.projectTitle}</span>
                    )}
                  </div>
                  {task.deletedAt && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Deleted {formatTableDate(task.deletedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {subtaskCount > 0 && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <GitBranch className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium text-emerald-950">
                  {subtaskCount} subtask{subtaskCount === 1 ? "" : "s"} included
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800/90">
                  All nested subtasks will be restored together with this task.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleClose}
            className="h-9 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-white hover:text-slate-900"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm()}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Restoring…
              </>
            ) : (
              "Restore task"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
