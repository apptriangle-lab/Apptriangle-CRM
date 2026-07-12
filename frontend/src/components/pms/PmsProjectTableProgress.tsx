import type { ComponentType } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PmsProjectProgressStats } from "@/lib/pmsProjectProgress";
import { CheckCircle2, CircleDashed, Ban } from "lucide-react";

type Props = {
  stats: PmsProjectProgressStats;
};

function progressBarColor(pct: number): string {
  if (pct >= 100) {
    return "bg-[#2ecd6f] dark:bg-emerald-500";
  }
  if (pct <= 0) {
    return "bg-transparent";
  }
  return "bg-[#7b68ee] dark:bg-violet-500";
}

function progressLabelColor(pct: number): string {
  if (pct >= 100) {
    return "text-[#1a7f4b] dark:text-emerald-400";
  }
  if (pct <= 0) {
    return "text-muted-foreground/70";
  }
  return "text-[#5b4fc7] dark:text-violet-400";
}

function PmsProjectProgressTooltipContent({
  stats,
  pct,
}: {
  stats: PmsProjectProgressStats;
  pct: number;
}) {
  const {
    totalTaskCount,
    completedTaskCount,
    cancelledTaskCount,
    nonCancelledTaskCount,
  } = stats;
  const remainingTaskCount = Math.max(0, nonCancelledTaskCount - completedTaskCount);

  return (
    <div className="w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Task progress
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p
            className={cn(
              "text-2xl font-bold tabular-nums leading-none tracking-tight",
              progressLabelColor(pct),
            )}
          >
            {pct}%
          </p>
          {nonCancelledTaskCount > 0 ? (
            <p className="pb-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {completedTaskCount}/{nonCancelledTaskCount} done
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "relative mt-2.5 h-1.5 overflow-hidden rounded-full",
            "bg-[#eceef0] ring-1 ring-inset ring-black/[0.04]",
            "dark:bg-slate-700/80 dark:ring-white/[0.06]",
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
              progressBarColor(pct),
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-1 p-2">
        {totalTaskCount === 0 ? (
          <p className="px-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
            No tasks in this project yet.
          </p>
        ) : (
          <>
            <TooltipStatRow
              icon={CheckCircle2}
              iconClassName="text-emerald-600 dark:text-emerald-400"
              label="Completed"
              value={completedTaskCount}
            />
            <TooltipStatRow
              icon={CircleDashed}
              iconClassName="text-violet-600 dark:text-violet-400"
              label="Remaining"
              value={remainingTaskCount}
            />
            {cancelledTaskCount > 0 ? (
              <TooltipStatRow
                icon={Ban}
                iconClassName="text-slate-400 dark:text-slate-500"
                label="Cancelled"
                value={cancelledTaskCount}
                muted
              />
            ) : null}
            <div className="mx-2 mt-1 border-t border-slate-100 pt-2 dark:border-slate-800">
              <div className="flex items-center justify-between px-0.5 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Total tasks</span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {totalTaskCount}
                </span>
              </div>
              {cancelledTaskCount > 0 ? (
                <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                  Cancelled tasks are excluded from progress.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TooltipStatRow({
  icon: Icon,
  iconClassName,
  label,
  value,
  muted = false,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
        muted ? "opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} />
        <span className="text-[12px] text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function PmsProjectTableProgress({ stats }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(stats.progressPercentage)));

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className="group mt-2 flex w-full min-w-[6.5rem] max-w-[8.5rem] cursor-default items-center gap-2 outline-none"
          aria-label={`${pct}% of tasks completed`}
        >
          <div
            className={cn(
              "relative h-[5px] min-w-0 flex-1 overflow-hidden rounded-full",
              "bg-[#eceef0] ring-1 ring-inset ring-black/[0.04]",
              "dark:bg-slate-800/80 dark:ring-white/[0.06]",
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
                progressBarColor(pct),
                pct > 0 && pct < 100 && "shadow-[0_0_6px_rgba(123,104,238,0.35)]",
                pct >= 100 && "shadow-[0_0_6px_rgba(46,205,111,0.3)]",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 text-[11px] font-semibold tabular-nums leading-none tracking-tight",
              progressLabelColor(pct),
            )}
          >
            {pct}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <PmsProjectProgressTooltipContent stats={stats} pct={pct} />
      </TooltipContent>
    </Tooltip>
  );
}
