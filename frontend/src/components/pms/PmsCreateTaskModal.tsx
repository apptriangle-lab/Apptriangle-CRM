import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startOfDay } from "date-fns";
import {
  Calendar,
  CheckSquare,
  Flag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  pmsApi,
  PMS_PRIORITIES,
  type PmsTaskDto,
} from "@/lib/pmsApi";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PmsTaskStatusDropdown } from "@/components/pms/PmsTaskStatusDropdown";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PmsTaskAssigneesPicker } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  PmsTaskDatePicker,
  formatPmsDateForApi,
  formatTaskDateLabel,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { normalizeTaskDateRange, validateTaskDateRange } from "@/lib/pmsTaskDates";
import {
  PmsTaskAttachmentsSection,
  uploadPendingPmsAttachments,
} from "@/components/pms/PmsTaskAttachmentsSection";
import { usePmsSprintsOptional } from "@/contexts/PmsSprintContext";
import { usePmsTaskModalOptional } from "@/contexts/PmsTaskModalContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string;
  defaultStatus?: string;
  defaultSprintId?: string | null;
  members?: { userId: string; userName?: string; userEmail?: string }[];
  onCreated?: (task: PmsTaskDto) => void;
};

type CreateTaskOutcome = "close" | "new";

function defaultCreateTaskDates(): PmsDateRange {
  const today = startOfDay(new Date());
  return { startDate: today, endDate: today };
}

