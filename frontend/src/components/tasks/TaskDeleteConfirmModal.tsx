import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type TaskDeleteConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: () => void | Promise<void>;
  deleting?: boolean;
};

export function TaskDeleteConfirmModal({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
  deleting = false,
}: TaskDeleteConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl sm:rounded-xl">
        <div className="px-6 py-5">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <AlertDialogTitle className="text-[18px] font-semibold tracking-tight text-slate-900">
                Delete task?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-slate-500">
              This will permanently delete{" "}
              <span className="font-medium text-slate-700">
                &ldquo;{taskTitle || "this task"}&rdquo;
              </span>{" "}
              and its activity history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="gap-2 border-t border-slate-100 bg-[#f8f9fb] px-6 py-4 sm:justify-end sm:space-x-0">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              className="h-9 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={deleting}
            className="h-9 rounded-lg bg-rose-600 px-4 text-[13px] font-semibold text-white hover:bg-rose-700"
            onClick={() => void onConfirm()}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete task"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
