import { useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export const LEAVE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses", subtitle: "Show every request", dotClass: "bg-slate-300" },
  { value: "pending", label: "Pending", subtitle: "Awaiting approval", dotClass: "bg-amber-500" },
  { value: "approved", label: "Approved", subtitle: "Accepted requests", dotClass: "bg-emerald-500" },
  { value: "rejected", label: "Rejected", subtitle: "Declined requests", dotClass: "bg-rose-500" },
] as const;

function StatusDot({ className }: { className: string }) {
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)} aria-hidden />;
}

function LeaveStatusFilterMenuItem({
  name,
  subtitle,
  dotClass,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  dotClass?: string;
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
      {dotClass ? (
        <StatusDot className={dotClass} />
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
  value: string;
  onChange: (value: string) => void;
  align?: "start" | "end";
};

export function LeaveStatusFilterDropdown({ value, onChange, align = "start" }: Props) {
  const [open, setOpen] = useState(false);

  const selectedOption = LEAVE_STATUS_FILTER_OPTIONS.find((s) => s.value === value);
  const triggerLabel = value === "all" ? "Status" : selectedOption?.label ?? "Status";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Layers className="h-4 w-4 shrink-0 text-indigo-600" />
          {value !== "all" && selectedOption ? (
            <StatusDot className={selectedOption.dotClass} />
          ) : null}
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
        {LEAVE_STATUS_FILTER_OPTIONS.map((opt) => (
          <LeaveStatusFilterMenuItem
            key={opt.value}
            name={opt.label}
            subtitle={opt.subtitle}
            dotClass={opt.dotClass}
            selected={value === opt.value}
            onSelect={() => {
              onChange(opt.value);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
