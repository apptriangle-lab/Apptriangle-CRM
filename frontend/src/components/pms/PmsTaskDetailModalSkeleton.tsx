import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT_PROPERTIES = ["Status", "Start date", "End date", "Assignees"] as const;
const RIGHT_PROPERTIES = ["Priority", "Sprint"] as const;

function PropertyRowSkeleton({ labelWidth = "w-16" }: { labelWidth?: string }) {
  return (
    <div className="flex min-h-[48px] items-center border-b border-slate-100 py-2.5">
      <div className="flex w-[132px] shrink-0 items-center gap-2.5">
        <Skeleton className="h-4 w-4 shrink-0 rounded bg-slate-100" />
        <Skeleton className={cn("h-4 bg-slate-100", labelWidth)} />
      </div>
      <Skeleton className="h-4 w-24 bg-slate-100" />
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="mb-5 flex gap-3">
      <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-full max-w-[280px] bg-slate-100" />
        <Skeleton className="ml-auto h-3 w-20 bg-slate-100" />
      </div>
    </div>
  );
}

type Props = {
  shortId?: string;
  onClose?: () => void;
};

export function PmsTaskDetailModalSkeleton({ shortId, onClose }: Props) {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-[1.65] flex-col border-r border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded bg-slate-100" />
            <Skeleton className="h-4 w-8 bg-slate-100" />
            {shortId ? (
              <span className="font-mono text-xs text-slate-300">{shortId}</span>
            ) : (
              <Skeleton className="h-3 w-14 bg-slate-100" />
            )}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <Skeleton className="h-8 w-8 rounded-md bg-slate-100" />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
          <Skeleton className="mt-2 h-9 w-[72%] max-w-md bg-slate-100" />

          <div className="mt-6 grid grid-cols-2 gap-x-14">
            <div>
              {LEFT_PROPERTIES.map((_, i) => (
                <PropertyRowSkeleton key={i} labelWidth={i === 3 ? "w-20" : "w-16"} />
              ))}
            </div>
            <div>
              {RIGHT_PROPERTIES.map((_, i) => (
                <PropertyRowSkeleton key={i} labelWidth={i === 0 ? "w-14" : "w-12"} />
              ))}
              <PropertyRowSkeleton labelWidth="w-20" />
            </div>
          </div>

          <div className="mt-8 border-b border-slate-200">
            <div className="flex gap-6">
              <Skeleton className="mb-3 h-4 w-14 bg-slate-100" />
              <Skeleton className="mb-3 h-4 w-16 bg-slate-100" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-24 bg-slate-100" />
            <Skeleton className="h-[100px] w-full rounded-md bg-slate-100" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28 rounded-md bg-slate-100" />
              <Skeleton className="h-8 w-20 rounded-md bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-8 py-3">
          <Skeleton className="h-8 w-28 rounded-md bg-slate-100" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <Skeleton className="h-5 w-16 bg-slate-100" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {Array.from({ length: 3 }, (_, i) => (
            <ActivityItemSkeleton key={i} />
          ))}
        </div>

        <div className="border-t border-slate-200 p-4">
          <Skeleton className="h-[72px] w-full rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
