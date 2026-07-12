import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const METRIC_COUNT = 7;
const TASK_ROW_WIDTHS = ["w-[72%]", "w-[58%]", "w-[80%]", "w-[65%]"] as const;

function MetricCardSkeleton({ index }: { index: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16 bg-slate-100" />
          <Skeleton className="h-8 w-12 bg-slate-100" />
          {index === 4 && <Skeleton className="h-4 w-14 rounded-full bg-slate-100" />}
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function TaskRowSkeleton({ index }: { index: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
      <Skeleton className={cn("h-4 bg-slate-100", TASK_ROW_WIDTHS[index % TASK_ROW_WIDTHS.length])} />
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-3 w-16 bg-slate-100" />
        <Skeleton className="h-5 w-16 rounded-md bg-slate-100" />
      </div>
    </div>
  );
}

function SectionCardSkeleton({
  titleWidth,
  rowCount = 3,
}: {
  titleWidth: string;
  rowCount?: number;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="space-y-1 border-b border-border/60 px-5 pb-3 pt-5">
        <Skeleton className={cn("h-5 bg-slate-100", titleWidth)} />
        <Skeleton className="h-3 w-40 bg-slate-100" />
      </div>
      <div className="space-y-2 p-5">
        {Array.from({ length: rowCount }, (_, i) => (
          <TaskRowSkeleton key={i} index={i} />
        ))}
      </div>
    </div>
  );
}

export function PmsProjectDashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 bg-slate-100" />
          <Skeleton className="h-8 w-56 max-w-full bg-slate-100" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-6 w-20 rounded-lg bg-slate-100" />
            <Skeleton className="h-6 w-16 rounded-lg bg-slate-100" />
            <Skeleton className="h-4 w-28 bg-slate-100" />
          </div>
          <Skeleton className="h-3 w-36 bg-slate-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20 rounded-xl bg-slate-100" />
          <Skeleton className="h-9 w-24 rounded-xl bg-slate-100" />
          <Skeleton className="h-9 w-36 rounded-xl bg-slate-100" />
        </div>
      </div>

      <Skeleton className="h-14 w-full rounded-2xl bg-slate-100" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: METRIC_COUNT }, (_, i) => (
          <MetricCardSkeleton key={i} index={i} />
        ))}
      </div>

      <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="space-y-1 border-b border-border/60 px-5 pb-3 pt-5">
          <Skeleton className="h-5 w-32 bg-slate-100" />
          <Skeleton className="h-3 w-48 bg-slate-100" />
        </div>
        <div className="flex h-[260px] items-end gap-3 px-6 pb-6 pt-8">
          {(["h-24", "h-36", "h-20", "h-32", "h-28"] as const).map((height, i) => (
            <Skeleton key={i} className={cn("flex-1 rounded-t-lg bg-slate-100", height)} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCardSkeleton titleWidth="w-20" />
        <SectionCardSkeleton titleWidth="w-24" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCardSkeleton titleWidth="w-36" rowCount={2} />
        <SectionCardSkeleton titleWidth="w-24" />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-32 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
