import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { cn } from "@/lib/utils";

type Props = {
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  onOpenChange?: (open: boolean) => void;
};

export function LeaveFilterDateRangePicker({
  dateRange,
  onDateRangeChange,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const pmsDateRange = useMemo<PmsDateRange>(
    () => ({
      startDate: dateRange.from ?? null,
      endDate: dateRange.to ?? null,
    }),
    [dateRange.from, dateRange.to],
  );
  const hasDateFilter = Boolean(pmsDateRange.startDate || pmsDateRange.endDate);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <PmsTaskDatePicker
      value={pmsDateRange}
      onChange={(next) =>
        onDateRangeChange({
          from: next.startDate ?? undefined,
          to: next.endDate ?? undefined,
        })
      }
      rangeSelect
      hideRangeFields
      clearAtBottom
      clearLabel="All dates"
      open={open}
      onOpenChange={handleOpenChange}
      modal
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50",
          hasDateFilter && "border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50",
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-indigo-600" />
        <span className="max-w-[180px] truncate">
          {hasDateFilter ? formatDueDateRangeLabel(pmsDateRange) : "Date range"}
        </span>
        {hasDateFilter ? <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" /> : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </PmsTaskDatePicker>
  );
}
