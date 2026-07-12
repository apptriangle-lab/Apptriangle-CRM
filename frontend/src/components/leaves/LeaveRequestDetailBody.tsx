import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Download, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { LeaveDto } from "@/lib/api";
import {
  durationTypeLabel,
  halfDayPeriodLabel,
  isHalfDayLeaveDetail,
  normalizeHalfDayPeriodValue,
} from "@/lib/leaveDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";

function LeaveStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="bg-orange-500/10 text-orange-600 border-orange-500/20"
        >
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 border-green-500/20"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 border-red-500/20"
        >
          <XCircle className="h-3 w-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export type LeaveRequestDetailVariant = "employee" | "admin";

type Props = {
  leave: LeaveDto;
  getDayCount: (l: LeaveDto) => number | undefined;
  daysLoading: boolean;
  /** Shown at top when set (e.g. HR viewing another user). */
  employeeName?: string | null;
  variant?: LeaveRequestDetailVariant;
  footer?: ReactNode;
};

export function LeaveRequestDetailBody({
  leave,
  getDayCount,
  daysLoading,
  employeeName,
  variant = "employee",
  footer,
}: Props) {
  const halfMissingHint =
    variant === "admin"
      ? "Not recorded for this request."
      : "Not recorded for this request. Edit the leave (if still pending) and choose First half or Second half, or apply again.";

  const halfNorm = normalizeHalfDayPeriodValue(leave.halfDayPeriod);
  const showHalfMeta = isHalfDayLeaveDetail(leave);
  const sameCalendarDay = leave.startDate === leave.endDate;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {employeeName != null && employeeName !== "" && (
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Employee
            </Label>
            <div className="text-base font-semibold">{employeeName}</div>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Leave Type
          </Label>
          <div className="text-base font-semibold">
            <Badge
              variant="outline"
              className="bg-primary/5 border-primary/20 text-primary"
            >
              {leave.leaveTypeName}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </Label>
          <div>
            <LeaveStatusBadge status={leave.status} />
          </div>
        </div>
        {(Number(leave.additionalLeaveDays) || 0) > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Additional leave</span>
              <span className="text-amber-800/90 dark:text-amber-300/90">
                {" "}
                —{" "}
                {(() => {
                  const n = Number(leave.additionalLeaveDays) || 0;
                  const label =
                    Number.isInteger(n) ? String(n) : n.toFixed(1);
                  return `${label} day${n === 1 ? "" : "s"} beyond remaining quota for this leave type.`;
                })()}
              </span>
            </div>
          </div>
        )}
        <div className="space-y-2 min-w-0">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Duration
          </Label>
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold">
                {durationTypeLabel(leave.durationType)}
              </span>
              {showHalfMeta && halfNorm ? (
                <>
                  <span
                    className="text-muted-foreground/70 text-sm select-none"
                    aria-hidden
                  >
                    ·
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2 py-0.5 h-6 bg-primary/5 border-primary/25 text-primary shrink-0"
                  >
                    {halfDayPeriodLabel(leave.halfDayPeriod)}
                  </Badge>
                </>
              ) : null}
            </div>
            {showHalfMeta && !halfNorm ? (
              <p className="text-xs text-muted-foreground leading-snug">
                {halfMissingHint}
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {sameCalendarDay ? "Date" : "Dates"}
          </Label>
          <div className="text-base font-semibold tabular-nums leading-snug">
            {sameCalendarDay ? (
              format(parseISO(leave.startDate), "MMM d, yyyy")
            ) : (
              <>
                <span>{format(parseISO(leave.startDate), "MMM d, yyyy")}</span>
                <span className="text-muted-foreground font-normal mx-1.5">
                  –
                </span>
                <span>{format(parseISO(leave.endDate), "MMM d, yyyy")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Leave count
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Working days — weekends and company holidays excluded
            </p>
          </div>
          <div className="text-left sm:text-right tabular-nums shrink-0">
            {(() => {
              const n = getDayCount(leave);
              if (n !== undefined) {
                return (
                  <span>
                    <span className="text-2xl font-bold text-primary">
                      {n === 0.5 ? "0.5" : n}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1.5">
                      {n === 0.5 || n === 1 ? "day" : "days"}
                    </span>
                  </span>
                );
              }
              return daysLoading ? (
                <Loader className="h-5 w-5 animate-spin inline-block" />
              ) : (
                <span className="text-muted-foreground">—</span>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reason
        </Label>
        <div className="text-sm bg-muted/30 p-4 rounded-xl border border-border/60">
          {leave.reason}
        </div>
      </div>

      {leave.attachmentFileName && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attachment
          </Label>
          <Button
            variant="outline"
            onClick={() => {
              if (leave.attachmentData) {
                const link = document.createElement("a");
                link.href = leave.attachmentData;
                link.download = leave.attachmentFileName || "attachment";
                link.click();
              }
            }}
            className="w-full justify-start"
          >
            <Download className="h-4 w-4 mr-2" />
            {leave.attachmentFileName}
          </Button>
        </div>
      )}

      {leave.status === "rejected" && leave.rejectionReason && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Rejection Reason
          </Label>
          <div className="text-sm bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {leave.rejectionReason}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Applied On
          </Label>
          <div className="text-sm text-muted-foreground">
            {leave.createdAt
              ? format(parseISO(leave.createdAt), "MMM d, yyyy 'at' h:mm a")
              : "—"}
          </div>
        </div>
        {leave.status !== "pending" && leave.approvedByName && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {leave.status === "approved" ? "Approved By" : "Rejected By"}
            </Label>
            <div className="text-sm text-muted-foreground">
              {leave.approvedByName}
            </div>
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
