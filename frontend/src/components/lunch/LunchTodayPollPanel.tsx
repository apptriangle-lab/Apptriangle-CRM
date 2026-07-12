import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatBalanceBdt,
  formatBdt,
  lunchApi,
  type LunchPollDto,
  type LunchPollOptionDto,
  type LunchVoteDto,
} from "@/lib/lunchApi";
import { LUNCH_CARD, LUNCH_OPTION_TYPE_COLORS, LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";

type Props = {
  onBalanceChange?: (balance: number) => void;
};

export function LunchTodayPollPanel({ onBalanceChange }: Props) {
  const [poll, setPoll] = useState<LunchPollDto | null>(null);
  const [myVote, setMyVote] = useState<LunchVoteDto | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await lunchApi.getTodayPoll();
      setPoll(r.poll);
      setMyVote(r.myVote);
      setSelected(r.myVote?.optionId ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load poll");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!poll || !selected) return;
    setSubmitting(true);
    try {
      const r = await lunchApi.castVote(poll.id, selected);
      setMyVote(r.vote);
      onBalanceChange?.(r.balance);
      toast.success(myVote ? "Vote updated" : "Vote submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={cn(LUNCH_CARD, "flex min-h-[280px] items-center justify-center p-8")}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className={cn(LUNCH_CARD, "p-8 text-center")}>
        <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <h3 className="text-base font-semibold text-slate-800">No poll for today</h3>
        <p className="mt-1 text-sm text-slate-500">Check back later — admin hasn&apos;t opened today&apos;s lunch poll yet.</p>
      </div>
    );
  }

  const isClosed = poll.status === "closed";
  const canChange = poll.allowVoteChange && !isClosed;
  const options = poll.options ?? [];

  return (
    <div className={cn(LUNCH_CARD, "overflow-hidden")}>
      <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50/80 via-white to-indigo-50/40 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {format(new Date(poll.date + "T12:00:00"), "EEEE, MMM d, yyyy")}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{poll.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Daily cost: <span className="font-medium text-slate-700">{formatBalanceBdt(poll.costAmount)}</span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 capitalize",
              poll.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-600",
            )}
          >
            {poll.status}
          </Badge>
        </div>
        {myVote && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200/80 bg-indigo-50/60 px-3 py-1.5 text-sm text-indigo-900">
            <Check className="h-4 w-4 text-indigo-600" />
            Already voted: <span className="font-semibold">{myVote.optionLabel}</span>
            {myVote.balanceChange != null && myVote.balanceChange !== 0 && (
              <span className="text-indigo-700">({formatBdt(myVote.balanceChange)})</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 p-4 sm:p-5">
        {options.map((opt) => (
          <OptionRow
            key={opt.id}
            option={opt}
            costAmount={poll.costAmount}
            selected={selected === opt.id}
            disabled={isClosed || (Boolean(myVote) && !canChange && selected !== opt.id)}
            onSelect={() => setSelected(opt.id)}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
        {isClosed ? (
          <p className="text-center text-sm text-slate-500">This poll is closed. No more votes accepted.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {canChange ? "You can change your vote until the poll closes." : "One vote per day — changes disabled."}
            </p>
            <Button
              onClick={() => void submit()}
              disabled={!selected || submitting || selected === myVote?.optionId}
              className="h-9 rounded-lg bg-indigo-600 px-5 text-[13px] hover:bg-indigo-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : myVote ? "Update vote" : "Submit vote"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionRow({
  option,
  costAmount,
  selected,
  disabled,
  onSelect,
}: {
  option: LunchPollOptionDto;
  costAmount: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const change =
    option.optionType === "personal"
      ? costAmount
      : option.optionType === "off"
        ? 0
        : -costAmount;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-indigo-300 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200/80"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80",
        disabled && !selected && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{option.label}</span>
          <span
            className={cn(
              "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
              LUNCH_OPTION_TYPE_COLORS[option.optionType],
            )}
          >
            {LUNCH_OPTION_TYPE_LABELS[option.optionType]}
          </span>
        </div>
        {change !== 0 && (
          <p className="mt-0.5 text-xs text-slate-500">Balance impact: {formatBdt(change)}</p>
        )}
      </div>
    </button>
  );
}
