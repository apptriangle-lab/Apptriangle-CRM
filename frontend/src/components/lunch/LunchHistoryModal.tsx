import { useMemo } from "react";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LunchDateRangeFilter } from "@/components/lunch/LunchDateRangeFilter";
import { LunchVoteHistoryPanel } from "@/components/lunch/LunchVoteHistoryPanel";
import {
  currentMonthDateRange,
  lastMonthDateRange,
  lastSevenDaysRange,
  lunchDateRangeToIso,
  type LunchDateRange,
} from "@/components/lunch/lunchDateRangeUtils";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: LunchDateRange;
  onDateRangeChange: (range: LunchDateRange) => void;
};

const PRESETS: { label: string; range: () => LunchDateRange }[] = [
  { label: "This month", range: currentMonthDateRange },
  { label: "Last 7 days", range: lastSevenDaysRange },
  { label: "Last month", range: lastMonthDateRange },
];

export function LunchHistoryModal({ open, onOpenChange, dateRange, onDateRangeChange }: Props) {
  const isoRange = useMemo(() => lunchDateRangeToIso(dateRange), [dateRange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-1.25rem)] max-w-5xl gap-0 overflow-hidden rounded-3xl border-stone-200/80 p-0 shadow-[0_8px_30px_rgba(251,146,60,0.12)] sm:w-[calc(100vw-2.5rem)] [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-lg [&>button]:p-2 [&>button]:hover:bg-orange-50">
        <DialogHeader className="relative overflow-hidden border-b border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white px-5 py-4 pr-14 sm:px-6 sm:pr-16">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-orange-200/25 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
                <History className="h-4 w-4" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-bold text-stone-900">Vote history</DialogTitle>
                <p className="text-xs text-stone-500">Your votes and balance changes per poll</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {PRESETS.map(({ label, range }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onDateRangeChange(range())}
                    className="rounded-lg border border-orange-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <LunchDateRangeFilter
                value={dateRange}
                onChange={onDateRangeChange}
                sidebarMode="months"
                accent="orange"
              />
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(85vh-5rem)] overflow-y-auto overflow-x-hidden overscroll-contain bg-[#FFFBF7] p-3 sm:p-4 scrollbar-thinner">
          {isoRange.from && isoRange.to ? (
            <LunchVoteHistoryPanel embedded userTheme from={isoRange.from} to={isoRange.to} />
          ) : (
            <p className={cn("py-12 text-center text-sm text-stone-500")}>Select a date range to view votes.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
