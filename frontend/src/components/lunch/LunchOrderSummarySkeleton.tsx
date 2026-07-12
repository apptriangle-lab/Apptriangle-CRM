import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_OPTIONS_COL_GRID,
  LUNCH_ORDER_TABLE_HEAD,
  LUNCH_ORDER_TITLE_PL,
  LUNCH_ORDER_VOTERS_COL_GRID,
} from "@/components/lunch/lunchOrderSummaryStyles";

const OPTIONS_ROW_COUNT = 5;
const VOTERS_ROW_COUNT = 6;

function OptionsSkeletonRow({ index }: { index: number }) {
  const titleWidth = ["w-[70%]", "w-[55%]", "w-[80%]", "w-[62%]", "w-[74%]"][index % 5];

  return (
    <div className={cn(LUNCH_ORDER_OPTIONS_COL_GRID, LUNCH_ORDER_LIST_HPAD, "border-b border-orange-50 py-2.5")}>
      <Skeleton className={cn("h-4 bg-slate-100", LUNCH_ORDER_TITLE_PL, titleWidth)} />
      <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
      <Skeleton className="ml-auto h-5 w-6 bg-slate-100" />
      <Skeleton className="h-2 w-full rounded-full bg-slate-100" />
    </div>
  );
}

function VotersSkeletonRow({ index }: { index: number }) {
  const nameWidth = ["w-[65%]", "w-[50%]", "w-[72%]", "w-[58%]", "w-[68%]", "w-[54%]"][index % 6];

  return (
    <div className={cn(LUNCH_ORDER_VOTERS_COL_GRID, LUNCH_ORDER_LIST_HPAD, "border-b border-orange-50 py-2.5")}>
      <div className={cn("flex items-center gap-2.5", LUNCH_ORDER_TITLE_PL)}>
        <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
        <Skeleton className={cn("h-4 bg-slate-100", nameWidth)} />
      </div>
      <Skeleton className="h-4 w-24 bg-slate-100" />
      <Skeleton className="h-6 w-16 rounded-full bg-slate-100" />
      <Skeleton className="h-4 w-12 bg-slate-100" />
    </div>
  );
}

export function LunchOrderSummaryOptionsBodySkeleton() {
  return (
    <>
      {Array.from({ length: OPTIONS_ROW_COUNT }).map((_, i) => (
        <OptionsSkeletonRow key={i} index={i} />
      ))}
    </>
  );
}

export function LunchOrderSummaryVotersBodySkeleton() {
  return (
    <>
      {Array.from({ length: VOTERS_ROW_COUNT }).map((_, i) => (
        <VotersSkeletonRow key={i} index={i} />
      ))}
    </>
  );
}

export function LunchOrderSummaryOptionsTableSkeleton() {
  return (
    <div className={LUNCH_ORDER_CARD}>
      <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32 bg-slate-100" />
          <Skeleton className="h-3 w-40 bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="w-full min-w-0">
          <div
            className={cn(
              LUNCH_ORDER_OPTIONS_COL_GRID,
              LUNCH_ORDER_LIST_HPAD,
              LUNCH_ORDER_TABLE_HEAD,
            )}
          >
            <Skeleton className={cn("h-3 w-24 bg-slate-200", LUNCH_ORDER_TITLE_PL)} />
            <Skeleton className="h-3 w-10 bg-slate-200" />
            <Skeleton className="ml-auto h-3 w-10 bg-slate-200" />
            <Skeleton className="h-3 w-12 bg-slate-200" />
          </div>
          <LunchOrderSummaryOptionsBodySkeleton />
        </div>
      </div>
    </div>
  );
}

export function LunchOrderSummaryVotersTableSkeleton() {
  return (
    <div className={LUNCH_ORDER_CARD}>
      <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28 bg-slate-100" />
          <Skeleton className="h-3 w-44 bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="w-full min-w-0">
          <div
            className={cn(
              LUNCH_ORDER_VOTERS_COL_GRID,
              LUNCH_ORDER_LIST_HPAD,
              LUNCH_ORDER_TABLE_HEAD,
            )}
          >
            <Skeleton className={cn("h-3 w-24 bg-slate-200", LUNCH_ORDER_TITLE_PL)} />
            <Skeleton className="h-3 w-14 bg-slate-200" />
            <Skeleton className="h-3 w-10 bg-slate-200" />
            <Skeleton className="h-3 w-12 bg-slate-200" />
          </div>
          <LunchOrderSummaryVotersBodySkeleton />
        </div>
      </div>
    </div>
  );
}

export function LunchOrderSummaryStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-orange-100/80 bg-white p-4 shadow-[0_2px_12px_rgba(251,146,60,0.06)]">
          <Skeleton className="mb-3 h-9 w-9 rounded-lg bg-slate-100" />
          <Skeleton className="mb-2 h-3 w-20 bg-slate-100" />
          <Skeleton className="h-7 w-12 bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/** Full page skeleton — initial load */
export function LunchOrderSummarySkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 bg-slate-100" />
          <Skeleton className="h-4 w-72 max-w-full bg-slate-100" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-48 rounded-lg bg-slate-100" />
          <Skeleton className="h-9 w-44 rounded-lg bg-slate-100" />
          <Skeleton className="h-9 w-28 rounded-lg bg-slate-100" />
        </div>
      </div>

      <Skeleton className="h-11 w-full shrink-0 rounded-lg bg-slate-100" />

      <div className="shrink-0">
        <LunchOrderSummaryStatsSkeleton />
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:gap-4 xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch">
        <LunchOrderSummaryOptionsTableSkeleton />
        <LunchOrderSummaryVotersTableSkeleton />
      </div>
    </div>
  );
}
