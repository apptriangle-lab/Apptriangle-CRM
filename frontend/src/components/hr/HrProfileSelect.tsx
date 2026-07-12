import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type HrProfileSelectOption = {
  value: string;
  label: string;
  dotClass?: string;
};

function formatDisplayLabel(label: string, capitalize?: boolean): string {
  if (!capitalize) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SelectMenuItem({
  option,
  selected,
  capitalize,
  onSelect,
}: {
  option: HrProfileSelectOption;
  selected: boolean;
  capitalize?: boolean;
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
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          option.dotClass ?? "bg-indigo-400",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
        {formatDisplayLabel(option.label, capitalize)}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: HrProfileSelectOption[];
  placeholder?: string;
  variant?: "field" | "compact";
  align?: "start" | "end" | "center";
  disabled?: boolean;
  className?: string;
  capitalize?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export function HrProfileSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  variant = "field",
  align = "start",
  disabled = false,
  className,
  capitalize = false,
  allowEmpty = false,
  emptyLabel = "None",
}: Props) {
  const [open, setOpen] = useState(false);

  const allOptions = useMemo(() => {
    if (!allowEmpty) return options;
    return [{ value: "", label: emptyLabel, dotClass: "bg-slate-300" }, ...options];
  }, [allowEmpty, emptyLabel, options]);

  const selected = allOptions.find((o) => o.value === value);
  const hasValue = Boolean(value);
  const triggerLabel = selected
    ? formatDisplayLabel(selected.label, capitalize)
    : placeholder;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            variant === "field"
              ? cn(
                  "h-10 w-full justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50",
                  hasValue && "border-indigo-200 bg-indigo-50/40 text-indigo-950 hover:bg-indigo-50/60",
                )
              : cn(
                  "h-7 max-w-[9rem] justify-end rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50",
                  hasValue && "border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50",
                ),
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selected?.dotClass ? (
              <span className={cn("h-2 w-2 shrink-0 rounded-full", selected.dotClass)} aria-hidden />
            ) : null}
            <span className={cn("truncate", variant === "compact" && "text-right")}>{triggerLabel}</span>
          </span>
          <ChevronDown className={cn("shrink-0 text-slate-400", variant === "field" ? "h-4 w-4" : "h-3.5 w-3.5")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "max-h-[min(320px,50vh)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        {allOptions.map((option) => (
          <SelectMenuItem
            key={option.value || "__empty__"}
            option={option}
            selected={value === option.value}
            capitalize={capitalize}
            onSelect={() => {
              onChange(option.value);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
