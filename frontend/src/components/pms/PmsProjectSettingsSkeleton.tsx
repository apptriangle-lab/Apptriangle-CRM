import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TAB_LABELS = ["Project team", "Deleted tasks", "Danger zone"] as const;

function SettingsMemberRowSkeleton({ index }: { index: number }) {
  const nameWidth = ["w-32", "w-28", "w-36", "w-24"][index % 4];

  return (
    <div className="flex items-center gap-3 bg-card/50 px-4 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-slate-100" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn("h-4 bg-slate-100", nameWidth)} />
        <Skeleton className="h-3 w-40 bg-slate-100" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0 rounded-lg bg-slate-100" />
    </div>
  );
}

export function PmsProjectSettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-20 bg-slate-100" />
              <Skeleton className="h-8 w-56 max-w-full bg-slate-100" />
              <Skeleton className="h-4 w-72 max-w-full bg-slate-100" />
              <div className="flex flex-wrap gap-2 pt-1">
                <Skeleton className="h-6 w-20 rounded-lg bg-slate-100" />
                <Skeleton className="h-6 w-24 rounded-lg bg-slate-100" />
                <Skeleton className="h-4 w-28 bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Skeleton className="h-16 w-full rounded-2xl bg-slate-100" />

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex gap-6 border-b border-slate-200 px-5 sm:px-6">
          {TAB_LABELS.map((label) => (
            <div key={label} className="flex items-center gap-2 py-4">
              <Skeleton className="h-4 w-4 rounded bg-slate-100" />
              <Skeleton className="h-4 w-24 bg-slate-100" />
            </div>
          ))}
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28 bg-slate-100" />
              <Skeleton className="h-4 w-64 max-w-full bg-slate-100" />
            </div>
            <Skeleton className="h-9 w-32 rounded-xl bg-slate-100" />
          </div>

          <div className="mb-4 flex -space-x-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full bg-slate-100 ring-2 ring-card" />
            ))}
          </div>

          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80">
            {Array.from({ length: 4 }, (_, i) => (
              <SettingsMemberRowSkeleton key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
