import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CRM_TASKS_COL_GRID,
  CRM_TASKS_LIST_HPAD,
  CRM_TASKS_TABLE_MIN_W,
  CRM_TASKS_TITLE_PL,
} from "@/components/tasks/crmTasksListStyles";

const COLUMNS = [
  "Title",
  "Due Date",
  "Remaining",
  "Status",
  "Company",
  "Assign To",
  "Assign By",
] as const;

const SKELETON_ROW_COUNT = 10;

function CrmTasksListSkeletonRow({ index }: { index: number }) {
  const titleWidth = ["w-[72%]", "w-[58%]", "w-[84%]", "w-[65%]", "w-[76%]"][index % 5];

  return (
    <div
      className={cn(
        CRM_TASKS_COL_GRID,
        "border-b border-slate-100 py-2.5",
      )}
    >
      <Skeleton className={cn("h-4 bg-slate-100", CRM_TASKS_TITLE_PL, titleWidth)} />
      <Skeleton className="h-4 w-14 bg-slate-100" />
      <Skeleton className="h-4 w-10 bg-slate-100" />
      <Skeleton className="h-6 w-[5.5rem] rounded-full bg-slate-100" />
      <div className="flex min-w-0 items-center gap-1.5">
        <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm bg-slate-100" />
        <Skeleton className="h-4 min-w-0 flex-1 max-w-[8rem] bg-slate-100" />
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <Skeleton className="h-5 w-5 shrink-0 rounded-full bg-slate-100" />
        <Skeleton className="h-4 min-w-0 flex-1 max-w-[6rem] bg-slate-100" />
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <Skeleton className="h-5 w-5 shrink-0 rounded-full bg-slate-100" />
        <Skeleton className="h-4 min-w-0 flex-1 max-w-[6rem] bg-slate-100" />
      </div>
    </div>
  );
}

export function CrmTasksListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={CRM_TASKS_TABLE_MIN_W}>
          <div
            className={cn(
              CRM_TASKS_COL_GRID,
              CRM_TASKS_LIST_HPAD,
              "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm",
            )}
          >
            <span className={CRM_TASKS_TITLE_PL}>
              {COLUMNS[0]} <Skeleton className="ml-1 inline-block h-3 w-6 align-middle bg-slate-200" />
            </span>
            {COLUMNS.slice(1).map((col) => (
              <span key={col} className="truncate">
                {col}
              </span>
            ))}
          </div>

          <div className={CRM_TASKS_LIST_HPAD}>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <CrmTasksListSkeletonRow key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
