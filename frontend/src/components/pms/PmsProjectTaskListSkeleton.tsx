import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PMS_TASK_COL_GRID, PMS_TASK_LIST_HPAD } from "@/components/pms/pmsTaskListStyles";

const STATUS_GROUPS = [
  { header: "bg-indigo-50", pill: "bg-indigo-100", rows: 4 },
  { header: "bg-sky-50", pill: "bg-sky-100", rows: 3 },
  { header: "bg-emerald-50", pill: "bg-emerald-100", rows: 2 },
] as const;

const TITLE_WIDTHS = ["w-[68%]", "w-[52%]", "w-[78%]", "w-[61%]", "w-[70%]"] as const;

function PmsTaskListSkeletonRow({ index, indent = 0 }: { index: number; indent?: number }) {
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length];

  return (
    <div
      className={cn(
        PMS_TASK_COL_GRID,
        "border-b border-slate-100 py-2.5",
        PMS_TASK_LIST_HPAD,
      )}
      style={indent > 0 ? { paddingLeft: `${24 + indent * 20}px` } : undefined}
    >
      <div className="flex min-w-0 items-center gap-1.5 pl-1">
        <Skeleton className="h-4 w-4 shrink-0 rounded bg-slate-100" />
        {indent === 0 && index % 3 === 0 ? (
          <Skeleton className="h-5 w-5 shrink-0 rounded bg-slate-100" />
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <Skeleton className="h-4 w-4 shrink-0 rounded-full bg-slate-100" />
        <Skeleton className={cn("h-4 bg-slate-100", titleWidth)} />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-6 w-[5.5rem] rounded-md bg-slate-100" />
      </div>
      <Skeleton className="mx-auto h-4 w-14 bg-slate-100" />
      <div className="flex justify-center">
        <Skeleton className="h-7 w-7 rounded-full bg-slate-100" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-7 w-7 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function PmsTaskListSkeletonGroup({
  headerClass,
  pillClass,
  rowCount,
  groupIndex,
}: {
  headerClass: string;
  pillClass: string;
  rowCount: number;
  groupIndex: number;
}) {
  return (
    <section className="border-b border-slate-100">
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2",
          headerClass,
        )}
      >
        <Skeleton className="h-4 w-4 rounded bg-slate-200/80" />
        <Skeleton className={cn("h-5 w-20 rounded-md", pillClass)} />
        <Skeleton className="h-3 w-4 rounded bg-slate-200/70" />
      </div>
      <div className="mt-2.5 mb-4">
        {Array.from({ length: rowCount }, (_, i) => (
          <PmsTaskListSkeletonRow key={i} index={groupIndex * 10 + i} />
        ))}
        {groupIndex === 0 && (
          <PmsTaskListSkeletonRow index={99} indent={1} />
        )}
      </div>
    </section>
  );
}

export function PmsProjectTaskListSkeleton() {
  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col bg-white text-slate-900">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-[9.5rem] rounded-lg bg-slate-100" />
          <Skeleton className="h-8 w-[7.5rem] rounded-lg bg-slate-100" />
          <Skeleton className="h-8 w-[8rem] rounded-lg bg-slate-100" />
          <Skeleton className="h-8 min-w-[180px] max-w-xs flex-1 rounded-lg bg-slate-100" />
          <Skeleton className="ml-auto h-8 w-[6.5rem] rounded-md bg-slate-100" />
        </div>
      </div>

      <div
        className={cn(
          PMS_TASK_COL_GRID,
          PMS_TASK_LIST_HPAD,
          "shrink-0 border-b border-slate-200 bg-slate-50/90 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
        )}
      >
        <span className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded bg-slate-200" />
          Name
        </span>
        <span>Status</span>
        <span className="min-w-0 truncate">Dates</span>
        <span className="text-center">Assignee</span>
        <span className="text-center">Created by</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-white">
        {STATUS_GROUPS.map((group, i) => (
          <PmsTaskListSkeletonGroup
            key={i}
            headerClass={group.header}
            pillClass={group.pill}
            rowCount={group.rows}
            groupIndex={i}
          />
        ))}
      </div>
    </div>
  );
}
