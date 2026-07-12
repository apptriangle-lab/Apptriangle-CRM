import { useCallback, useEffect, useRef, useState } from "react";
import { format, isSameDay, isValid } from "date-fns";
import { Calendar, Target, X } from "lucide-react";
import { toast } from "sonner";
import { pmsApi, type PmsSprintDto } from "@/lib/pmsApi";
import { usePmsSprints } from "@/contexts/PmsSprintContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  formatPmsDateForApi,
  parsePmsDate,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sprint?: PmsSprintDto | null;
  onSaved?: (sprint: PmsSprintDto) => void;
};

function formatSprintDateLabel(d: Date | null, placeholder: string): string {
  if (!d || !isValid(d)) return placeholder;
  if (isSameDay(d, new Date())) return "Today";
  return format(d, "MMM d");
}

export function PmsSprintFormDialog({ open, onOpenChange, projectId, sprint, onSaved }: Props) {
  const { refreshSprints, setSprintFilter } = usePmsSprints();
  const isEdit = Boolean(sprint?.id);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const nameRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = useCallback(() => {
    setName("");
    setGoal("");
    setShowGoal(false);
    setStartDate(null);
    setEndDate(null);
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  }, []);

  const focusName = useCallback(() => {
    requestAnimationFrame(() => {
      const el = nameRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (sprint) {
      setName(sprint.name);
      const goalText = sprint.goal ?? "";
      setGoal(goalText);
      setShowGoal(Boolean(goalText.trim()));
      setStartDate(parsePmsDate(sprint.startDate));
      setEndDate(parsePmsDate(sprint.endDate));
    } else {
      resetForm();
    }
    focusName();
  }, [open, sprint, resetForm, focusName]);

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const submitSprint = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a sprint name");
      nameRef.current?.focus();
      return;
    }
    const startIso = formatPmsDateForApi(startDate);
    const endIso = formatPmsDateForApi(endDate);
    if (startIso && endIso && startIso > endIso) {
      toast.error("Closing date must be on or after start date");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: trimmed,
        goal: goal.trim(),
        startDate: startIso,
        endDate: endIso,
        status: isEdit ? (sprint!.status ?? "planned") : "planned",
      };
      const saved = isEdit
        ? await pmsApi.updateSprint(projectId, sprint!.id, body)
        : await pmsApi.createSprint(projectId, body);
      toast.success(isEdit ? "Sprint updated" : "Sprint created");
      await refreshSprints();
      if (!isEdit) setSprintFilter(saved.id);
      onSaved?.(saved);
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save sprint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        showClose={false}
        className="max-w-[720px] gap-0 overflow-hidden border-slate-200 bg-white p-0 font-[Inter,system-ui,sans-serif] shadow-2xl"
        onPointerDownOutside={(e) => {
          if (startPickerOpen || endPickerOpen) e.preventDefault();
        }}
      >
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

          <div className="px-6 pt-2 pb-1">
            <textarea
              ref={nameRef}
              rows={1}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitSprint();
                }
              }}
              placeholder="Sprint name"
              className="w-full resize-none border-0 bg-transparent p-0 text-[28px] font-medium leading-tight text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 px-6 pb-4">
            {!showGoal ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800"
                onClick={() => setShowGoal(true)}
              >
                <Target className="h-3.5 w-3.5" />
                Add sprint goal
              </button>
            ) : null}
          </div>

          {showGoal && (
            <div className="px-6 pb-4">
              <Textarea
                autoFocus={!isEdit}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What should this sprint deliver?"
                className="min-h-[80px] resize-y border-slate-200 text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 px-6 pb-6">
            <PmsTaskDatePicker
              endOnly
              allowClear
              clearLabel="Clear start date"
              value={{ startDate: null, endDate: startDate }}
              onChange={(next: PmsDateRange) => setStartDate(next.endDate)}
              open={startPickerOpen}
              onOpenChange={setStartPickerOpen}
              modal={false}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
                  startDate ? "text-slate-900" : "text-slate-600",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {formatSprintDateLabel(startDate, "Start expected")}
              </button>
            </PmsTaskDatePicker>

            <PmsTaskDatePicker
              endOnly
              allowClear
              clearLabel="Clear closing date"
              value={{ startDate: null, endDate: endDate }}
              onChange={(next: PmsDateRange) => setEndDate(next.endDate)}
              open={endPickerOpen}
              onOpenChange={setEndPickerOpen}
              modal={false}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium hover:bg-slate-50",
                  endDate ? "text-slate-900" : "text-slate-600",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {formatSprintDateLabel(endDate, "Closing expected")}
              </button>
            </PmsTaskDatePicker>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-6 py-3">
          <Button
            type="button"
            className="h-8 rounded-md bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
            disabled={saving}
            onClick={() => void submitSprint()}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create Sprint"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
