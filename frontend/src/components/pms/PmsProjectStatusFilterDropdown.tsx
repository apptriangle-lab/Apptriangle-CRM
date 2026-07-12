import { useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
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
import { PMS_PROJECT_STATUSES } from "@/lib/pmsApi";
import { cn, formatStatusLabel } from "@/lib/utils";

const PROJECT_STATUS_DOT: Record<string, string> = {
  not_started: "bg-slate-400",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", PROJECT_STATUS_DOT[status] ?? "bg-slate-400", className)}
      aria-hidden
    />
  );
}

function StatusFilterMenuItem({
  name,
  subtitle,
  statusKey,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  statusKey?: string;
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
      {statusKey ? (
        <StatusDot status={statusKey} className="h-3 w-3" />
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

export function PmsProjectStatusFilterDropdown({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const triggerLabel = formatMultiFilterLabel("Status", value, (id) => formatStatusLabel(id));

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
          <Layers className="h-4 w-4 shrink-0 text-indigo-600" />
          {value.length === 1 ? <StatusDot status={value[0]} /> : null}
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
        <StatusFilterMenuItem
          name="All statuses"
          subtitle="Show projects in any status"
          selected={!value.length}
          onSelect={() => onChange([])}
        />
        {PMS_PROJECT_STATUSES.map((status) => (
          <StatusFilterMenuItem
            key={status.value}
            statusKey={status.value}
            name={status.label}
            selected={value.includes(status.value)}
            onSelect={() => onChange(toggleMultiFilterValue(value, status.value))}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
