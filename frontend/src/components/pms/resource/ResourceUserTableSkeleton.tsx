import { Skeleton } from "@/components/ui/skeleton";
import {
  RESOURCE_CONTRIBUTION_DAYS,
  RESOURCE_USER_TABLE_GRID_CLASS,
} from "@/components/pms/resource/resourceContributionDays";
import { cn } from "@/lib/utils";

const SKELETON_ROW_COUNT = 7;

const NAME_WIDTHS = ["w-28", "w-36", "w-24", "w-32", "w-28", "w-32", "w-26"] as const;

function ResourceUserTableSkeletonRow({ index }: { index: number }) {
  const nameWidth = NAME_WIDTHS[index % NAME_WIDTHS.length];

  return (
    <div
      className={cn(
        "col-span-full flex w-full items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0",
        "md:grid md:grid-cols-subgrid md:items-center md:gap-x-3",
      )}
    >
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
      <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-slate-100 md:ml-2" />
      <div className="min-w-0 flex-1 space-y-1.5 md:flex-none">
        <Skeleton className={cn("h-4 bg-slate-100", nameWidth)} />
        <Skeleton className="h-3 w-40 bg-slate-100" />
      </div>
      <div
        className="hidden min-w-0 w-full md:grid md:gap-1"
        style={{ gridTemplateColumns: `repeat(${RESOURCE_CONTRIBUTION_DAYS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: RESOURCE_CONTRIBUTION_DAYS }, (_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "aspect-square w-full rounded-sm bg-slate-100",
              i % 7 === 0 && "opacity-70",
            )}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 md:justify-end">
        <Skeleton className="h-7 w-[4.5rem] rounded-full bg-slate-100" />
        <Skeleton className="h-7 w-[4rem] rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export function ResourceUserTableSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-slate-100" />
          <Skeleton className="h-3 w-64 max-w-full bg-slate-100" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-table">
        <div className={RESOURCE_USER_TABLE_GRID_CLASS}>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
            <ResourceUserTableSkeletonRow key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