export function PmsCreateTaskModal({
  open,
  onOpenChange,
  projectId,
  projectTitle = "Project",
  defaultStatus,
  defaultSprintId,
  members = [],
  onCreated,
}: Props) {
  const { pmsTaskStatuses } = useStatusConfig();
  const sprintCtx = usePmsSprintsOptional();
  const sprintFilter = sprintCtx?.sprintFilter ?? "all";
  const sprints = sprintCtx?.sprints ?? [];
  const hasSprintContext = Boolean(sprintCtx);
  const taskModal = usePmsTaskModalOptional();
  const statusOrder = pmsTaskStatuses.length ? pmsTaskStatuses : ["to_do", "in_progress", "completed"];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [status, setStatus] = useState(defaultStatus ?? statusOrder[0] ?? "to_do");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState("medium");
  const [dates, setDates] = useState<PmsDateRange>(defaultCreateTaskDates);
  const [dateError, setDateError] = useState<string | null>(null);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [sprintId, setSprintId] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const assigneeOptions = useMemo(
    () =>
      members
        .filter((m) => m.userId)
        .map((m) => ({
          id: m.userId,
          name: m.userName ?? m.userId,
          email: m.userEmail,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const resolveDefaultSprint = useCallback((): string | null => {
    if (defaultSprintId !== undefined) return defaultSprintId;
    if (sprintFilter !== "all" && sprintFilter !== "backlog") return sprintFilter;
    return null;
  }, [defaultSprintId, sprintFilter]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setShowDescription(false);
    setStatus(defaultStatus ?? statusOrder[0] ?? "to_do");
    setAssigneeIds([]);
    setPriority("medium");
    setDates(defaultCreateTaskDates());
    setDateError(null);
    setStartDatePickerOpen(false);
    setEndDatePickerOpen(false);
    setAssigneeOpen(false);
    setPendingFiles([]);
    setSprintId(resolveDefaultSprint());
  }, [defaultStatus, statusOrder, resolveDefaultSprint]);

  const focusTitle = useCallback(() => {
    requestAnimationFrame(() => {
      const el = titleRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.focus();
    });
  }, []);

  useEffect(() => {
    if (open) {
      resetForm();
      focusTitle();
    }
  }, [open, resetForm, focusTitle]);

  useEffect(() => {
    if (defaultStatus) setStatus(defaultStatus);
  }, [defaultStatus, open]);

  const updateDates = useCallback((patch: Partial<PmsDateRange>) => {
    setDates((prev) => {
      const next = { ...prev, ...patch };
      setDateError(validateTaskDateRange(next));
      return next;
    });
  }, []);

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const submitTask = async (outcome: CreateTaskOutcome) => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a task name");
      titleRef.current?.focus();
      return;
    }
    const dateValidation = validateTaskDateRange(dates);
    if (dateValidation) {
      setDateError(dateValidation);
      toast.error(dateValidation);
      return;
    }
    const normalized = normalizeTaskDateRange(dates);
    setSaving(true);
    try {
      const task = await pmsApi.createTask({
        title: trimmed,
        description: description.trim(),
        projectId,
        status,
        priority,
        assigneeIds,
        startDate: formatPmsDateForApi(normalized.startDate),
        endDate: formatPmsDateForApi(normalized.endDate),
        sprintId,
      });
      let attachments = task.attachments ?? [];
      if (pendingFiles.length > 0) {
        attachments = await uploadPendingPmsAttachments(task.id, pendingFiles);
      }
      toast.success("Task created");
      const createdTask = { ...task, attachments };
      onCreated?.(createdTask);
      taskModal?.notifyTaskUpdated(createdTask);
      if (outcome === "close") {
        handleClose();
      } else {
        resetForm();
        focusTitle();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => void submitTask("close");
  const handleCreateAndNew = () => void submitTask("new");

  const priorityLabel = PMS_PRIORITIES.find((p) => p.value === priority)?.label ?? "Priority";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        showClose={false}
        className="max-w-[720px] gap-0 overflow-hidden border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl"
        onPointerDownOutside={(e) => {
          if (startDatePickerOpen || endDatePickerOpen || assigneeOpen) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Create task in {projectTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          Add a new task with title, status, assignees, and dates.
        </DialogDescription>
        <div className="max-h-[min(72vh,640px)] overflow-y-auto">
          <div className="flex items-start justify-end px-4 pt-3">
            <button
              type="button"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Task name */}
          <div className="px-6 pt-2 pb-1">
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="Task Name"
              className="w-full resize-none border-0 bg-transparent p-0 text-[28px] font-medium leading-tight text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Description row */}
          <div className="flex flex-wrap items-center gap-4 px-6 pb-4">
            {!showDescription ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800"
                onClick={() => setShowDescription(true)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Add description
              </button>
            ) : null}
          </div>

          {showDescription && (
            <div className="px-6 pb-4">
              <Textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description…"
                className="min-h-[80px] resize-y border-slate-200 text-sm"
              />
            </div>
          )}

          {/* Attribute pills */}
          <div className="flex flex-wrap items-center gap-2 px-6 pb-5">
            <PmsTaskStatusDropdown
              value={status}
              onChange={setStatus}
              statusOrder={statusOrder}
              disabled={saving}
            />

            <PmsTaskAssigneesPicker
              value={assigneeIds}
              onChange={setAssigneeIds}
              options={assigneeOptions}
              disabled={saving}
              open={assigneeOpen}
              onOpenChange={setAssigneeOpen}
              placeholder="Assignees"
            />

            <PmsTaskDatePicker
              endOnly
              value={{ startDate: null, endDate: dates.startDate }}
              onChange={(next) => updateDates({ startDate: next.endDate })}
              open={startDatePickerOpen}
              onOpenChange={setStartDatePickerOpen}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
                  dates.startDate ? "text-slate-900" : "text-slate-600",
                  dateError && "border-red-300",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Start date
                  {dates.startDate ? (
                    <span className="text-slate-900"> · {formatTaskDateLabel(dates.startDate)}</span>
                  ) : null}
                </span>
              </button>
            </PmsTaskDatePicker>

            <PmsTaskDatePicker
              endOnly
              value={{ startDate: null, endDate: dates.endDate }}
              onChange={(next) => updateDates({ endDate: next.endDate })}
              open={endDatePickerOpen}
              onOpenChange={setEndDatePickerOpen}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
                  dates.endDate ? "text-slate-900" : "text-slate-600",
                  dateError && "border-red-300",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  End date
                  {dates.endDate ? (
                    <span className="text-slate-900"> · {formatTaskDateLabel(dates.endDate)}</span>
                  ) : null}
                </span>
              </button>
            </PmsTaskDatePicker>
            {dateError ? (
              <p className="w-full text-[11px] text-red-600">{dateError}</p>
            ) : null}

            {hasSprintContext ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Flag className="h-3.5 w-3.5 text-indigo-500" />
                  {sprintId ? (sprints.find((s) => s.id === sprintId)?.name ?? "Sprint") : "Backlog"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-56 overflow-y-auto">
                <DropdownMenuItem onClick={() => setSprintId(null)}>Backlog</DropdownMenuItem>
                {sprints.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => setSprintId(s.id)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Flag className="h-3.5 w-3.5" />
                  {priorityLabel}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PMS_PRIORITIES.map((p) => (
                  <DropdownMenuItem key={p.value} onClick={() => setPriority(p.value)}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="border-t border-slate-100 px-6 py-5">
            <PmsTaskAttachmentsSection
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-md border-slate-200 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            disabled={saving}
            onClick={handleCreateAndNew}
          >
            {saving ? "Creating…" : "Create & New"}
          </Button>
          <Button
            type="button"
            className="h-8 rounded-md bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
            disabled={saving}
            onClick={handleCreate}
          >
            {saving ? "Creating…" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
