import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { lunchApi, type LunchPollDto, type LunchPollSummaryDto } from "@/lib/lunchApi";
import { LunchOrderSummaryToolbar } from "@/components/lunch/LunchOrderSummaryToolbar";
import { LunchOrderSummaryStats } from "@/components/lunch/LunchOrderSummaryStats";
import { LunchOrderSummaryOptionsTable } from "@/components/lunch/LunchOrderSummaryOptionsTable";
import { LunchOrderSummaryVotersTable } from "@/components/lunch/LunchOrderSummaryVotersTable";
import {
  LunchOrderSummarySkeleton,
  LunchOrderSummaryStatsSkeleton,
} from "@/components/lunch/LunchOrderSummarySkeleton";
import { lunchPollStatusPillClass } from "@/components/lunch/lunchPollsListStyles";

export function LunchOrderSummaryPanel() {
  const [polls, setPolls] = useState<LunchPollDto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<LunchPollSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const list = await lunchApi.listPolls();
        setPolls(list);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load polls");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSummary = useCallback(async () => {
    if (!selectedId) return;
    setLoadingSummary(true);
    try {
      setSummary(await lunchApi.getPollSummary(selectedId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load summary");
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setSearch("");
    void loadSummary();
  }, [loadSummary]);

  const selectedPoll = useMemo(
    () => polls.find((p) => p.id === selectedId) ?? null,
    [polls, selectedId],
  );

  if (loading) {
    return <LunchOrderSummarySkeleton />;
  }

  if (polls.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-orange-200/80 bg-gradient-to-br from-orange-50/40 to-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(251,146,60,0.06)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
          <ClipboardList className="h-6 w-6" />
        </span>
        <h2 className="text-base font-semibold text-stone-900">No polls yet</h2>
        <p className="max-w-sm text-[13px] text-stone-500">
          Create a lunch poll first — order summary will appear here once employees start voting.
        </p>
      </div>
    );
  }

  const showInitialSummaryLoad = loadingSummary && !summary;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
      <LunchOrderSummaryToolbar
        polls={polls}
        selectedId={selectedId}
        onSelectPoll={setSelectedId}
        summary={summary}
        search={search}
        onSearchChange={setSearch}
      />

      {selectedPoll && (summary || showInitialSummaryLoad) ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-orange-100/80 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/30 px-4 py-2.5 text-[13px] shadow-[0_2px_10px_rgba(251,146,60,0.06)] sm:py-3",
          )}
        >
          <span className="font-semibold text-stone-800">
            {format(new Date(selectedPoll.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}
          </span>
          <span className="text-orange-200">·</span>
          <span className="truncate text-stone-600">{selectedPoll.title}</span>
          <span
            className={cn(
              "ml-auto inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide",
              lunchPollStatusPillClass(selectedPoll.status),
            )}
          >
            {selectedPoll.status}
          </span>
        </div>
      ) : null}

      {showInitialSummaryLoad ? (
        <>
          <div className="shrink-0">
            <LunchOrderSummaryStatsSkeleton />
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:gap-4 xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch">
            <LunchOrderSummaryOptionsTable
              options={[]}
              onReload={() => void loadSummary()}
              reloading
            />
            <LunchOrderSummaryVotersTable
              voters={[]}
              search={search}
              onReload={() => void loadSummary()}
              reloading
            />
          </div>
        </>
      ) : summary ? (
        <>
          <div className="shrink-0">
            <LunchOrderSummaryStats summary={summary} />
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:gap-4 xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch">
            <LunchOrderSummaryOptionsTable
              options={summary.options}
              onReload={() => void loadSummary()}
              reloading={loadingSummary}
            />
            <LunchOrderSummaryVotersTable
              voters={summary.voters}
              search={search}
              onReload={() => void loadSummary()}
              reloading={loadingSummary}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
