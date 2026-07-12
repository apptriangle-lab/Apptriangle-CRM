import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CRM_TASK_DETAIL_CARD } from "./taskDetailsConstants";

function PillSkeleton() {
  return <Skeleton className="h-7 w-24 rounded-md bg-slate-100" />;
}

function ActivityRowSkeleton({ index }: { index: number }) {
  const width = ["w-[70%]", "w-[55%]", "w-[80%]", "w-[62%]"][index % 4];

  return (
    <div className="relative pb-4 pl-7 last:pb-0">
      <Skeleton className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-200" />
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Skeleton className={cn("h-3.5 bg-slate-100", width)} />
          <Skeleton className="h-3 w-20 bg-slate-100" />
          <Skeleton className="ml-auto h-3 w-24 bg-slate-100" />
        </div>
        <Skeleton className="mt-2 h-3 w-2/3 bg-slate-100" />
      </div>
    </div>
  );
}

function PropertyRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <Skeleton className="h-3 w-16 bg-slate-100" />
      <Skeleton className="h-4 w-24 bg-slate-100" />
    </div>
  );
}

export function TaskDetailsSkeleton() {
  return (
    <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Skeleton className="h-5 w-20 bg-slate-100" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-lg bg-slate-100" />
            <Skeleton className="h-8 w-[4.5rem] rounded-lg bg-slate-100" />
          </div>
        </div>

        <div className="px-5 pb-4 sm:px-6">
          <Skeleton className="h-8 w-[min(100%,28rem)] bg-slate-100 sm:h-9" />
          <Skeleton className="mt-2 h-8 w-[min(100%,20rem)] bg-slate-100 sm:h-9" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PillSkeleton />
            <PillSkeleton />
            <Skeleton className="h-7 w-20 rounded-md bg-slate-100" />
            <PillSkeleton />
            <PillSkeleton />
            <Skeleton className="h-7 w-32 rounded-md bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className={cn(CRM_TASK_DETAIL_CARD, "shrink-0")}>
              <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
                <Skeleton className="h-3 w-24 bg-slate-100" />
              </div>
              <div className="space-y-2 px-5 py-4 sm:px-6">
                <Skeleton className="h-3.5 w-full bg-slate-100" />
                <Skeleton className="h-3.5 w-[92%] bg-slate-100" />
                <Skeleton className="h-3.5 w-[78%] bg-slate-100" />
              </div>
            </div>

            <div className={cn(CRM_TASK_DETAIL_CARD, "flex min-h-0 flex-1 basis-0 flex-col overflow-hidden")}>
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-6">
                <Skeleton className="h-3 w-16 bg-slate-100" />
                <Skeleton className="h-5 w-6 rounded-full bg-slate-100" />
              </div>
              <div className="min-h-0 flex-1 px-5 py-4 sm:px-6">
                <div className="relative space-y-0">
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />
                  {Array.from({ length: 5 }, (_, i) => (
                    <ActivityRowSkeleton key={i} index={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 md:w-72">
            <div className={CRM_TASK_DETAIL_CARD}>
              <div className="border-b border-slate-100 px-4 py-3">
                <Skeleton className="h-3 w-20 bg-slate-100" />
              </div>
              <div className="px-4 py-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <PropertyRowSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
