import { useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { LunchWhatsAppPoll } from "@/components/lunch/LunchWhatsAppPoll";
import { LunchMonthlyBalanceCard } from "@/components/lunch/LunchMonthlyBalanceCard";
import { LunchHistoryModal } from "@/components/lunch/LunchHistoryModal";
import { LunchUserPageHeader } from "@/components/lunch/LunchUserPageHeader";
import type { LunchDateRange } from "@/components/lunch/lunchDateRangeUtils";
import {
  currentMonthKey,
  lunchDateRangeToMonthKey,
  monthKeyToLunchDateRange,
} from "@/components/lunch/lunchMonthUtils";
import { cn } from "@/lib/utils";

type Props = {
  onBalanceChange?: (balance: number) => void;
  adminLayout?: boolean;
};

export function LunchUserHomePanel({ onBalanceChange, adminLayout = false }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [historyDateRange, setHistoryDateRange] = useState<LunchDateRange>(() =>
    monthKeyToLunchDateRange(currentMonthKey()),
  );

  const handleSelectedMonthChange = (month: string) => {
    setSelectedMonth(month);
    setHistoryDateRange(monthKeyToLunchDateRange(month));
  };

  const handleHistoryDateRangeChange = (range: LunchDateRange) => {
    setHistoryDateRange(range);
    const monthKey = lunchDateRangeToMonthKey(range);
    if (monthKey) setSelectedMonth(monthKey);
  };

  return (
    <div className={cn("flex w-full flex-col gap-8", !adminLayout && "mx-auto max-w-[928px]")}>
      <LunchUserPageHeader />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-6 xl:gap-8">
        <section className="w-full min-w-0 max-w-xl shrink-0">
          <LunchWhatsAppPoll onBalanceChange={onBalanceChange} />
        </section>

        <aside className="flex w-full min-w-0 flex-col gap-4 lg:w-[300px] lg:shrink-0 xl:w-[320px] lg:sticky lg:top-0 lg:self-start">
          <LunchMonthlyBalanceCard
            selectedMonth={selectedMonth}
            onSelectedMonthChange={handleSelectedMonthChange}
            onBalanceLoaded={onBalanceChange}
          />

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-stone-200/90 bg-white p-4 text-left shadow-[0_2px_12px_rgba(28,25,23,0.04)] transition hover:border-orange-200 hover:shadow-[0_4px_16px_rgba(251,146,60,0.1)]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100 transition group-hover:bg-orange-100">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">Vote history</p>
              <p className="mt-0.5 text-xs text-stone-500">Your meals & balance — one entry per day</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:text-orange-600" />
          </button>
        </aside>
      </div>

      <LunchHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        dateRange={historyDateRange}
        onDateRangeChange={handleHistoryDateRangeChange}
      />
    </div>
  );
}
