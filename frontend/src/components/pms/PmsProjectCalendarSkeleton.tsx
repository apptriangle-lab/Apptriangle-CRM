import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_ROWS = 6;

function CalendarDayCellSkeleton({ index }: { index: number }) {
  const hasChips = index % 4 === 1 || index % 5 === 2;
  const chipCount = index % 3 === 0 ? 2 : 1;
  const weekend = index % 7 === 5 || index % 7 === 6;

  return (
    <div
      className={cn(
        "flex min-h-[100px] flex-col border-b border-r border-zinc-200/70 p-1.5 sm:min-h-[120px] sm:p-2",
        weekend ? "bg-zinc-200/45" : "bg-white",
      )}
    >
      <Skeleton className="mb-1 h-6 w-6 rounded-full bg-slate-100" />
      {hasChips && (
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: chipCount }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full rounded-md bg-slate-100" />
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarSidePanelSkeleton() {
  return (
    <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden border-l border-slate-200/90 bg-[#f4f5f7] lg:flex xl:w-[340px]">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">
        <Skeleton className="h-3 w-20 bg-slate-100" />
        <Skeleton className="mt-2 h-4 w-28 bg-slate-100" />
        <Skeleton className="mt-1 h-3 w-24 bg-slate-100" />
      </div>
      <div className="space-y-2 px-3 py-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[10px] bg-slate-100" />
        ))}
      </div>
    </aside>
  );
}

export function PmsProjectCalendarSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24 bg-slate-100" />
          <Skeleton className="h-3 w-48 bg-slate-100" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-14 rounded-lg bg-slate-100" />
          <Skeleton className="h-8 w-[7.5rem] rounded-lg bg-slate-100" />
          <Skeleton className="h-8 w-[5.5rem] rounded-lg bg-slate-100" />
          <Skeleton className="h-8 w-8 rounded-lg bg-slate-100" />
          <Skeleton className="h-4 w-[8.75rem] bg-slate-100" />
          <Skeleton className="h-8 w-8 rounded-lg bg-slate-100" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-zinc-100/50 p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-100/80">
              {WEEKDAY_LABELS.map((label) => {
                const isWeekend = label === "Fri" || label === "Sat";
                return (
                  <div
                    key={label}
                    className={cn(
                      "border-r border-zinc-200 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide last:border-r-0",
                      isWeekend ? "bg-zinc-200/60 text-zinc-400" : "bg-zinc-100/80 text-zinc-600",
                    )}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: GRID_ROWS * 7 }, (_, i) => (
                <CalendarDayCellSkeleton key={i} index={i} />
              ))}
            </div>
          </div>
        </div>
        <CalendarSidePanelSkeleton />
      </div>
    </div>
  );
}
