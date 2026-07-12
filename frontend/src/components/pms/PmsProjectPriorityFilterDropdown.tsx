import { useState } from "react";
import { Check, ChevronDown, Flag } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_OPTION_ITEM_CLASS, PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  formatMultiFilterLabel,
  hasMultiFilter,
  toggleMultiFilterValue,
} from "@/components/pms/pmsMultiFilterUtils";
import { PMS_PRIORITIES } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

const PROJECT_PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-rose-500",
};

function PriorityDot({ priority, className }: { priority: string; className?: string }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        PROJECT_PRIORITY_DOT[priority] ?? "bg-slate-400",
        className,
      )}
      aria-hidden
    />
  );
}

function PriorityFilterMenuItem({
  name,
  subtitle,
  priorityKey,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  priorityKey?: string;
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
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      {priorityKey ? (
        <PriorityDot priority={priorityKey} className="h-3 w-3" />
      ) : (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-slate-300" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  align?: "start" | "end";
};

export function PmsProjectPriorityFilterDropdown({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const priorityLabelByValue = Object.fromEntries(PMS_PRIORITIES.map((p) => [p.value, p.label]));
  const triggerLabel = formatMultiFilterLabel(
    "Priority",
    value,
    (id) => priorityLabelByValue[id] ?? id,
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            hasMultiFilter(value) && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Flag className="h-4 w-4 shrink-0 text-indigo-600" />
          {value.length === 1 ? <PriorityDot priority={value[0]} /> : null}
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
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
        <PriorityFilterMenuItem
          name="All priorities"
          subtitle="Show projects at any priority"
          selected={!value.length}
          onSelect={() => onChange([])}
        />
        {PMS_PRIORITIES.map((priority) => (
          <PriorityFilterMenuItem
            key={priority.value}
            priorityKey={priority.value}
            name={priority.label}
            selected={value.includes(priority.value)}
            onSelect={() => onChange(toggleMultiFilterValue(value, priority.value))}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
