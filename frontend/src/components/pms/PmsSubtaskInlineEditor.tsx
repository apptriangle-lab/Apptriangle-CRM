import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CornerDownLeft,
  Flag,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PmsTaskStatusDropdown } from "@/components/pms/PmsTaskStatusDropdown";
import {
  PmsTaskAssigneesPicker,
  type AssigneeOption,
} from "@/components/pms/PmsTaskAssigneesPicker";
import {
  formatPmsDateForApi,
  formatTaskDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { normalizeTaskDateRange, validateTaskDateRange } from "@/lib/pmsTaskDates";
import { toast } from "sonner";
import { pmsTreeLevelStyle } from "@/components/pms/pmsTaskListStyles";
import { PMS_PRIORITIES } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

export type SubtaskCreateDraft = {
  title: string;
  status: string;
  priority: string;
  assigneeIds: string[];
  startDate: string | null;
  endDate: string | null;
};

type Props = {
  level?: number;
  parentTitle?: string;
  variant?: "list" | "modal";
  defaultStatus: string;
  defaultPriority?: string;
  statusOrder: string[];
  assigneeOptions: AssigneeOption[];
  value: string;
  onChange: (value: string) => void;
  onSave: (draft: SubtaskCreateDraft) => void;
  onCancel: () => void;
  saving?: boolean;
};

function priorityFlagClass(value: string) {
  if (value === "urgent" || value === "high") return "text-rose-500";
  if (value === "medium") return "text-sky-500";
  return "text-slate-400";
}

export function PmsSubtaskInlineEditor({
  level = 1,
  parentTitle,
  variant = "list",
  defaultStatus,
  defaultPriority = "medium",
  statusOrder,
  assigneeOptions,
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tier = pmsTreeLevelStyle(level);
  const isModal = variant === "modal";

  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState(defaultPriority);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dates, setDates] = useState<PmsDateRange>({ startDate: null, endDate: null });
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setStatus(defaultStatus);
    setPriority(defaultPriority);
    setAssigneeIds([]);
    setDates({ startDate: null, endDate: null });
  }, [defaultStatus, defaultPriority, parentTitle]);

  const buildDraft = (): SubtaskCreateDraft => {
    const normalized = normalizeTaskDateRange(dates);
    return {
      title: value.trim(),
      status,
      priority,
      assigneeIds,
      startDate: formatPmsDateForApi(normalized.startDate),
      endDate: formatPmsDateForApi(normalized.endDate),
    };
  };

  const handleSave = () => {
    if (!value.trim()) return;
    const err = validateTaskDateRange(dates);
    if (err) {
      toast.error(err);
      return;
    }
    onSave(buildDraft());
  };

  const priorityLabel = PMS_PRIORITIES.find((p) => p.value === priority)?.label ?? "Priority";
  const isNotStarted =
    status.toLowerCase().includes("not") && status.toLowerCase().includes("start");

  return (
    <div
      className={cn(
        "border-b py-2.5 pr-2",
        isModal ? "border-slate-100 bg-white" : cn(tier.editorBorder, tier.editorBg),
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {!isModal && parentTitle && (
        <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wide", tier.editorLabel)}>
          New subtask under &ldquo;{parentTitle}&rdquo;
        </p>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            "h-[18px] w-[18px] shrink-0 rounded-full border border-dashed bg-white",
            isNotStarted ? "border-rose-300" : "border-transparent",
            !isModal && tier.addBorder,
          )}
          aria-hidden
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder={isModal ? "Task Name or type '/' for commands" : "Subtask name"}
          className={cn(
            "min-w-[120px] flex-1 rounded-md border bg-white px-2 py-1 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2",
            isModal ? "border-slate-200 focus:ring-slate-200" : tier.editorBorder,
          )}
          disabled={saving}
        />
        <div className="flex shrink-0 items-center gap-0.5 text-slate-400">
          <PmsTaskStatusDropdown
            value={status}
            onChange={setStatus}
            statusOrder={statusOrder}
            disabled={saving}
            variant="compact"
          />

          <PmsTaskAssigneesPicker
            value={assigneeIds}
            onChange={setAssigneeIds}
            options={assigneeOptions}
            disabled={saving}
            open={assigneeOpen}
            onOpenChange={setAssigneeOpen}
            iconOnly
          />

          <PmsTaskDatePicker
            rangeSelect
            value={dates}
            onChange={setDates}
            open={dueOpen}
            onOpenChange={setDueOpen}
          >
            <button
              type="button"
              className={cn(
                "rounded p-1 hover:bg-white/80 hover:text-slate-600",
                dueOpen && "bg-white/80 text-slate-600",
                dates.startDate || dates.endDate ? "text-sky-600" : "text-slate-400",
              )}
              title={formatTaskDateRangeLabel(dates)}
              disabled={saving}
            >
              <Calendar className="h-4 w-4" />
            </button>
          </PmsTaskDatePicker>

          <DropdownMenu open={priorityOpen} onOpenChange={setPriorityOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "rounded p-1 hover:bg-white/80",
                  priorityOpen && "bg-white/80",
                  priorityFlagClass(priority),
                )}
                title={`Priority: ${priorityLabel}`}
                disabled={saving}
              >
                <Flag className="h-4 w-4 fill-current" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PMS_PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => {
                    setPriority(p.value);
                    setPriorityOpen(false);
                  }}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
            onClick={handleSave}
            disabled={saving || !value.trim()}
          >
            Save
            <CornerDownLeft className="h-3 w-3 opacity-80" />
          </Button>
        </div>
      </div>
    </div>
  );
}
