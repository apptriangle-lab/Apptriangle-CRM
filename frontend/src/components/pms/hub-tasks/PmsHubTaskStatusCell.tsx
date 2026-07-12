import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { formatPmsTaskStatusLabel } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

function StatusDot({ status, className }: { status: string; className?: string }) {
  const theme = pmsStatusTheme(status);
  return (
    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", theme.dot, className)} aria-hidden />
  );
}

function StatusMenuItem({
  statusKey,
  selected,
  onSelect,
}: {
  statusKey: string;
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
      <StatusDot status={statusKey} className="h-3 w-3" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {formatPmsTaskStatusLabel(statusKey)}
        </p>
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  status: string;
  statuses: string[];
  canChange: boolean;
  onStatusChange: (status: string) => void | Promise<void>;
};

export function PmsHubTaskStatusCell({ status, statuses, canChange, onStatusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const theme = pmsStatusTheme(status);

  const pill = (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide",
        theme.pill,
        canChange && !saving && "hover:opacity-90",
        saving && "opacity-60",
      )}
    >
      <span className="truncate">{formatPmsTaskStatusLabel(status)}</span>
      {canChange ? <ChevronDown className="h-3 w-3 shrink-0 opacity-80" /> : null}
    </span>
  );

  if (!canChange || statuses.length === 0) {
    return <div onClick={(e) => e.stopPropagation()}>{pill}</div>;
  }

  const handleSelect = async (next: string) => {
    if (next === status || saving) return;
    setSaving(true);
    try {
      await onStatusChange(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={saving}
            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-label={`Change status, currently ${formatPmsTaskStatusLabel(status)}`}
          >
            {pill}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "w-52 rounded-xl border-slate-200 p-1.5 shadow-lg",
            PMS_ASSIGNEE_MENU_OVERRIDES,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {statuses.map((s) => (
            <StatusMenuItem
              key={s}
              statusKey={s}
              selected={s === status}
              onSelect={() => void handleSelect(s)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
