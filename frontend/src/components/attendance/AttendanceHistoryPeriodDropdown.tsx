import { useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_OPTION_ITEM_CLASS, PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  ATTENDANCE_HISTORY_FILTERS,
  type AttendanceHistoryPeriod,
} from "@/lib/attendanceDisplay";
import { cn } from "@/lib/utils";

function PeriodMenuItem({
  name,
  subtitle,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-sky-50 data-[highlighted]:to-indigo-50 data-[highlighted]:text-slate-900",
        "focus:bg-gradient-to-r focus:from-sky-50 focus:to-indigo-50 focus:text-slate-900",
        selected && "bg-indigo-50/80 text-indigo-950",
      )}
      onClick={onSelect}
    >
      <Calendar className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: AttendanceHistoryPeriod;
  onChange: (value: AttendanceHistoryPeriod) => void;
  align?: "start" | "end";
};

export function AttendanceHistoryPeriodDropdown({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = ATTENDANCE_HISTORY_FILTERS.find((f) => f.value === value);
  const triggerLabel = selected?.label ?? "This Week";
  const isDefault = value === "week";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            !isDefault && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Calendar className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "max-h-[min(320px,50vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        {ATTENDANCE_HISTORY_FILTERS.map((filter) => (
          <PeriodMenuItem
            key={filter.value}
            name={filter.label}
            selected={value === filter.value}
            onSelect={() => {
              onChange(filter.value);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
