import { format, parseISO } from "date-fns";
import { Check, Download, Wallet } from "lucide-react";
import type { LeaveDto } from "@/lib/api";
import type { LeaveApprovalBalancePreview } from "@/lib/leaveBalancePreview";
import { formatLeaveDays } from "@/lib/leaveBalancePreview";
import {
  durationTypeLabel,
  halfDayPeriodLabel,
  isHalfDayLeaveDetail,
  normalizeHalfDayPeriodValue,
} from "@/lib/leaveDisplay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  leaveConfirmAppliedOnClass,
  leaveConfirmBalanceAfterClass,
  leaveConfirmBalanceCardClass,
  leaveConfirmBodyRootClass,
  leaveConfirmDetailsSectionClass,
  leaveConfirmHeaderIconInnerClass,
  leaveConfirmHeaderIconWrapClass,
  leaveConfirmReasonBoxClass,
  leaveConfirmReasonTextClass,
  leaveConfirmSubtitleClass,
  leaveConfirmTitleClass,
} from "@/components/leaves/leaveConfirmModalStyles";

type Props = {
  leave: LeaveDto;
  loading?: boolean;
  requestedDays?: number;
  balance?: LeaveApprovalBalancePreview | null;
};

function DetailField({
  label,
  value,
  valueClassName,
  className,
  bold = true,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  className?: string;
  bold?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p
        className={cn(
          "text-sm leading-snug text-slate-800 [@media(max-height:820px)]:text-[13px]",
          bold ? "font-bold text-slate-900" : "font-normal",
          valueClassName,
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ApproveSkeleton() {
  return (
    <div className={leaveConfirmBodyRootClass} aria-busy="true" aria-label="Loading leave details">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-9 w-14 justify-self-end" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="mx-auto h-3 w-44" />
    </div>
  );
}

export function LeaveApproveConfirmBody({ leave, loading = false, requestedDays, balance }: Props) {
  if (loading) {
    return <ApproveSkeleton />;
  }

  const sameCalendarDay = leave.startDate === leave.endDate;
  const halfNorm = normalizeHalfDayPeriodValue(leave.halfDayPeriod);
  const showHalfMeta = isHalfDayLeaveDetail(leave);

  const periodLabel = sameCalendarDay
    ? format(parseISO(leave.startDate), "MMM d, yyyy")
    : `${format(parseISO(leave.startDate), "MMM d")} – ${format(parseISO(leave.endDate), "MMM d, yyyy")}`;

  const durationLabel =
    showHalfMeta && halfNorm
      ? `${durationTypeLabel(leave.durationType)} · ${halfDayPeriodLabel(leave.halfDayPeriod)}`
      : durationTypeLabel(leave.durationType);

  const countLabel =
    requestedDays !== undefined
      ? `${formatLeaveDays(requestedDays)} ${requestedDays === 0.5 || requestedDays === 1 ? "day" : "days"}`
      : "—";

  const reasonText = leave.reason?.trim() || "—";

  const credited = balance?.credited ?? 0;
  const remainingNow = balance?.remaining ?? 0;
  const remainingAfter = balance?.remainingAfterApproval ?? 0;
  const progressPct =
    credited > 0 ? Math.min(100, Math.max(0, (remainingAfter / credited) * 100)) : 0;

  const appliedOn = leave.createdAt
    ? format(parseISO(leave.createdAt), "MMM d, yyyy • h:mm a")
    : null;

  return (
    <div className={leaveConfirmBodyRootClass}>
      <div className="flex flex-col items-center text-center">
        <div className={cn(leaveConfirmHeaderIconWrapClass, "bg-emerald-50")}>
          <div className={cn(leaveConfirmHeaderIconInnerClass, "bg-emerald-800")}>
            <Check className="h-4 w-4 text-white stroke-[2.5]" />
          </div>
        </div>
        <h2 className={leaveConfirmTitleClass}>Confirm Approval</h2>
        <p className={leaveConfirmSubtitleClass}>
          Please review and confirm the leave request for{" "}
          <span className="font-bold text-slate-800">{leave.userName}</span>.
        </p>
      </div>

      <div className={leaveConfirmDetailsSectionClass}>
        <div className="grid grid-cols-2 gap-x-4">
          <DetailField label="Leave type" value={leave.leaveTypeName} />
          <DetailField label="Duration" value={durationLabel} bold={false} />
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <DetailField label={sameCalendarDay ? "Date" : "Period"} value={periodLabel} bold={false} />
          <div className="min-w-0 text-right">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Count</p>
            <p className="text-sm font-bold leading-snug text-emerald-600 [@media(max-height:820px)]:text-[13px]">
              {countLabel}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Reason</p>
          <div className={leaveConfirmReasonBoxClass}>
            <p className={leaveConfirmReasonTextClass} title={reasonText}>
              &ldquo;{reasonText}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {balance ? (
        <div className={leaveConfirmBalanceCardClass}>
          <div className="mb-2.5 flex items-center gap-1.5 [@media(max-height:820px)]:mb-2">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Balance status</p>
          </div>

          <div className="mb-2.5 flex items-end justify-between gap-3 [@media(max-height:820px)]:mb-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">Currently available</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 [@media(max-height:820px)]:text-sm">
                {formatLeaveDays(remainingNow)} {remainingNow === 1 ? "day" : "days"}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[11px] text-slate-500">After approval</p>
              <p className={cn(leaveConfirmBalanceAfterClass, "text-emerald-700")}>
                {formatLeaveDays(remainingAfter)} {remainingAfter === 1 ? "day" : "days"} left
              </p>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 [@media(max-height:820px)]:h-1">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
            <span>0 days</span>
            <span>
              {formatLeaveDays(credited)} {credited === 1 ? "day" : "days"} credited
            </span>
          </div>

          {(balance.additionalOutstanding > 0 || balance.additionalIfApproved > 0) && (
            <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[10px] leading-snug text-slate-600 [@media(max-height:820px)]:text-[9px]">
              {balance.additionalOutstanding > 0 ? (
                <p className="line-clamp-1" title={`${formatLeaveDays(balance.additionalOutstanding)} additional days already approved.`}>
                  {formatLeaveDays(balance.additionalOutstanding)} additional day
                  {balance.additionalOutstanding === 1 ? "" : "s"} already approved.
                </p>
              ) : null}
              {balance.additionalIfApproved > 0 ? (
                <p className="line-clamp-1" title={`Approving adds ${formatLeaveDays(balance.additionalIfApproved)} days beyond quota.`}>
                  Approving adds {formatLeaveDays(balance.additionalIfApproved)} day
                  {balance.additionalIfApproved === 1 ? "" : "s"} beyond quota.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500">No balance configured for this leave type.</p>
      )}

      {appliedOn ? <p className={leaveConfirmAppliedOnClass}>Applied On: {appliedOn}</p> : null}

      {leave.attachmentFileName ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full border-slate-200 text-[11px] text-slate-600"
          onClick={() => {
            if (leave.attachmentData) {
              const link = document.createElement("a");
              link.href = leave.attachmentData;
              link.download = leave.attachmentFileName || "attachment";
              link.click();
            }
          }}
        >
          <Download className="mr-1.5 h-3 w-3 shrink-0" />
          <span className="truncate">{leave.attachmentFileName}</span>
        </Button>
      ) : null}
    </div>
  );
}
