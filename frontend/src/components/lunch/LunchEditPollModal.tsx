import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  GripVertical,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Users,
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
  lunchApi,
  type CreatePollOptionInput,
  type LunchOptionType,
  type LunchPollDto,
  type LunchPollSummaryDto,
} from "@/lib/lunchApi";
import { LUNCH_OPTION_TYPE_COLORS, LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { getPollRemainingMs, isPollManuallyCancelled, isPollPastEndTime, pollEndTimeFromNow, defaultPollEndTime } from "@/components/lunch/lunchPollUtils";
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

type EditPollOptionInput = CreatePollOptionInput & { id?: string };

const END_TIME_QUICK_PICKS = [
  { label: "15 m", minutes: 15 },
  { label: "30 m", minutes: 30 },
  { label: "60 m", minutes: 60 },
  { label: "2 h", minutes: 120 },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const AVATAR_COLORS = ["#FB923C", "#34D399", "#60A5FA", "#A78BFA", "#F472B6", "#FBBF24", "#94A3B8"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pollId: string | null;
  onSaved: () => void;
};

export function LunchEditPollModal({ open, onOpenChange, pollId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pollMeta, setPollMeta] = useState<LunchPollDto | null>(null);
  const [results, setResults] = useState<LunchPollSummaryDto | null>(null);
  const [title, setTitle] = useState("");
  const [endTime, setEndTime] = useState(defaultPollEndTime);
  const [endTimeQuickPick, setEndTimeQuickPick] = useState<number | null>(null);
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [cancelPoll, setCancelPoll] = useState(false);
  const [cancelPollUpdating, setCancelPollUpdating] = useState(false);
  const [options, setOptions] = useState<EditPollOptionInput[]>([]);

  const hasVotes = (results?.totalVotes ?? 0) > 0;
  const pollDateLabel = pollMeta?.date
    ? format(new Date(pollMeta.date + "T12:00:00"), "EEEE, MMM d, yyyy")
    : "";
  const expiredByTime =
    pollMeta?.status === "closed" && !cancelPoll && isPollPastEndTime(pollMeta.endsAt);

  useEffect(() => {
    if (!open || !pollId) return;
    setLoading(true);
    setPollMeta(null);
    setResults(null);
    void lunchApi
      .getPoll(pollId)
      .then(({ poll, results: summary }) => {
        setPollMeta(poll);
        setResults(summary);
        setTitle(poll.title);
        setEndTime(poll.endTime || defaultPollEndTime());
        setEndTimeQuickPick(null);
        setAllowVoteChange(poll.allowVoteChange);
        setCancelPoll(isPollManuallyCancelled(poll));
        setOptions(
          (poll.options ?? [])
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((o) => ({
              id: o.id,
              label: o.label,
              optionType: o.optionType,
              orderIndex: o.orderIndex,
            })),
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load poll");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, pollId]);

  const addOption = () => {
    setOptions((prev) => [
      { label: "", optionType: "office", orderIndex: 0 },
      ...prev.map((o, i) => ({ ...o, orderIndex: i + 1 })),
    ]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, orderIndex: i })));
  };

  const applyEndTime = (next: string, quickPickMinutes?: number) => {
    setEndTime(next);
    setEndTimeQuickPick(quickPickMinutes ?? null);
    setCancelPoll(false);
  };

  const handleCancelPollChange = async (checked: boolean) => {
    if (!pollId) return;
    setCancelPoll(checked);
    setCancelPollUpdating(true);
    try {
      const nextStatus = checked ? "closed" : "active";
      await lunchApi.setPollStatus(pollId, nextStatus);
      setPollMeta((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      toast.success(checked ? "Poll closed" : "Poll reopened");
      onSaved();
    } catch (e) {
      setCancelPoll(!checked);
      toast.error(e instanceof Error ? e.message : "Failed to update poll status");
    } finally {
      setCancelPollUpdating(false);
    }
  };

  const save = async () => {
    if (!pollId || !pollMeta) return;
    const valid = options.filter((o) => o.label.trim());
    if (valid.length === 0) {
      toast.error("Add at least one menu option");
      return;
    }
    if (hasVotes && valid.some((o) => !o.id)) {
      toast.error("Could not update menu options");
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
      const endTimeChanged =
        endTime.trim() !== (pollMeta.endTime ?? "").trim() || endTimeQuickPick != null;

      const updated = await lunchApi.updatePoll(pollId, {
        title: title.trim(),
        allowVoteChange,
        ...(endTimeQuickPick != null
          ? { extendMinutes: endTimeQuickPick }
          : { endTime: endTime.trim() }),
        ...(hasVotes
          ? {
              optionUpdates: valid.map((o) => ({
                id: o.id!,
                label: o.label.trim(),
                optionType: o.optionType,
              })),
            }
          : { options: valid }),
      });

      const remaining = getPollRemainingMs(updated.endsAt);
      if (cancelPoll && !endTimeChanged) {
        await lunchApi.setPollStatus(pollId, "closed");
      } else if (remaining !== null && remaining > 0) {
        await lunchApi.setPollStatus(pollId, "active");
      } else if (endTimeChanged) {
        toast.error("End time must be in the future. Try a quick-pick like 60 m.");
        setSaving(false);
        return;
      } else if (cancelPoll) {
        await lunchApi.setPollStatus(pollId, "closed");
      }

      toast.success(endTimeChanged && remaining !== null && remaining > 0 ? "Poll extended" : "Poll updated");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update poll");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className={cn(LUNCH_POLL_MODAL_CONTENT, "!flex h-[min(92vh,760px)] max-h-[92vh]")}
      >
        <DialogTitle className="sr-only">Edit lunch poll</DialogTitle>
        <DialogDescription className="sr-only">Edit poll details and view votes.</DialogDescription>

        <div className={LUNCH_POLL_MODAL_HEADER}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700/90">
                Daily poll
              </p>
              <h2 className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">Edit lunch poll</h2>
              {pollDateLabel ? (
                <p className="mt-0.5 text-sm text-stone-600">{pollDateLabel}</p>
              ) : null}
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

        {loading ? (
          <div className={cn(LUNCH_POLL_MODAL_BODY, "flex min-h-[280px] flex-1 items-center justify-center")}>
            <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className={cn(LUNCH_POLL_MODAL_BODY, "flex min-h-0 flex-1 overflow-hidden")}>
            <div className="flex min-h-0 w-full flex-col gap-4 overflow-hidden md:flex-row">
              <aside className="w-full shrink-0 md:w-[min(280px,32%)] md:overflow-y-auto md:overscroll-contain md:pr-0.5 md:scrollbar-thinner">
                <div className="space-y-4">
                <LunchPollModalSectionCard
                  icon={CalendarDays}
                  title="Poll details"
                  accent={LUNCH_POLL_ACCENT.details}
                >
                  <div className="space-y-2.5">
                    <p className="text-xs text-stone-500">
                      Status:{" "}
                      <span
                        className={cn(
                          "font-semibold capitalize",
                          cancelPoll ? "text-stone-600" : expiredByTime ? "text-amber-700" : "text-orange-700",
                        )}
                      >
                        {cancelPoll ? "closed" : expiredByTime ? "expired" : "active"}
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-poll-title" className="text-xs font-medium text-stone-600">
                        Poll title <span className="text-orange-600">*</span>
                      </Label>
                      <Input
                        id="edit-poll-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-9 rounded-xl border-stone-200 bg-white text-sm font-medium focus-visible:border-orange-300 focus-visible:ring-orange-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-poll-end-time" className="text-xs font-medium text-stone-600">
                        Poll end time <span className="text-orange-600">*</span>
                      </Label>
                      <PmsTimePicker
                        id="edit-poll-end-time"
                        value={endTime}
                        onChange={applyEndTime}
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
                              onClick={() => applyEndTime(pollEndTimeFromNow(minutes), minutes)}
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100/80 bg-orange-50/20 px-3 py-2.5">
                      <p className="text-sm font-medium text-stone-900">Allow vote changes</p>
                      <Switch
                        checked={allowVoteChange}
                        onCheckedChange={setAllowVoteChange}
                        disabled={cancelPoll || cancelPollUpdating}
                        className="shrink-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100/80 bg-orange-50/20 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900">Close poll</p>
                        <p className="text-xs text-stone-500">Stops voting immediately</p>
                      </div>
                      <Switch
                        checked={cancelPoll}
                        onCheckedChange={(checked) => void handleCancelPollChange(checked)}
                        disabled={cancelPollUpdating || saving}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                </LunchPollModalSectionCard>
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 scrollbar-thinner">
                <div className="space-y-4">
                <LunchPollModalSectionCard
                  icon={UtensilsCrossed}
                  title="Menu options"
                  accent={LUNCH_POLL_ACCENT.menu}
                  action={
                    hasVotes ? null : (
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
                    )
                  }
                >
                  {hasVotes ? (
                    <p className="mb-2 text-xs text-stone-500">
                      Votes are in — you can edit option names and types only. Adding or removing options is disabled.
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((opt, i) => (
                      <div
                        key={opt.id ?? `new-${i}`}
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
                            className="h-8 min-w-0 flex-1 rounded-lg border-stone-200 bg-white text-sm font-medium focus-visible:border-orange-300 focus-visible:ring-orange-200"
                          />
                          {!hasVotes && options.length > 1 ? (
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

                {hasVotes && results ? (
                  <LunchPollModalSectionCard
                    icon={Users}
                    title={`Votes (${results.totalVotes})`}
                    accent={LUNCH_POLL_ACCENT.votes}
                  >
                    <div className="space-y-3">
                      {results.options.map((opt) => (
                        <div
                          key={opt.optionId}
                          className="rounded-xl border border-orange-100/80 bg-gradient-to-br from-white to-orange-50/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-stone-900">{opt.label}</p>
                            <span className="text-xs font-medium tabular-nums text-stone-500">
                              {opt.count} vote{opt.count === 1 ? "" : "s"}
                            </span>
                          </div>
                          {opt.voters && opt.voters.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {opt.voters.map((v) => (
                                <li
                                  key={v.userId}
                                  className="flex items-center gap-2 text-sm text-stone-700"
                                >
                                  <span
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: avatarColor(v.userName) }}
                                  >
                                    {initials(v.userName)}
                                  </span>
                                  <span className="truncate">{v.userName}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-stone-400">No votes</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </LunchPollModalSectionCard>
                ) : null}
                </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
