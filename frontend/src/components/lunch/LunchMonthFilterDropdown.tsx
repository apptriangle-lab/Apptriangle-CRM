import { useState } from "react";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type LunchMonthOption = {
  value: string;
  label: string;
  isCurrent?: boolean;
};

type Props = {
  value: string;
  options: LunchMonthOption[];
  onChange: (value: string) => void;
  align?: "start" | "end";
};

function MonthMenuItem({
  label,
  subtitle,
  selected,
  onSelect,
}: {
  label: string;
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
        <p className="truncate text-sm font-medium text-slate-900">{label}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

export function LunchMonthFilterDropdown({ value, options, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const triggerLabel = selected?.label ?? "Select month";
  const isFiltered = Boolean(selected && !selected.isCurrent);

  const monthIdx = options.findIndex((o) => o.value === value);

  const shiftMonth = (delta: number) => {
    const next = options[monthIdx + delta];
    if (next) onChange(next.value);
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => shiftMonth(1)}
        disabled={monthIdx >= options.length - 1}
        className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
              isFiltered && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
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
          {options.map((m) => (
            <MonthMenuItem
              key={m.value}
              label={m.label}
              subtitle={m.isCurrent ? "Current month" : undefined}
              selected={value === m.value}
              onSelect={() => {
                onChange(m.value);
                setOpen(false);
              }}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => shiftMonth(-1)}
        disabled={monthIdx <= 0}
        className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
