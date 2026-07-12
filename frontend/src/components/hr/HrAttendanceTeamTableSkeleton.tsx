import { Skeleton } from "@/components/ui/skeleton";
import {
  HR_ATT_TEAM_COL_GRID,
  HR_ATT_TEAM_COLUMNS,
  HR_ATT_TEAM_DATE_PL,
  HR_ATT_TEAM_LIST_HPAD,
  HR_ATT_TEAM_TABLE_MIN_W,
} from "@/components/hr/hrAttendanceTeamTableStyles";
import { cn } from "@/lib/utils";

const ROW_COUNT = 10;

function HrAttendanceTeamSkeletonRow({ index }: { index: number }) {
  const nameWidth = ["w-[72%]", "w-[58%]", "w-[84%]", "w-[65%]", "w-[76%]"][index % 5];

  return (
    <div className={cn(HR_ATT_TEAM_COL_GRID, "border-b border-slate-100 py-2.5")}>
      <Skeleton className={cn("h-4 bg-slate-100", HR_ATT_TEAM_DATE_PL, "w-24")} />
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className={cn("h-4 bg-slate-100", nameWidth)} />
          <Skeleton className="h-3 w-32 bg-slate-100" />
        </div>
      </div>
      <Skeleton className="h-4 w-20 bg-slate-100" />
      <Skeleton className="h-4 w-16 bg-slate-100" />
      <Skeleton className="h-4 w-16 bg-slate-100" />
      <Skeleton className="h-6 w-[5.5rem] rounded-full bg-slate-100" />
    </div>
  );
}

type Props = {
  /** Include title bar matching HrAttendanceTeamTable shell. */
  withShell?: boolean;
};

export function HrAttendanceTeamTableSkeleton({ withShell = false }: Props) {
  const tableBody = (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
      <div className={HR_ATT_TEAM_TABLE_MIN_W}>
        <div
          className={cn(
            HR_ATT_TEAM_COL_GRID,
            HR_ATT_TEAM_LIST_HPAD,
            "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm",
          )}
        >
          {HR_ATT_TEAM_COLUMNS.map((col) => (
            <span key={col} className={col === "Date" ? HR_ATT_TEAM_DATE_PL : undefined}>
              {col}
            </span>
          ))}
        </div>

        <div className={HR_ATT_TEAM_LIST_HPAD}>
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <HrAttendanceTeamSkeletonRow key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  );

  if (!withShell) {
    return tableBody;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-2.5 sm:px-6">
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-44 bg-slate-100" />
          <Skeleton className="h-3 w-56 bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg bg-slate-100" />
      </div>
      {tableBody}
    </div>
  );
}

export function HrAttendanceTeamFilterBarSkeleton() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Skeleton className="h-8 w-40 rounded-lg bg-slate-100" />
      <Skeleton className="h-8 w-28 rounded-lg bg-slate-100" />
      <Skeleton className="h-8 w-32 rounded-lg bg-slate-100" />
      <Skeleton className="h-8 w-36 rounded-lg bg-slate-100" />
      <Skeleton className="h-8 w-44 rounded-lg bg-slate-100" />
      <Skeleton className="ml-auto h-8 w-24 rounded-lg bg-slate-100" />
    </div>
  );
}
