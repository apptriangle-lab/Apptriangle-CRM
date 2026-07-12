import { endOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import type { LunchDateRange } from "@/components/lunch/lunchDateRangeUtils";
import { currentMonthDateRange, hasLunchDateRange } from "@/components/lunch/lunchDateRangeUtils";
import { cn } from "@/lib/utils";

type Props = {
  value: LunchDateRange;
  onChange: (range: LunchDateRange) => void;
  sidebarMode?: "years" | "months";
  accent?: "default" | "orange";
};

export function LunchDateRangeFilter({ value, onChange, sidebarMode = "months", accent = "default" }: Props) {
  const [open, setOpen] = useState(false);

  const pmsDateRange = useMemo<PmsDateRange>(
    () => ({
      startDate: value.from ?? null,
      endDate: value.to ?? null,
    }),
    [value.from, value.to],
  );

  const filtered = hasLunchDateRange(value);

  return (
    <PmsTaskDatePicker
      value={pmsDateRange}
      onChange={(next) =>
        onChange({
          from: next.startDate ?? undefined,
          to: next.endDate ?? undefined,
        })
      }
      rangeSelect
      hideRangeFields
      clearAtBottom
      clearLabel="Clear range"
      allowClear={sidebarMode === "months" || sidebarMode === "years"}
      sidebarMode={sidebarMode}
      yearRange={sidebarMode === "years" ? { from: 2020, to: new Date().getFullYear() + 1 } : undefined}
      monthRange={
        sidebarMode === "months"
          ? { from: new Date(2020, 0, 1), to: endOfMonth(new Date()) }
          : undefined
      }
      onClear={sidebarMode === "months" ? () => onChange(currentMonthDateRange()) : undefined}
      open={open}
      onOpenChange={setOpen}
      modal
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border bg-white px-3 text-[13px] font-medium transition-colors",
          accent === "orange"
            ? cn(
                "border-stone-200 text-stone-700 hover:bg-orange-50/50",
                filtered && "border-orange-300 bg-orange-50/60 text-orange-900 hover:bg-orange-50",
              )
            : cn(
                "border-slate-200 text-slate-700 hover:bg-slate-50",
                filtered && "border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50",
              ),
        )}
      >
        <Calendar
          className={cn("h-4 w-4 shrink-0", accent === "orange" ? "text-orange-600" : "text-indigo-600")}
        />
        <span className="max-w-[200px] truncate">
          {filtered ? formatDueDateRangeLabel(pmsDateRange) : "Date range"}
        </span>
        {filtered ? (
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              accent === "orange" ? "bg-orange-500" : "bg-violet-500",
            )}
          />
        ) : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </PmsTaskDatePicker>
  );
}
