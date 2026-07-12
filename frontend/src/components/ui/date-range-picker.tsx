import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: { from?: Date; to?: Date };
  onSelect: (range: { from?: Date; to?: Date }) => void;
  placeholder?: string;
  className?: string;
  showQuickSelect?: boolean;
  /** When true, calendar days before today cannot be selected */
  disablePast?: boolean;
}

const quickSelectOptions = [
  { label: "Today", getRange: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { from: today, to: today };
  }},
  { label: "Yesterday", getRange: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return { from: yesterday, to: yesterday };
  }},
  { label: "This Week", getRange: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return { from: startOfWeek, to: today };
  }},
  { label: "Last Week", getRange: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(today);
    const day = startOfLastWeek.getDay();
    const diff = startOfLastWeek.getDate() - day - 6; // Last Monday
    startOfLastWeek.setDate(diff);
    startOfLastWeek.setHours(0, 0, 0, 0);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    return { from: startOfLastWeek, to: endOfLastWeek };
  }},
  { label: "This Month", getRange: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: startOfMonth, to: today };
  }},
  { label: "Last Month", getRange: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: startOfLastMonth, to: endOfLastMonth };
  }},
];

export function DateRangePicker({
  dateRange,
  onSelect,
  placeholder = "Date range",
  className,
  showQuickSelect = false,
  disablePast = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const disablePastMatcher = React.useCallback(
    (d: Date) => isBefore(startOfDay(d), startOfDay(new Date())),
    [],
  );

  const handleQuickSelect = (getRange: () => { from: Date; to: Date }) => {
    const range = getRange();
    onSelect(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "shrink-0 w-48 justify-start text-left font-normal text-sm h-9",
            !dateRange.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">
            {dateRange.from
              ? dateRange.to
                ? `${format(dateRange.from, "PP")} – ${format(dateRange.to, "PP")}`
                : format(dateRange.from, "PP")
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 bg-gradient-to-br from-background to-muted/20">
          {showQuickSelect && (
            <div className="mb-4 pb-4 border-b border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Quick Select
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickSelectOptions.map((option) => (
                  <Button
                    key={option.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickSelect(option.getRange)}
                    className="h-8 text-xs justify-start hover:bg-primary/10 hover:text-primary transition-colors rounded-lg"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border/50 bg-card/50 p-2">
            <Calendar
              mode="range"
              selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => {
                onSelect({ from: range?.from, to: range?.to });
                if (range?.from && range?.to) {
                  setOpen(false);
                }
              }}
              disabled={disablePast ? disablePastMatcher : undefined}
              numberOfMonths={2}
              captionLayout="dropdown"
              fromYear={2020}
              toYear={2035}
              className="p-0"
              classNames={{
                dropdown_month: "h-8 px-2 rounded-md border border-border/50 bg-background text-sm font-medium min-w-[120px] appearance-none cursor-pointer shadow-sm hover:border-primary/50 transition-colors",
                caption_dropdowns: "flex items-center gap-2 justify-center mb-3",
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
