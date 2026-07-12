import { format } from "date-fns";
import { Loader2, Trash2, Wallet } from "lucide-react";
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
import type { LunchPollDto } from "@/lib/lunchApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll: LunchPollDto | null;
  onConfirm: () => void | Promise<void>;
  deleting?: boolean;
};

export function LunchPollDeleteConfirmModal({
  open,
  onOpenChange,
  poll,
  onConfirm,
  deleting = false,
}: Props) {
  const pollDateLabel = poll?.date
    ? format(new Date(poll.date + "T12:00:00"), "MMM d, yyyy")
    : "this date";

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border-orange-100 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-[0_8px_30px_rgba(251,146,60,0.12)] sm:rounded-2xl">
        <div className="border-b border-orange-100/80 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/30 px-6 py-5">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <AlertDialogTitle className="text-[18px] font-semibold tracking-tight text-stone-900">
                Delete lunch poll?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-[13px] leading-relaxed text-stone-500">
                <p>
                  This will permanently delete the poll for{" "}
                  <span className="font-medium text-stone-700">{pollDateLabel}</span>
                  {poll?.title ? (
                    <>
                      {" "}
                      (
                      <span className="font-medium text-stone-700">&ldquo;{poll.title}&rdquo;</span>)
                    </>
                  ) : null}
                  , including all votes. This action cannot be undone.
                </p>
                <div className="flex gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-amber-950">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  <p>
                    <span className="font-semibold text-amber-900">Wallet balances will be updated.</span>{" "}
                    Any lunch charges from this poll will be reversed for affected users.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="gap-2 border-t border-orange-100/80 bg-gradient-to-r from-orange-50/20 via-white to-amber-50/20 px-6 py-4 sm:justify-end sm:space-x-0">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              className="h-9 rounded-xl border-stone-200 bg-white px-4 text-[13px] font-medium text-stone-700 hover:border-orange-200 hover:bg-orange-50/50 hover:text-stone-900"
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={deleting}
            className="h-9 gap-2 rounded-xl bg-rose-600 px-4 text-[13px] font-semibold text-white hover:bg-rose-700"
            onClick={() => void onConfirm()}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete poll"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
