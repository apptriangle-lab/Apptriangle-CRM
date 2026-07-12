import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  isValid,
  nextMonday,
  nextSaturday,
  parseISO,
  setHours,
  setMinutes,
  setYear,
  startOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatResourceRangeMonthLabel } from "@/utils/pmsResourceDates";
import { useNonPassiveWheel } from "@/hooks/useNonPassiveWheel";

export type PmsDateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

type QuickPick = {
  id: string;
  label: string;
  hint: string;
  getDate: () => Date;
};

function buildQuickPicks(now: Date): QuickPick[] {
  const later = setMinutes(setHours(startOfDay(now), 12), 44);
  const thisSat = nextSaturday(now);
  const nextMon = nextMonday(addDays(now, 1));
  const nextSat = addDays(thisSat, 7);
  return [
    { id: "today", label: "Today", hint: format(now, "EEE"), getDate: () => startOfDay(now) },
    { id: "later", label: "Later", hint: format(later, "h:mm a"), getDate: () => later },
    { id: "tomorrow", label: "Tomorrow", hint: format(addDays(now, 1), "EEE"), getDate: () => startOfDay(addDays(now, 1)) },
    { id: "weekend", label: "This weekend", hint: format(thisSat, "EEE"), getDate: () => startOfDay(thisSat) },
    { id: "next-week", label: "Next week", hint: format(nextMon, "EEE"), getDate: () => startOfDay(nextMon) },
    { id: "next-weekend", label: "Next weekend", hint: format(nextSat, "d MMM"), getDate: () => startOfDay(nextSat) },
    { id: "2w", label: "2 weeks", hint: format(addWeeks(now, 2), "d MMM"), getDate: () => startOfDay(addWeeks(now, 2)) },
    { id: "4w", label: "4 weeks", hint: format(addWeeks(now, 4), "d MMM"), getDate: () => startOfDay(addWeeks(now, 4)) },
  ];
}

function toInputValue(d: Date | null): string {
  if (!d || !isValid(d)) return "";
  return format(d, "MMM d, yyyy");
}

function buildYearList(from: number, to: number): number[] {
  const years: number[] = [];
  for (let year = to; year >= from; year -= 1) {
    years.push(year);
  }
  return years;
}

function buildMonthList(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(to);
  const start = startOfMonth(from);
  while (cursor >= start) {
    months.push(cursor);
    cursor = subMonths(cursor, 1);
  }
  return months;
}

function monthKey(d: Date): string {
  return format(d, "yyyy-MM");
}

function monthOverlapsRange(monthDate: Date, start: Date | null, end: Date | null): boolean {
  if (!start && !end) return false;
  const rangeStart = start ?? end!;
  const rangeEnd = end ?? start!;
  return rangeStart <= endOfMonth(monthDate) && rangeEnd >= startOfMonth(monthDate);
}

type Props = {
  value: PmsDateRange;
  onChange: (next: PmsDateRange) => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, only end date is shown and updated (no start date UI). */
  endOnly?: boolean;
  /** First calendar click sets start, second sets end (no field tabs). */
  rangeSelect?: boolean;
  /** Set false when used inside a dialog so the popover stays interactive */
  modal?: boolean;
  /** Show a clear option at the top (e.g. filter toolbar). */
  allowClear?: boolean;
  /** Show a clear button below the calendar (rangeSelect only). */
  clearAtBottom?: boolean;
  clearLabel?: string;
  /** Hide start/end date fields above the calendar (rangeSelect only). */
  hideRangeFields?: boolean;
  /** Custom clear handler (e.g. reset to current month instead of empty). */
  onClear?: () => void;
  /** Override disabled state for the bottom clear button. */
  clearDisabled?: boolean;
  /** Left sidebar: quick picks (default), scrollable year list, or scrollable month list. */
  sidebarMode?: "quick" | "years" | "months";
  /** Inclusive year range when sidebarMode is "years". */
  yearRange?: { from: number; to: number };
  /** Inclusive month range when sidebarMode is "months". */
  monthRange?: { from: Date; to?: Date };
};

