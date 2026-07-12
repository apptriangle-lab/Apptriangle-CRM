import { Skeleton } from "@/components/ui/skeleton";
import { ATTENDANCE_CARD } from "@/components/attendance/attendanceConstants";
import { cn } from "@/lib/utils";

const TILE = "rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2";

export function AttendanceActionCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32 bg-slate-100" />
          <Skeleton className="h-3 w-36 bg-slate-100" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={TILE}>
          <Skeleton className="h-2.5 w-14 bg-slate-100" />
          <Skeleton className="mt-2 h-6 w-16 bg-slate-100" />
        </div>
        <div className={TILE}>
          <Skeleton className="h-2.5 w-14 bg-slate-100" />
          <Skeleton className="mt-2 h-6 w-16 bg-slate-100" />
        </div>
      </div>

      <div className="mt-auto border-t border-slate-100 pt-3">
        <Skeleton className="h-8 w-full rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

export function AttendanceShiftCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(ATTENDANCE_CARD, "flex h-full flex-col p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-md bg-slate-100" />
        <Skeleton className="h-3 w-24 bg-slate-100" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={TILE}>
            <Skeleton className="h-2.5 w-10 bg-slate-100" />
            <Skeleton className="mt-2 h-4 w-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendancePeriodReportCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(ATTENDANCE_CARD, "flex h-full flex-col p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-md bg-slate-100" />
        <Skeleton className="h-3 w-36 bg-slate-100" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={TILE}>
            <Skeleton className="h-2.5 w-12 bg-slate-100" />
            <Skeleton className="mt-2 h-5 w-8 bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
