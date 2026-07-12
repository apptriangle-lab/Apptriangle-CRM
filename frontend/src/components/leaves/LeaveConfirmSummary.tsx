import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
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

type Props = {
  leave: LeaveDto;
  action: "approve" | "reject";
  loading?: boolean;
  requestedDays?: number;
  balance?: LeaveApprovalBalancePreview | null;
};

function MetaChip({
  label,
  value,
  className,
  noTruncate,
}: {
  label: string;
  value: string;
  className?: string;
  noTruncate?: boolean;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "text-xs font-semibold text-slate-900",
          noTruncate ? "leading-snug" : "truncate",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function LeaveConfirmSummarySkeleton({ action }: { action: "approve" | "reject" }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading leave details">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-[46px] rounded-lg" />
          <Skeleton className="h-[46px] rounded-lg" />
        </div>
        <div className="grid grid-cols-12 gap-2">
          <Skeleton className="col-span-9 h-[46px] rounded-lg sm:col-span-10" />
          <Skeleton className="col-span-3 h-[46px] rounded-lg sm:col-span-2" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-lg" />
      {action === "approve" ? <Skeleton className="h-7 w-3/4 rounded-md" /> : null}
    </div>
  );
}

export function LeaveConfirmSummary({
  leave,
  action,
  loading = false,
  requestedDays,
  balance,
}: Props) {
  if (loading) {
    return <LeaveConfirmSummarySkeleton action={action} />;
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

  const daysLabel =
    requestedDays !== undefined
      ? `${formatLeaveDays(requestedDays)} ${requestedDays === 0.5 || requestedDays === 1 ? "day" : "days"}`
      : "—";

  const reasonText = leave.reason?.trim() || "—";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <MetaChip label="Type" value={leave.leaveTypeName} noTruncate />
          <MetaChip label="Duration" value={durationLabel} noTruncate />
        </div>
        <div className="grid grid-cols-12 gap-2">
          <MetaChip
            label={sameCalendarDay ? "Date" : "Period"}
            value={periodLabel}
            className="col-span-9 sm:col-span-10"
            noTruncate
          />
          <MetaChip label="Days" value={daysLabel} className="col-span-3 sm:col-span-2" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reason</p>
        <p
          className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-800"
          title={reasonText}
        >
          {reasonText}
        </p>
      </div>

      {balance ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">Balance</span>
          <span className="tabular-nums">
            <span className="text-slate-500">Credited </span>
            <span className="font-bold text-slate-900">{formatLeaveDays(balance.credited)}</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums">
            <span className="text-slate-500">Left </span>
            <span className="font-bold text-slate-900">{formatLeaveDays(balance.remaining)}</span>
          </span>
          {action === "approve" && requestedDays !== undefined ? (
            <>
              <span className="text-slate-300">·</span>
              <span className="tabular-nums">
                <span className="text-slate-500">After </span>
                <span className="font-bold text-slate-900">{formatLeaveDays(balance.remainingAfterApproval)}</span>
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-xs font-medium text-slate-500">No balance configured for this leave type.</p>
      )}

      {(balance?.additionalOutstanding ?? 0) > 0 ? (
        <p
          className="truncate text-[11px] font-medium text-amber-800"
          title={`Already has ${formatLeaveDays(balance!.additionalOutstanding)} additional day(s) approved.`}
        >
          Already {formatLeaveDays(balance!.additionalOutstanding)} additional day
          {balance!.additionalOutstanding === 1 ? "" : "s"} on record.
        </p>
      ) : null}

      {action === "approve" && (balance?.additionalIfApproved ?? 0) > 0 ? (
        <p
          className="truncate text-[11px] font-semibold text-orange-800"
          title={`Approving uses ${formatLeaveDays(balance!.additionalIfApproved)} day(s) beyond quota.`}
        >
          +{formatLeaveDays(balance!.additionalIfApproved)} day
          {balance!.additionalIfApproved === 1 ? "" : "s"} additional if approved.
        </p>
      ) : null}

      {leave.attachmentFileName ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          onClick={() => {
            if (leave.attachmentData) {
              const link = document.createElement("a");
              link.href = leave.attachmentData;
              link.download = leave.attachmentFileName || "attachment";
              link.click();
            }
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          <span className="max-w-[200px] truncate">{leave.attachmentFileName}</span>
        </Button>
      ) : null}
    </div>
  );
}
