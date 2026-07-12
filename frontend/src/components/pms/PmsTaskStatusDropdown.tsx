import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PMS_ASSIGNEE_MENU_OVERRIDES,
  PMS_ASSIGNEE_OPTION_ITEM_CLASS,
} from "@/components/pms/PmsTaskAssigneesPicker";
import { formatPmsTaskStatusLabel } from "@/lib/pmsApi";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  statusOrder: string[];
  disabled?: boolean;
  align?: "start" | "end" | "center";
  /** Slightly smaller pill for dense list rows */
  variant?: "pill" | "compact";
  className?: string;
};

function StatusMenuItem({
  status,
  index,
  selected,
  onSelect,
}: {
  status: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = pmsStatusTheme(status, index);
  const label = formatPmsTaskStatusLabel(status);

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
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", theme.dot)} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{label}</span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

export function PmsTaskStatusDropdown({
  value,
  onChange,
  statusOrder,
  disabled = false,
  align = "start",
  variant = "pill",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const theme = pmsStatusTheme(value, statusOrder.indexOf(value));
  const label = formatPmsTaskStatusLabel(value).toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex w-fit max-w-full items-center gap-1.5 !border-0 text-white shadow-sm transition-colors disabled:opacity-50",
            variant === "pill"
              ? "h-7 rounded-full px-3 text-[11px] font-bold uppercase tracking-wide"
              : "h-7 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide",
            theme.pill,
            className,
          )}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-white/40" aria-hidden />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-90" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "max-h-[min(360px,55vh)] min-w-[180px] overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        {statusOrder.map((status, index) => (
          <StatusMenuItem
            key={status}
            status={status}
            index={index}
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
