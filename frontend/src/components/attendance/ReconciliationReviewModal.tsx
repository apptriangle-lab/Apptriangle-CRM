import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceReconciliationDto } from "@/lib/api";
import {
  formatAttendanceDateShort,
  formatAttendanceHhmm12h,
} from "@/lib/attendanceDisplay";
import { cn } from "@/lib/utils";

type ReviewDecision = "approved" | "rejected";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AttendanceReconciliationDto | null;
  decision: ReviewDecision | null;
  saving: boolean;
  onConfirm: (reviewNote: string) => void;
};

function MetaTile({
  icon: Icon,
  label,
  value,
  subtitle,
  valueClassName,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  subtitle?: string;
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
      {subtitle ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

const THEME: Record<
  ReviewDecision,
  {
    kicker: string;
    title: string;
    Icon: typeof CheckCircle2;
    iconWrap: string;
    kickerClass: string;
    confirmLabel: string;
    confirmClass: string;
  }
> = {
  approved: {
    kicker: "Approve request",
    title: "Confirm approval",
    Icon: CheckCircle2,
    iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    kickerClass: "text-emerald-700",
    confirmLabel: "Approve request",
    confirmClass: "bg-slate-900 hover:bg-slate-800 text-white",
  },
  rejected: {
    kicker: "Reject request",
    title: "Confirm rejection",
    Icon: XCircle,
    iconWrap: "bg-rose-50 text-rose-700 ring-rose-100",
    kickerClass: "text-rose-700",
    confirmLabel: "Reject request",
    confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
  },
};

export function ReconciliationReviewModal({
  open,
  onOpenChange,
  row,
  decision,
  saving,
  onConfirm,
}: Props) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setReviewNote("");
    requestAnimationFrame(() => noteRef.current?.focus());
  }, [open, row?.id, decision]);

  if (!decision) return null;

  const theme = THEME[decision];
  const { Icon } = theme;

  const attendanceDate = formatAttendanceDateShort(row?.attendanceDate);
  const checkInLabel = formatAttendanceHhmm12h(row?.requestedCheckInTime);

  const handleClose = () => {
    if (!saving) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        showClose={false}
        className="max-w-[560px] gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl"
      >
        <div className="flex max-h-[min(85vh,640px)] flex-col">
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
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
                    theme.iconWrap,
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      theme.kickerClass,
                    )}
                  >
                    {theme.kicker}
                  </p>
                  <DialogTitle className="mt-0.5 text-left text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">
                    {theme.title}
                  </DialogTitle>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-6 py-4">
              <MetaTile
                icon={UserRound}
                label="Employee"
                value={row?.requesterName ?? "—"}
                subtitle={row?.requesterEmail}
              />
              <MetaTile icon={CalendarDays} label="Date" value={attendanceDate} />
              <MetaTile
                icon={Clock}
                label="Check-in"
                value={checkInLabel}
                valueClassName="tabular-nums"
              />
            </div>

            <div className="space-y-2 px-6 pb-4">
              <p className="text-[13px] font-semibold text-slate-800">Submitted reason</p>
              <div className="rounded-xl border border-slate-100 bg-[#f8f9fb] px-3.5 py-3">
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {row?.reason?.trim() || "—"}
                </p>
                {row?.applicantNote?.trim() ? (
                  <p className="mt-2 border-t border-slate-200/80 pt-2 text-[12px] leading-relaxed text-slate-500">
                    {row.applicantNote}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 px-6 py-5">
              <label htmlFor="review-note" className="text-[13px] font-semibold text-slate-800">
                Review note
                <span className="ml-1 text-[12px] font-normal text-slate-400">(optional)</span>
              </label>
              <Textarea
                ref={noteRef}
                id="review-note"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  decision === "approved"
                    ? "Add a note for the employee…"
                    : "Explain why this request was rejected…"
                }
                rows={3}
                disabled={saving}
                className={cn(
                  "min-h-[88px] resize-none rounded-xl border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400",
                  "focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
                )}
              />
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
              type="button"
              onClick={() => onConfirm(reviewNote)}
              disabled={saving}
              className={cn(
                "h-8 rounded-lg px-4 text-[13px] font-semibold shadow-sm disabled:opacity-50",
                theme.confirmClass,
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                theme.confirmLabel
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
