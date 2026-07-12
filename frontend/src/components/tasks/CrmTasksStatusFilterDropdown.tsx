import { useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_OPTION_ITEM_CLASS, PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import { crmTaskStatusDotClass } from "@/components/tasks/crmTaskStatusStyles";
import { cn, formatStatusLabel } from "@/lib/utils";

function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", crmTaskStatusDotClass(status), className)}
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
      onClick={onSelect}
    >
      {statusKey ? <StatusDot status={statusKey} className="h-3 w-3" /> : (
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
  value: string;
  onChange: (value: string) => void;
  statuses: string[];
  align?: "start" | "end";
};

export function CrmTasksStatusFilterDropdown({
  value,
  onChange,
  statuses,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);

  const triggerLabel = value === "all" ? "Status" : formatStatusLabel(value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!statuses.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Layers className="h-4 w-4 shrink-0 text-indigo-600" />
          {value !== "all" ? <StatusDot status={value} /> : null}
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
        <StatusFilterMenuItem
          name="All statuses"
          subtitle="Show tasks in any status"
          selected={value === "all"}
          onSelect={() => {
            onChange("all");
            setOpen(false);
          }}
        />
        {statuses.map((status) => (
          <StatusFilterMenuItem
            key={status}
            statusKey={status}
            name={formatStatusLabel(status)}
            selected={value === status}
            onSelect={() => {
              onChange(status);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
