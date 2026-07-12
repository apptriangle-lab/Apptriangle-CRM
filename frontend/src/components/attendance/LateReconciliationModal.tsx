import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  ClipboardList,
  Loader2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { attendanceReconciliationApi, type AttendanceDto } from "@/lib/api";
import {
  formatAttendanceDateShort,
  formatAttendanceHhmm12h,
} from "@/lib/attendanceDisplay";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MIN_REASON_LENGTH = 3;

type LateReconciliationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: AttendanceDto | null;
  onSubmitted: () => void;
  /** User closed the dialog without a successful submit (backdrop, X, Cancel). */
  onDismissWithoutSubmit?: () => void;
};

function MetaTile({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#f8f9fb] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <p className={cn("mt-1 truncate text-[13px] font-semibold text-slate-900", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

export function LateReconciliationModal({
  open,
  onOpenChange,
  attendance,
  onSubmitted,
  onDismissWithoutSubmit,
}: LateReconciliationModalProps) {
  const submittedRef = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmedLength = reason.trim().length;
  const canSubmit = trimmedLength >= MIN_REASON_LENGTH && !saving;

  useEffect(() => {
    if (!open || !attendance) return;
    submittedRef.current = false;
    setReason("");
    requestAnimationFrame(() => reasonRef.current?.focus());
  }, [open, attendance]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !submittedRef.current) {
      onDismissWithoutSubmit?.();
    }
    onOpenChange(next);
  };

  const handleClose = () => {
    if (!saving) handleOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendance?.id) {
      toast.error("Missing attendance record");
      return;
    }
    const r = reason.trim();
    if (r.length < MIN_REASON_LENGTH) {
      toast.error(`Please enter a reason (at least ${MIN_REASON_LENGTH} characters)`);
      reasonRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await attendanceReconciliationApi.create({
        attendanceId: attendance.id,
        reason: r,
      });
      submittedRef.current = true;
      toast.success("Reconciliation request submitted");
      onSubmitted();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const attendanceDate = formatAttendanceDateShort(attendance?.date);
  const checkInLabel = formatAttendanceHhmm12h(attendance?.checkInTime);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[560px] gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl"
      >
        <form onSubmit={handleSubmit} className="flex max-h-[min(85vh,640px)] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thinner">
            <div className="flex items-start justify-end px-4 pt-3">
              <button
                type="button"
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                onClick={handleClose}
                disabled={saving}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-2 pt-0">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                  <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Late check-in
                  </p>
                  <DialogTitle className="mt-0.5 text-left text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">
                    Reconciliation request
                  </DialogTitle>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-6 py-4">
              <MetaTile icon={CalendarDays} label="Date" value={attendanceDate} />
              <MetaTile
                icon={Clock}
                label="Check-in"
                value={checkInLabel}
                valueClassName="tabular-nums"
              />
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                  Status
                </div>
                <span className="mt-1 inline-flex h-6 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800">
                  Late
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 px-6 py-5">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor="recon-reason"
                  className="text-[13px] font-semibold text-slate-800"
                >
                  Reason for late check-in
                </label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    trimmedLength >= MIN_REASON_LENGTH ? "text-slate-400" : "text-amber-600",
                  )}
                >
                  {trimmedLength} / min {MIN_REASON_LENGTH}
                </span>
              </div>
              <Textarea
                ref={reasonRef}
                id="recon-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Traffic delay on the highway, client meeting ran over…"
                rows={4}
                required
                disabled={saving}
                className={cn(
                  "min-h-[112px] resize-none rounded-xl border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400",
                  "focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
                )}
              />
              <p className="text-[11px] text-slate-400">
                Be specific — clear reasons help admins review faster.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="h-8 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-8 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
