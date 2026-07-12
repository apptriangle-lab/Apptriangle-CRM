import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Clock, Loader2, Sparkles, UtensilsCrossed, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { LunchPollOptionCard } from "@/components/lunch/LunchPollOptionCard";
import { LunchViewVotesDialog } from "@/components/lunch/LunchViewVotesDialog";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { useLunchSnapshotQuery } from "@/features/lunch/useLunchSnapshotQuery";
import {
  lunchApi,
  type LunchPollOptionDto,
  type LunchSnapshotMyVoteDto,
  type LunchSnapshotOptionDto,
  type LunchSnapshotPollItem,
} from "@/lib/lunchApi";
import {
  applyOptimisticVoteCounts,
  formatPollCountdown,
  formatPollEndTimeLabel,
  getPollRemainingMs,
  isPollExpired,
} from "@/components/lunch/lunchPollUtils";

type Props = {
  onBalanceChange?: (balance: number) => void;
  onVoteChange?: (payload?: { balance?: number; monthNetChange?: number }) => void;
};

function myVoteOptionId(myVote: LunchSnapshotMyVoteDto | null | undefined): string | null {
  if (!myVote) return null;
  const id = myVote.optionId ?? myVote.option_id;
  return id != null ? String(id) : null;
}

export function LunchWhatsAppPoll({ onBalanceChange, onVoteChange }: Props) {
  const queryClient = useQueryClient();
  const { data: lunchSnapshot, isLoading, isError, error, refetch } = useLunchSnapshotQuery();
  const prevBalanceRef = useRef<number | undefined>(undefined);

  const items = lunchSnapshot?.items ?? [];

  useEffect(() => {
    if (typeof lunchSnapshot?.balance === "number" && lunchSnapshot.balance !== prevBalanceRef.current) {
      prevBalanceRef.current = lunchSnapshot.balance;
      onBalanceChange?.(lunchSnapshot.balance);
    }
    if (typeof lunchSnapshot?.monthNetChange === "number") {
      onVoteChange?.({
        balance: lunchSnapshot.balance,
        monthNetChange: lunchSnapshot.monthNetChange,
      });
    }
  }, [lunchSnapshot?.balance, lunchSnapshot?.monthNetChange, onBalanceChange, onVoteChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-[480px] w-full items-center justify-center rounded-3xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgba(251,146,60,0.08)]">
        <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[480px] w-full flex-col items-center justify-center rounded-3xl border border-red-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load lunch snapshot"}
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-orange-600 hover:underline"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[480px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200/80 bg-gradient-to-br from-orange-50/40 to-white px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-stone-900">No poll today</h3>
        <p className="mt-2 max-w-xs text-sm text-stone-500">
          Today&apos;s lunch menu hasn&apos;t been posted yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {items.map((item) => (
        <WhatsAppPollCard
          key={`${item.poll.id}-${item.myVote?.updatedAt ?? item.myVote?.updated_at ?? "none"}`}
          item={item}
          onVoted={() => {
            void queryClient.invalidateQueries({ queryKey: lunchQueryKeys.snapshotPrefix });
            void queryClient.refetchQueries({ queryKey: lunchQueryKeys.snapshotPrefix });
          }}
          onBalanceChange={onBalanceChange}
          onVoteChange={onVoteChange}
        />
      ))}
    </div>
  );
}