export function PmsTaskDatePicker({
  value,
  onChange,
  children,
  open,
  onOpenChange,
  endOnly,
  rangeSelect,
  modal = true,
  allowClear,
  clearAtBottom,
  clearLabel = "Clear date",
  hideRangeFields,
  onClear,
  clearDisabled,
  sidebarMode = "quick",
  yearRange,
  monthRange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const pickerOpen = isControlled ? open! : internalOpen;
  const setPickerOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [activeField, setActiveField] = useState<"start" | "end">("end");
  const [month, setMonth] = useState(() => value.endDate ?? new Date());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), [pickerOpen]);
  const quickPicks = useMemo(() => buildQuickPicks(now), [now]);
  const isScrollSidebar = sidebarMode === "years" || sidebarMode === "months";
  const years = useMemo(() => {
    if (sidebarMode !== "years") return [];
    const currentYear = now.getFullYear();
    const from = yearRange?.from ?? currentYear - 100;
    const to = yearRange?.to ?? currentYear + 10;
    return buildYearList(from, to);
  }, [now, sidebarMode, yearRange?.from, yearRange?.to]);
  const months = useMemo(() => {
    if (sidebarMode !== "months") return [];
    const to = startOfMonth(monthRange?.to ?? now);
    const from = startOfMonth(monthRange?.from ?? new Date(now.getFullYear() - 5, 0, 1));
    return buildMonthList(from, to);
  }, [now, sidebarMode, monthRange?.from, monthRange?.to]);
  const activeYear = month.getFullYear();
  const activeMonthKey = monthKey(month);

  const applyDate = (d: Date) => {
    if (rangeSelect) {
      onChange({ startDate: startOfDay(d), endDate: startOfDay(d) });
      return;
    }
    if (endOnly) {
      onChange({ ...value, endDate: d });
      setPickerOpen(false);
      return;
    }
    if (activeField === "start") {
      onChange({ ...value, startDate: d });
    } else {
      onChange({ ...value, endDate: d });
    }
  };

  const applyRangeQuickPick = (q: QuickPick) => {
    const d = startOfDay(q.getDate());
    if (q.id === "2w" || q.id === "4w") {
      onChange({ startDate: startOfDay(now), endDate: d });
      return;
    }
    onChange({ startDate: d, endDate: d });
  };

  const clearRange = () => {
    onChange(endOnly ? { ...value, endDate: null } : { startDate: null, endDate: null });
  };

  const hasRangeValue = endOnly ? Boolean(value.endDate) : Boolean(value.startDate || value.endDate);

  const rangeSelected =
    value.startDate || value.endDate
      ? { from: value.startDate ?? undefined, to: value.endDate ?? undefined }
      : undefined;

  const clearRangeAndClose = () => {
    if (onClear) {
      onClear();
    } else {
      clearRange();
    }
    setPickerOpen(false);
  };

  const isClearDisabled = clearDisabled ?? !hasRangeValue;

  useEffect(() => {
    if (!pickerOpen) return;
    setMonth(value.endDate ?? value.startDate ?? new Date());
  }, [pickerOpen, value.endDate, value.startDate]);

  useEffect(() => {
    if (!pickerOpen || !isScrollSidebar) return;
    requestAnimationFrame(() => {
      const attr = sidebarMode === "years" ? "data-year" : "data-month";
      const key = sidebarMode === "years" ? String(activeYear) : activeMonthKey;
      const target = sidebarRef.current?.querySelector(`[${attr}="${key}"]`);
      target?.scrollIntoView({ block: "center" });
    });
  }, [activeYear, activeMonthKey, pickerOpen, isScrollSidebar, sidebarMode]);

  const handleSidebarWheel = useCallback((event: WheelEvent) => {
    const container = sidebarRef.current;
    if (!container) return;

    const canScrollVertically = container.scrollHeight > container.clientHeight;
    if (!canScrollVertically) return;

    event.preventDefault();
    event.stopPropagation();
    container.scrollTop += event.deltaY;
  }, []);

  useNonPassiveWheel(sidebarRef, handleSidebarWheel, pickerOpen && isScrollSidebar);

  const jumpToYear = (year: number) => {
    setMonth((current) => setYear(current, year));
  };

  const jumpToMonth = (d: Date) => {
    const monthStart = startOfDay(startOfMonth(d));
    const monthEnd = startOfDay(endOfMonth(d));
    setMonth(monthStart);
    if (rangeSelect && sidebarMode === "months") {
      onChange({ startDate: monthStart, endDate: monthEnd });
    }
  };

  const selected = rangeSelect
    ? undefined
    : endOnly
      ? value.endDate
      : activeField === "start"
        ? value.startDate
        : value.endDate;

  const sharedDayPickerClassNames = {
    months: "flex",
    month: "space-y-2",
    caption: "hidden",
    nav: "hidden",
    table: "w-full border-collapse",
    head_row: "flex",
    head_cell: "w-9 text-[11px] font-medium text-slate-400",
    row: "flex w-full mt-1",
    cell: cn(
      "relative h-9 w-9 p-0 text-center text-[13px]",
      rangeSelect &&
        "[&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-range-start)]:rounded-l-full [&:has([aria-selected])]:bg-red-50 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full",
    ),
    day: cn(
      "h-9 w-9 rounded-full p-0 font-normal text-slate-800",
      rangeSelect ? "hover:bg-transparent" : "hover:bg-slate-100",
      !rangeSelect &&
        "aria-selected:bg-[#e5484d] aria-selected:text-white aria-selected:hover:bg-[#e5484d] aria-selected:hover:text-white",
    ),
    day_selected: rangeSelect
      ? ""
      : "bg-[#e5484d] text-white ring-0 hover:bg-[#e5484d] hover:text-white focus:bg-[#e5484d] focus:text-white",
    day_range_start:
      "day-range-start rounded-full bg-[#e5484d] text-white hover:bg-[#e5484d] hover:text-white",
    day_range_end:
      "day-range-end rounded-full bg-[#e5484d] text-white hover:bg-[#e5484d] hover:text-white",
    day_range_middle:
      "rounded-none bg-red-50 text-slate-800 aria-selected:bg-red-50 aria-selected:text-slate-800",
    day_today: cn(
      "font-semibold text-[#e5484d]",
      "ring-1 ring-inset ring-[#e5484d]",
      rangeSelect
        ? "aria-selected:ring-0"
        : "aria-selected:bg-[#e5484d] aria-selected:text-white aria-selected:ring-0",
    ),
    day_outside: "text-slate-300 opacity-60",
    day_disabled: "text-slate-300 opacity-40",
  };

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal={modal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="z-[100] w-auto border-slate-200 p-0 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={isScrollSidebar ? (e) => e.stopPropagation() : undefined}
      >
        <div className="flex overflow-hidden rounded-lg bg-white">
          {/* Sidebar: quick picks or year list */}
          <div
            ref={sidebarRef}
            className={cn(
              "shrink-0 border-r border-slate-200 py-2",
              sidebarMode === "years"
                ? "w-[84px] max-h-[340px] overflow-y-auto overscroll-contain scrollbar-thin"
                : sidebarMode === "months"
                  ? "w-[108px] max-h-[340px] overflow-y-auto overscroll-contain scrollbar-thin"
                  : "w-[200px]",
            )}
          >
            {allowClear && isScrollSidebar ? (
              <div className="mb-1 flex justify-center px-3 pb-2 pt-2">
                <button
                  type="button"
                  disabled={!hasRangeValue}
                  aria-label={clearLabel}
                  title={clearLabel}
                  onClick={clearRangeAndClose}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : allowClear ? (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-4 py-2 text-left text-[13px] transition-colors hover:bg-slate-50",
                  endOnly
                    ? !value.endDate
                      ? "font-medium text-slate-900"
                      : "text-slate-600"
                    : !value.startDate && !value.endDate
                      ? "font-medium text-slate-900"
                      : "text-slate-600",
                )}
                onClick={() => {
                  clearRangeAndClose();
                }}
              >
                {clearLabel}
              </button>
            ) : null}
            {sidebarMode === "years" ? (
              years.map((year) => {
                const isViewYear = activeYear === year;
                const isSelectedYear = value.endDate?.getFullYear() === year;
                return (
                  <button
                    key={year}
                    type="button"
                    data-year={year}
                    className={cn(
                      "flex w-full items-center justify-center px-2 py-1.5 text-[13px] tabular-nums transition-colors hover:bg-slate-50",
                      isViewYear && "bg-red-50/90 font-semibold text-[#e5484d] hover:bg-red-50",
                      !isViewYear && isSelectedYear && "font-medium text-indigo-700",
                      !isViewYear && !isSelectedYear && "text-slate-700",
                    )}
                    onClick={() => jumpToYear(year)}
                  >
                    {year}
                  </button>
                );
              })
            ) : sidebarMode === "months" ? (
              months.map((monthDate) => {
                const key = monthKey(monthDate);
                const isViewMonth = activeMonthKey === key;
                const isSelectedMonth = monthOverlapsRange(monthDate, value.startDate, value.endDate);
                return (
                  <button
                    key={key}
                    type="button"
                    data-month={key}
                    className={cn(
                      "flex w-full items-center justify-center px-2 py-1.5 text-[12px] tabular-nums transition-colors hover:bg-slate-50",
                      isSelectedMonth && "bg-red-50/90 font-semibold text-[#e5484d] hover:bg-red-50",
                      !isSelectedMonth && isViewMonth && "font-medium text-indigo-700",
                      !isSelectedMonth && !isViewMonth && "text-slate-700",
                    )}
                    onClick={() => jumpToMonth(monthDate)}
                  >
                    {format(monthDate, "MMM yyyy")}
                  </button>
                );
              })
            ) : (
              <>
                {quickPicks.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left text-[13px] text-slate-800 transition-colors hover:bg-slate-50",
                      q.id === "today" && "bg-red-50/90 font-medium text-[#e5484d] hover:bg-red-50",
                    )}
                    onClick={() => (rangeSelect ? applyRangeQuickPick(q) : applyDate(q.getDate()))}
                  >
                    <span>{q.label}</span>
                    <span className={cn("text-[12px] text-slate-400", q.id === "today" && "text-[#e5484d]/70")}>
                      {q.hint}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-[13px] text-slate-500 hover:bg-slate-50"
                >
                  Set Recurring
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </>
            )}
          </div>

          {/* Calendar panel */}
          <div className="min-w-[280px] p-3">
            {!rangeSelect && endOnly && !isScrollSidebar ? (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-900 bg-white px-3 py-2 text-[13px] text-slate-900">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{value.endDate ? toInputValue(value.endDate) : "End date"}</span>
              </div>
            ) : !rangeSelect && !endOnly ? (
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveField("start")}
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-[13px]",
                    activeField === "start"
                      ? "border-slate-900 bg-white text-slate-900"
                      : "border-transparent bg-slate-100 text-slate-500",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{value.startDate ? toInputValue(value.startDate) : "Start date"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField("end")}
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-[13px]",
                    activeField === "end"
                      ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                      : "border-transparent bg-slate-100 text-slate-500",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{value.endDate ? toInputValue(value.endDate) : "End date"}</span>
                </button>
              </div>
            ) : rangeSelect && !hideRangeFields ? (
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{value.startDate ? toInputValue(value.startDate) : "Start date"}</span>
                  </div>
                  <span className="self-center text-slate-400">→</span>
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{value.endDate ? toInputValue(value.endDate) : "End date"}</span>
                  </div>
                </div>
                {value.startDate && value.endDate ? (
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {formatResourceRangeMonthLabel(value.startDate, value.endDate)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[15px] font-semibold text-slate-900">{format(month, "MMMM yyyy")}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[12px] font-semibold text-[#e5484d] hover:bg-red-50"
                  onClick={() => {
                    const t = startOfDay(new Date());
                    applyDate(t);
                    setMonth(t);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => setMonth((m) => addMonths(m, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <DayPicker
              mode={rangeSelect ? "range" : "single"}
              month={month}
              onMonthChange={setMonth}
              selected={rangeSelect ? rangeSelected : (selected ?? undefined)}
              onSelect={(d) => {
                if (rangeSelect) {
                  const range = d as { from?: Date; to?: Date } | undefined;
                  onChange({
                    startDate: range?.from ? startOfDay(range.from) : null,
                    endDate: range?.to ? startOfDay(range.to) : null,
                  });
                  return;
                }
                const day = d as Date | undefined;
                if (day) applyDate(day);
              }}
              showOutsideDays
              classNames={sharedDayPickerClassNames}
            />
            {rangeSelect && (allowClear || clearAtBottom) ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  disabled={isClearDisabled}
                  onClick={clearRangeAndClose}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-[13px] font-semibold transition-colors",
                    !isClearDisabled
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400",
                  )}
                >
                  {clearLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Parse API date string to Date or null. */
export function parsePmsDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = parseISO(s.length === 10 ? `${s}T00:00:00` : s);
  return isValid(d) ? d : null;
}

/** Format Date for API (YYYY-MM-DD). */
export function formatPmsDateForApi(d: Date | null): string | null {
  if (!d || !isValid(d)) return null;
  return format(d, "yyyy-MM-dd");
}

export function formatTaskDateLabel(d: Date | null): string {
  if (!d || !isValid(d)) return "Dates";
  if (isSameDay(d, new Date())) return "Today";
  return format(d, "MMM d");
}

/** @deprecated Use formatTaskDateLabel */
export const formatDueDateLabel = formatTaskDateLabel;

export function formatTaskDateRangeLabel(range: PmsDateRange): string {
  const { startDate, endDate } = range;
  if (!startDate && !endDate) return "Dates";
  if (startDate && endDate) {
    if (isSameDay(startDate, endDate)) return formatTaskDateLabel(startDate);
    return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`;
  }
  if (startDate) return `From ${format(startDate, "MMM d")}`;
  if (endDate) return `Until ${format(endDate, "MMM d")}`;
  return "Dates";
}

/** @deprecated Use formatTaskDateRangeLabel */
export const formatDueDateRangeLabel = formatTaskDateRangeLabel;
