import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { LunchMonthFilterDropdown } from "@/components/lunch/LunchMonthFilterDropdown";
import { buildMonthOptions, currentMonthKey } from "@/components/lunch/lunchMonthUtils";
import { useLunchMonthBalanceQuery } from "@/features/lunch/useLunchMonthBalanceQuery";
import { useLunchSnapshotQuery } from "@/features/lunch/useLunchSnapshotQuery";
import { formatBalanceDisplay } from "@/lib/lunchApi";
import { cn } from "@/lib/utils";

type Props = {
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  onBalanceLoaded?: (balance: number) => void;
};

export function LunchMonthlyBalanceCard({
  selectedMonth,
  onSelectedMonthChange,
  onBalanceLoaded,
}: Props) {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const isCurrentMonth = selectedMonth === currentMonthKey();

  const { data: monthData, isLoading: monthLoading } = useLunchMonthBalanceQuery(selectedMonth);
  // Share the same snapshot query as the poll (current date + current month).
  const { data: snapshot } = useLunchSnapshotQuery();

  const selectedLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label ??
    format(new Date(selectedMonth + "-01T12:00:00"), "MMMM yyyy");

  const monthNetChange = isCurrentMonth
    ? (snapshot?.monthTotal?.amount ?? snapshot?.monthNetChange ?? monthData?.monthNetChange ?? 0)
    : (monthData?.monthNetChange ?? 0);

  const walletBalance = isCurrentMonth
    ? (snapshot?.monthTotal?.wallet ?? snapshot?.balance ?? monthData?.balance ?? null)
    : (monthData?.balance ?? null);

  useEffect(() => {
    if (walletBalance != null && isCurrentMonth) {
      onBalanceLoaded?.(walletBalance);
    }
  }, [walletBalance, isCurrentMonth, onBalanceLoaded]);

  const loading = isCurrentMonth ? !snapshot && monthLoading : monthLoading && !monthData;
  const monthTotalValue = monthNetChange ?? 0;
  const isPositive = monthTotalValue > 0;
  const isNegative = monthTotalValue < 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-200/50 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/30 p-5 shadow-[0_4px_20px_rgba(251,146,60,0.08)] sm:p-6">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-200/25 blur-xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {isCurrentMonth ? "This month total" : "Lunch balance"}
        </p>
        <LunchMonthFilterDropdown
          value={selectedMonth}
          options={monthOptions}
          onChange={onSelectedMonthChange}
          align="end"
        />
      </div>

      <div className="relative mt-5">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        ) : (
          <>
            <p
              className={cn(
                "text-[2rem] font-bold tabular-nums leading-none tracking-tight sm:text-[2.25rem]",
                isNegative ? "text-rose-600" : isPositive ? "text-emerald-600" : "text-stone-900",
              )}
            >
              {formatBalanceDisplay(monthTotalValue)}
            </p>
            {monthTotalValue !== 0 && (
              <span
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                  isNegative
                    ? "bg-rose-50 text-rose-700 ring-rose-200/70"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
                )}
              >
                {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {isNegative ? "Amount owed" : "In credit"}
              </span>
            )}
          </>
        )}
      </div>

      <div className="relative mt-5 border-t border-orange-100/80 pt-4">
        <p className="text-[11px] leading-relaxed text-stone-500">
          {isCurrentMonth
            ? `Total lunch balance for ${selectedLabel}. Matches vote history for this month.`
            : `Net change for ${selectedLabel}. Open history for a full daily log.`}
        </p>
      </div>
    </div>
  );
}
