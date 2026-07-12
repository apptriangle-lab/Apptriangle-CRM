import { useState } from "react";
import { format } from "date-fns";
import { Calendar, ChevronDown } from "lucide-react";
import {
  PmsTaskDatePicker,
  formatPmsDateForApi,
  parsePmsDate,
} from "@/components/pms/PmsTaskDatePicker";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  /** Earliest year in the sidebar list (default: current year − 100). */
  minYear?: number;
  /** Latest year in the sidebar list (default: current year + 10). */
  maxYear?: number;
};

export function HrProfileDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  allowClear = true,
  className,
  minYear,
  maxYear,
}: Props) {
  const [open, setOpen] = useState(false);
  const date = parsePmsDate(value);
  const hasValue = Boolean(date);
  const currentYear = new Date().getFullYear();

  return (
    <PmsTaskDatePicker
      endOnly
      modal={false}
      sidebarMode="years"
      yearRange={{
        from: minYear ?? currentYear - 100,
        to: maxYear ?? currentYear + 10,
      }}
      allowClear={allowClear}
      clearLabel="Clear date"
      open={open}
      onOpenChange={setOpen}
      value={{ startDate: null, endDate: date }}
      onChange={(next) => {
        const api = formatPmsDateForApi(next.endDate);
        onChange(api ?? undefined);
      }}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-slate-50",
          hasValue
            ? "border-indigo-200 bg-indigo-50/40 text-indigo-950 hover:bg-indigo-50/60"
            : "text-slate-600",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{date ? format(date, "MMM d, yyyy") : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </PmsTaskDatePicker>
  );
}
