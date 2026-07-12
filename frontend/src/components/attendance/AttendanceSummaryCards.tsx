import { Briefcase, Calendar } from "lucide-react";
import type { ShiftDto } from "@/lib/api";
import {
  AttendancePeriodReportCardSkeleton,
  AttendanceShiftCardSkeleton,
} from "@/components/attendance/AttendanceSummaryCardSkeletons";
import {
  ATTENDANCE_CARD,
  ATTENDANCE_META_LABEL,
  ATTENDANCE_META_VALUE,
  ATTENDANCE_SECTION_TITLE,
} from "@/components/attendance/attendanceConstants";
import { cn } from "@/lib/utils";

type PeriodStats = {
  label: string;
  records: number;
  present: number;
  late: number;
  absent: number;
};

const COMPACT_TILE = "rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2";

type ShiftCardProps = {
  myShift: ShiftDto | null;
  formatShiftTime: (value?: string | null) => string;
  className?: string;
  loading?: boolean;
};

export function AttendanceShiftCard({
  myShift,
  formatShiftTime,
  className,
  loading = false,
}: ShiftCardProps) {
  if (loading) {
    return <AttendanceShiftCardSkeleton className={className} />;
  }

  return (
    <div className={cn(ATTENDANCE_CARD, "flex h-full flex-col p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Briefcase className="h-3.5 w-3.5" />
        </div>
        <h3 className={ATTENDANCE_SECTION_TITLE}>Shift details</h3>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        <div className={COMPACT_TILE}>
          <p className={ATTENDANCE_META_LABEL}>Name</p>
          <p className={cn(ATTENDANCE_META_VALUE, "mt-0.5 truncate text-[12px]")}>
            {myShift?.name ?? "Not assigned"}
          </p>
        </div>
        <div className={COMPACT_TILE}>
          <p className={ATTENDANCE_META_LABEL}>Start</p>
          <p className={cn(ATTENDANCE_META_VALUE, "mt-0.5 tabular-nums text-[12px]")}>
            {formatShiftTime(myShift?.startTime)}
          </p>
        </div>
        <div className={COMPACT_TILE}>
          <p className={ATTENDANCE_META_LABEL}>End</p>
          <p className={cn(ATTENDANCE_META_VALUE, "mt-0.5 tabular-nums text-[12px]")}>
            {formatShiftTime(myShift?.endTime)}
          </p>
        </div>
      </div>
    </div>
  );
}

type PeriodCardProps = {
  periodStats: PeriodStats;
  className?: string;
  loading?: boolean;
};

export function AttendancePeriodReportCard({
  periodStats,
  className,
  loading = false,
}: PeriodCardProps) {
  if (loading) {
    return <AttendancePeriodReportCardSkeleton className={className} />;
  }

  return (
    <div className={cn(ATTENDANCE_CARD, "flex h-full flex-col p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 text-sky-600">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <h3 className={cn(ATTENDANCE_SECTION_TITLE, "truncate")}>{periodStats.label} report</h3>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
        <div className={COMPACT_TILE}>
          <p className={ATTENDANCE_META_LABEL}>Records</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
            {periodStats.records}
          </p>
        </div>
        <div className="rounded-md border border-emerald-100 bg-emerald-50/70 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">Present</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-700">
            {periodStats.present}
          </p>
        </div>
        <div className="rounded-md border border-amber-100 bg-amber-50/70 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Late</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-amber-700">
            {periodStats.late}
          </p>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50/70 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">Absent</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-rose-700">
            {periodStats.absent}
          </p>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use AttendanceShiftCard + AttendancePeriodReportCard */
export function AttendanceSummaryCards({
  myShift,
  formatShiftTime,
  periodStats,
}: {
  myShift: ShiftDto | null;
  formatShiftTime: (value?: string | null) => string;
  periodStats: PeriodStats;
}) {
  return (
    <>
      <AttendanceShiftCard myShift={myShift} formatShiftTime={formatShiftTime} />
      <AttendancePeriodReportCard periodStats={periodStats} />
    </>
  );
}
