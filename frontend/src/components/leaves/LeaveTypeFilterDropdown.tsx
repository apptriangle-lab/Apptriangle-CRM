import { useState } from "react";
import { Check, ChevronDown, FileText } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import type { LeaveTypeDto } from "@/lib/api";
import { cn } from "@/lib/utils";

function LeaveTypeFilterMenuItem({
  name,
  subtitle,
  selected,
  onSelect,
  active = false,
}: {
  name: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  active?: boolean;
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
      <FileText
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          active ? "text-indigo-600" : "text-slate-400",
        )}
      />
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
  leaveTypes: LeaveTypeDto[];
  align?: "start" | "end";
};

export function LeaveTypeFilterDropdown({
  value,
  onChange,
  leaveTypes,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);

  const triggerLabel =
    value === "all"
      ? "Leave type"
      : leaveTypes.find((t) => t.id === value)?.name ?? "Leave type";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!leaveTypes.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
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
        <LeaveTypeFilterMenuItem
          name="All leave types"
          subtitle="Show every type"
          selected={value === "all"}
          onSelect={() => {
            onChange("all");
            setOpen(false);
          }}
        />
        {leaveTypes.map((type) => (
          <LeaveTypeFilterMenuItem
            key={type.id}
            name={type.name}
            selected={value === type.id}
            active
            onSelect={() => {
              onChange(type.id);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
