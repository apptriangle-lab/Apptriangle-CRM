import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  GripVertical,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_POLL_OPTIONS,
  lunchApi,
  type CreatePollOptionInput,
  type LunchOptionType,
} from "@/lib/lunchApi";
import { LUNCH_OPTION_TYPE_COLORS, LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { defaultPollEndTime, pollEndTimeFromNow } from "@/components/lunch/lunchPollUtils";
import {
  LUNCH_POLL_ACCENT,
  LUNCH_POLL_CHIP_ACTIVE,
  LUNCH_POLL_CHIP_INACTIVE,
  LUNCH_POLL_MODAL_BODY,
  LUNCH_POLL_MODAL_CONTENT,
  LUNCH_POLL_MODAL_FOOTER,
  LUNCH_POLL_MODAL_HEADER,
} from "@/components/lunch/lunchPollModalStyles";
import { LunchPollModalSectionCard } from "@/components/lunch/LunchPollModalSectionCard";
import { PmsTimePicker } from "@/components/pms/PmsTimePicker";
import { cn } from "@/lib/utils";

const OPTION_TYPES: LunchOptionType[] = ["office", "personal", "off"];

const END_TIME_QUICK_PICKS = [
  { label: "15 m", minutes: 15 },
  { label: "30 m", minutes: 30 },
  { label: "60 m", minutes: 60 },
  { label: "2 h", minutes: 120 },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function LunchCreatePollModal({ open, onOpenChange, onCreated }: Props) {
  const todayLabel = format(new Date(), "EEEE, MMM d, yyyy");
  const [title, setTitle] = useState("Today's Lunch");
  const [endTime, setEndTime] = useState(defaultPollEndTime);
  const [endTimeQuickPick, setEndTimeQuickPick] = useState<number | null>(60);
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [options, setOptions] = useState<CreatePollOptionInput[]>(DEFAULT_POLL_OPTIONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("Today's Lunch");
    setEndTime(defaultPollEndTime());
    setEndTimeQuickPick(60);
    setOptions(DEFAULT_POLL_OPTIONS.map((o) => ({ ...o })));
    void lunchApi.getSettings().then((s) => {
      setAllowVoteChange(s.allowVoteChange);
    }).catch(() => {
      setAllowVoteChange(true);
    });
  }, [open]);

  const addOption = () => {
    setOptions((prev) => [
      { label: "", optionType: "office", orderIndex: 0 },
      ...prev.map((o, i) => ({ ...o, orderIndex: i + 1 })),
    ]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, orderIndex: i })));
  };

  const save = async () => {
    const valid = options.filter((o) => o.label.trim());
    if (valid.length === 0) {
      toast.error("Add at least one menu option");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a poll title");
      return;
    }
    if (!endTime.trim()) {
      toast.error("Set a poll end time");
      return;
    }
    setSaving(true);
    try {
      await lunchApi.createPoll({
        title: title.trim(),
        allowVoteChange,
        endTime: endTime.trim(),
        options: valid,
      });
      toast.success("Poll created");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create poll");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className={LUNCH_POLL_MODAL_CONTENT}>
        <DialogTitle className="sr-only">Create lunch poll</DialogTitle>
        <DialogDescription className="sr-only">
          Set up a daily lunch poll with menu options.
        </DialogDescription>

        {/* Header */}
        <div className={LUNCH_POLL_MODAL_HEADER}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700/90">
                Daily poll
              </p>
              <h2 className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">Create lunch poll</h2>
              <p className="mt-0.5 text-sm text-stone-600">
                Post today&apos;s menu for {todayLabel}. Meal cost comes from Settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-orange-50 hover:text-stone-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className={LUNCH_POLL_MODAL_BODY}>
          <div className="grid gap-4 md:grid-cols-[minmax(240px,280px)_1fr] md:items-start">
            <div className="space-y-4">
              <LunchPollModalSectionCard
                icon={CalendarDays}
                title="Poll details"
                accent={LUNCH_POLL_ACCENT.details}
              >
                <div className="space-y-2.5">
                  <p className="text-xs text-stone-500">
                    Poll date:{" "}
                    <span className="font-semibold text-stone-700">{todayLabel}</span>
                    {" "}(today)
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="poll-title" className="text-xs font-medium text-stone-600">
                      Poll title <span className="text-orange-600">*</span>
                    </Label>
                    <Input
                      id="poll-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Today's Lunch"
                      className="h-9 rounded-xl border-stone-200 bg-white text-sm font-medium focus-visible:border-orange-300 focus-visible:ring-orange-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="poll-end-time" className="text-xs font-medium text-stone-600">
                      Poll end time <span className="text-orange-600">*</span>
                    </Label>
                    <PmsTimePicker
                      id="poll-end-time"
                      value={endTime}
                      onChange={(next) => {
                        setEndTime(next);
                        setEndTimeQuickPick(null);
                      }}
                      placeholder="Pick end time"
                      compact
                      modal={false}
                      className="rounded-xl border-stone-200 bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {END_TIME_QUICK_PICKS.map(({ label, minutes }) => {
                        const selected = endTimeQuickPick === minutes;
                        return (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => {
                              setEndTime(pollEndTimeFromNow(minutes));
                              setEndTimeQuickPick(minutes);
                            }}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all",
                              selected ? LUNCH_POLL_CHIP_ACTIVE : LUNCH_POLL_CHIP_INACTIVE,
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </LunchPollModalSectionCard>

              <LunchPollModalSectionCard
                icon={Settings2}
                title="Voting rules"
                accent={LUNCH_POLL_ACCENT.rules}
              >
                <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100/80 bg-orange-50/20 px-3 py-2.5">
                  <p className="text-sm font-medium text-stone-900">Allow vote changes</p>
                  <Switch
                    id="allow-vote-change"
                    checked={allowVoteChange}
                    onCheckedChange={setAllowVoteChange}
                    className="shrink-0"
                  />
                </div>
              </LunchPollModalSectionCard>
            </div>

            <LunchPollModalSectionCard
              icon={UtensilsCrossed}
              title="Menu options"
              accent={LUNCH_POLL_ACCENT.menu}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="h-8 gap-1.5 rounded-xl border-orange-200/80 bg-white px-2.5 text-xs font-semibold text-stone-700 shadow-sm hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-900 [&_svg]:text-orange-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add option
                </Button>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-orange-100/80 bg-gradient-to-br from-white to-orange-50/20 p-2 shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-stone-300" aria-hidden>
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <Input
                        value={opt.label}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)),
                          )
                        }
                        placeholder="Menu item name"
                        className="h-8 min-w-0 flex-1 rounded-lg border-stone-200 bg-white text-sm font-medium focus-visible:border-orange-300 focus-visible:ring-orange-200"
                      />
                      {options.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove option"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                      {OPTION_TYPES.map((type) => {
                        const selected = opt.optionType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setOptions((prev) =>
                                prev.map((o, j) => (j === i ? { ...o, optionType: type } : o)),
                              )
                            }
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all",
                              selected
                                ? cn(LUNCH_OPTION_TYPE_COLORS[type], "ring-1 ring-inset")
                                : LUNCH_POLL_CHIP_INACTIVE,
                            )}
                          >
                            {LUNCH_OPTION_TYPE_LABELS[type] ?? type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </LunchPollModalSectionCard>
          </div>
        </div>

        <div className={LUNCH_POLL_MODAL_FOOTER}>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-stone-200 bg-white text-stone-700 hover:border-orange-200 hover:bg-orange-50/50 hover:text-stone-900"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create poll"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