function WhatsAppPollCard({
  item,
  onVoted,
  onBalanceChange,
  onVoteChange,
}: {
  item: LunchSnapshotPollItem;
  onVoted: () => void;
  onBalanceChange?: (balance: number) => void;
  onVoteChange?: (payload?: { balance?: number; monthNetChange?: number }) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [optimisticOptionId, setOptimisticOptionId] = useState<string | null>(null);
  const [viewVotesOpen, setViewVotesOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const poll = item.poll;
  const results = item.results ?? null;
  // Single source of truth: snapshot.my_vote.option_id from the server.
  const selectedOptionId = myVoteOptionId(item.myVote ?? item.my_vote);
  const displaySelectedOptionId = optimisticOptionId ?? selectedOptionId;
  const hasVote = selectedOptionId != null;

  useEffect(() => {
    if (optimisticOptionId != null && selectedOptionId != null && String(selectedOptionId) === optimisticOptionId) {
      setOptimisticOptionId(null);
    }
  }, [optimisticOptionId, selectedOptionId]);

  useEffect(() => {
    if (!poll || poll.status !== "active" || !poll.endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [poll?.id, poll?.status, poll?.endsAt]);

  useEffect(() => {
    if (!poll?.endsAt || poll.status === "closed") return;
    const remaining = getPollRemainingMs(poll.endsAt, now);
    if (remaining !== null && remaining <= 0) {
      void queryClient.invalidateQueries({ queryKey: lunchQueryKeys.snapshotPrefix });
    }
  }, [now, poll?.endsAt, poll?.status, queryClient]);

  const vote = async (optionId: string) => {
    if (!poll || poll.status === "closed" || isPollExpired(poll, now)) return;
    if (votingOptionId) return;
    if (displaySelectedOptionId != null && String(displaySelectedOptionId) === String(optionId)) return;
    if (hasVote && !poll.allowVoteChange) {
      toast.error("Vote changes are not allowed");
      return;
    }

    setOptimisticOptionId(optionId);
    setVotingOptionId(optionId);
    try {
      const r = await lunchApi.castVote(poll.id, optionId);
      onVoted();
      onBalanceChange?.(r.balance);
      onVoteChange?.({ balance: r.balance, monthNetChange: r.monthNetChange });
      toast.success(hasVote ? "Vote updated" : "Vote recorded");
    } catch (e) {
      setOptimisticOptionId(null);
      toast.error(e instanceof Error ? e.message : "Failed to submit vote");
    } finally {
      setVotingOptionId(null);
    }
  };

  const isClosed = poll.status === "closed" || isPollExpired(poll, now);
  const remainingMs = getPollRemainingMs(poll.endsAt, now);
  const pollEndTimeLabel = formatPollEndTimeLabel(poll);
  const options = (poll.options ?? []) as LunchSnapshotOptionDto[];
  const baseTotalVotes =
    typeof poll.totalVotes === "number"
      ? poll.totalVotes
      : options.reduce((sum, o) => sum + (o.count ?? 0), 0);
  const { options: displayOptions, totalVotes } = applyOptimisticVoteCounts(
    options,
    baseTotalVotes,
    selectedOptionId,
    optimisticOptionId,
  );
  const showResults = totalVotes > 0;
  const pollTime = poll.updatedAt
    ? format(new Date(poll.updatedAt), "h:mm a")
    : format(new Date(), "h:mm a");
  const headerName = user?.name ?? "Lunch";

  return (
    <>
      <div className="flex min-h-[480px] w-full flex-col">
        <div className="w-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgba(251,146,60,0.1)]">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50/70 to-white px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-200/30 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600 ring-1 ring-orange-200/70">
                    <Sparkles className="h-3 w-3" />
                    {isClosed ? "Poll closed" : "Live poll"}
                  </span>
                  {showResults && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200/80">
                      <Users className="h-3 w-3" />
                      {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <h2 className="mt-2.5 text-xl font-bold leading-tight tracking-tight text-stone-900 sm:text-2xl">
                  {poll.title}
                </h2>
                <p className="mt-1 text-sm text-stone-500">{headerName}</p>
              </div>

              {!isClosed && poll.endsAt && remainingMs !== null && remainingMs > 0 && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100/90 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200/80">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span className="text-xs font-semibold tabular-nums">
                    {formatPollCountdown(remainingMs)}
                  </span>
                </div>
              )}
              {isClosed && pollEndTimeLabel ? (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100/90 px-3 py-1.5 text-stone-700 ring-1 ring-stone-200/80">
                  <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  <span className="text-xs font-semibold tabular-nums">{pollEndTimeLabel}</span>
                </div>
              ) : null}
            </div>

            {isClosed ? (
              <p className="relative mt-3 text-xs text-stone-500">
                {pollEndTimeLabel
                  ? `Poll timed out at ${pollEndTimeLabel}. This poll is closed.`
                  : "This poll is closed."}
              </p>
            ) : (
              <p className="relative mt-3 text-xs text-stone-500">
                Tap an option below to {hasVote ? "change your vote" : "cast your vote"}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            {displayOptions.map((opt) => {
              const isSelected =
                displaySelectedOptionId != null && String(displaySelectedOptionId) === String(opt.id);
              const result = {
                optionId: opt.id,
                label: opt.label || opt.name || "",
                optionType: opt.optionType,
                count: opt.count ?? 0,
                voters: opt.voters,
              };
              return (
                <LunchPollOptionCard
                  key={opt.id}
                  option={opt as LunchPollOptionDto}
                  result={result}
                  totalVotes={totalVotes}
                  selected={isSelected}
                  pending={votingOptionId === opt.id}
                  showResults={showResults}
                  disabled={isClosed || (hasVote && !poll.allowVoteChange && !isSelected)}
                  onSelect={() => void vote(opt.id)}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 py-3 sm:px-6">
            <span className="text-[11px] text-stone-400">Updated {pollTime}</span>
            {showResults && (
              <button
                type="button"
                onClick={() => setViewVotesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/50 px-3.5 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100/80"
              >
                <BarChart3 className="h-4 w-4" />
                View all votes
              </button>
            )}
          </div>
        </div>
      </div>

      <LunchViewVotesDialog
        open={viewVotesOpen}
        onOpenChange={setViewVotesOpen}
        poll={poll}
        results={results}
        options={displayOptions}
        totalVotes={totalVotes}
      />
    </>
  );
}
