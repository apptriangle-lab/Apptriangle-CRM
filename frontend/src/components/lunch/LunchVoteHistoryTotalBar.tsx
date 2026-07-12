import { formatBalanceDisplay } from "@/lib/lunchApi";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  dayCount: number;
  userTheme?: boolean;
  className?: string;
};

export function LunchVoteHistoryTotalBar({ total, dayCount, userTheme = false, className }: Props) {
  const isNegative = total < 0;
  const isPositive = total > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5",
        userTheme
          ? "border-orange-200/70 bg-gradient-to-r from-orange-50/80 to-amber-50/40 shadow-sm"
          : "border-slate-200 bg-slate-50/80",
        className,
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Total for range</p>
        <p className="mt-0.5 text-xs text-stone-500">
          {dayCount} day{dayCount === 1 ? "" : "s"} with votes
        </p>
      </div>
      <p
        className={cn(
          "text-xl font-bold tabular-nums tracking-tight",
          isNegative ? "text-rose-600" : isPositive ? "text-emerald-600" : "text-stone-800",
        )}
      >
        {formatBalanceDisplay(total)}
      </p>
    </div>
  );
}
