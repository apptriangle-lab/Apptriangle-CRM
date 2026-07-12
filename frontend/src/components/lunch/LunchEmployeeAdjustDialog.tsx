import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentMonthKey, monthLabel } from "@/components/lunch/lunchMonthUtils";
import {
  formatLunchDateRangeLabel,
  lunchDateRangeToIso,
  type LunchDateRange,
} from "@/components/lunch/lunchDateRangeUtils";
import {
  formatBalanceDisplay,
  formatBdt,
  lunchApi,
  type LunchAdminUserMonthDetailDto,
  type LunchAdminUserMonthPollDto,
  type LunchEmployeeBalanceDto,
} from "@/lib/lunchApi";
import { LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { getPollOptionVisual } from "@/components/lunch/lunchPollOptionVisuals";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_ROW,
  lunchOrderTypePillClass,
} from "@/components/lunch/lunchOrderSummaryStyles";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { cn } from "@/lib/utils";

type Props = {
  employee: LunchEmployeeBalanceDto | null;
  dateRange: LunchDateRange;
  onClose: () => void;
  onSaved: () => void;
};

function PollVoteSelect({
  row,
  saving,
  onChange,
}: {
  row: LunchAdminUserMonthPollDto;
  saving: boolean;
  onChange: (optionId: string) => void;
}) {
  const selectValue = row.optionId ?? undefined;
  const selectedOpt = row.options.find((o) => o.id === selectValue);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={selectValue}
        onValueChange={onChange}
        disabled={saving || row.options.length === 0}
      >
        <SelectTrigger className="h-9 w-full rounded-xl border-stone-200 bg-white text-left focus:ring-orange-200 sm:min-w-[180px] sm:flex-1">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          ) : (
            <SelectValue placeholder="No vote — select" />
          )}
        </SelectTrigger>
        <SelectContent className="rounded-xl border-orange-100 bg-white text-stone-900">
          {row.options.map((opt) => (
            <SelectItem
              key={opt.id}
              value={opt.id}
              className="rounded-lg text-stone-900 focus:bg-orange-50 focus:text-stone-900 data-[highlighted]:bg-orange-50 data-[highlighted]:text-stone-900"
            >
              {opt.label}
              <span className="sr-only">
                {" "}
                ({LUNCH_OPTION_TYPE_LABELS[opt.optionType] ?? opt.optionType})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedOpt ? (
        <span
          className={cn(
            "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            lunchOrderTypePillClass(selectedOpt.optionType),
          )}
        >
          {LUNCH_OPTION_TYPE_LABELS[selectedOpt.optionType] ?? selectedOpt.optionType}
        </span>
      ) : null}
    </div>
  );
}

export function LunchEmployeeAdjustDialog({ employee, dateRange, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<LunchAdminUserMonthDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingPollId, setSavingPollId] = useState<string | null>(null);

  const periodQuery = useMemo(() => {
    const iso = lunchDateRangeToIso(dateRange);
    if (iso.from && iso.to) return { from: iso.from, to: iso.to };
    return { month: currentMonthKey() };
  }, [dateRange]);

  const periodLabel = useMemo(() => {
    const iso = lunchDateRangeToIso(dateRange);
    if (iso.from && iso.to) return formatLunchDateRangeLabel(dateRange);
    return monthLabel(currentMonthKey());
  }, [dateRange]);

  const load = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const data = await lunchApi.getAdminUserMonthDetail(employee.userId, periodQuery);
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load employee lunch data");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [employee, periodQuery]);

  useEffect(() => {
    if (employee) {
      void load();
    } else {
      setDetail(null);
    }
  }, [employee, load]);

  const updatePollRow = (pollId: string, patch: Partial<LunchAdminUserMonthPollDto>) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((row) => (row.pollId === pollId ? { ...row, ...patch } : row)),
      };
    });
  };

  const handleOptionChange = async (row: LunchAdminUserMonthPollDto, optionId: string) => {
    if (!employee || optionId === row.optionId) return;
    setSavingPollId(row.pollId);
    try {
      const result = await lunchApi.adminSetUserVote(row.pollId, employee.userId, optionId);
      const selected = row.options.find((o) => o.id === optionId);
      updatePollRow(row.pollId, {
        voteId: result.vote.id,
        optionId,
        optionLabel: selected?.label ?? result.vote.optionLabel ?? null,
        optionType: selected?.optionType ?? result.vote.optionType ?? null,
        balanceChange: result.balanceChange,
      });
      const refreshed = await lunchApi.getAdminUserMonthDetail(employee.userId, periodQuery);
      setDetail(refreshed);
      void queryClient.invalidateQueries({ queryKey: lunchQueryKeys.snapshotPrefix });
      void queryClient.refetchQueries({ queryKey: lunchQueryKeys.snapshotPrefix });
      void queryClient.invalidateQueries({ queryKey: lunchQueryKeys.todayPoll });
      void queryClient.invalidateQueries({ queryKey: ["lunchMonthTotal"] });
      void queryClient.invalidateQueries({ queryKey: ["voteHistory"] });
      toast.success("Vote updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update vote");
    } finally {
      setSavingPollId(null);
    }
  };

  const periodTotal = detail?.periodNetChange ?? detail?.monthNetChange ?? 0;

  return (
    <Dialog open={Boolean(employee)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden rounded-3xl border-stone-200/80 p-0 shadow-[0_8px_30px_rgba(251,146,60,0.12)] [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-lg [&>button]:hover:bg-orange-50">
        <DialogHeader className="relative overflow-hidden border-b border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white px-5 py-4 pr-12">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-200/30 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
              <Pencil className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-base font-bold leading-snug text-stone-900">
                Adjust lunch — {employee?.userName}
              </DialogTitle>
              <p className="mt-1 text-sm font-normal text-stone-500">{employee?.email}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto bg-[#FFFBF7] px-5 py-4 scrollbar-thinner">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200/70 bg-gradient-to-r from-orange-50/80 to-amber-50/40 px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Period total</p>
              <p className="mt-0.5 truncate text-xs text-stone-500">{periodLabel}</p>
            </div>
            <p
              className={cn(
                "shrink-0 text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
                periodTotal < 0 ? "text-rose-600" : periodTotal > 0 ? "text-emerald-600" : "text-stone-900",
              )}
            >
              {loading ? "—" : formatBalanceDisplay(periodTotal)}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : detail && detail.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">No polls in {periodLabel}.</p>
          ) : (
            <div className={cn(LUNCH_ORDER_CARD, "overflow-hidden")}>
              <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-stone-900">Polls in period</h2>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {detail?.items.length ?? 0} poll{(detail?.items.length ?? 0) === 1 ? "" : "s"} · tap vote to change
                  </p>
                </div>
              </div>

              <div className="max-h-[min(42vh,360px)] overflow-y-auto scrollbar-thinner">
                {detail?.items.map((row) => {
                  const saving = savingPollId === row.pollId;
                  const selectedOpt = row.options.find((o) => o.id === row.optionId);
                  const visual = selectedOpt ? getPollOptionVisual(selectedOpt.optionType) : null;
                  const Icon = visual?.icon;
                  const amount = row.balanceChange;

                  return (
                    <div
                      key={row.pollId}
                      className={cn(
                        LUNCH_ORDER_LIST_HPAD,
                        LUNCH_ORDER_ROW,
                        "space-y-3 py-3.5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex shrink-0 rounded-lg border border-orange-100 bg-orange-50/80 px-2 py-1 text-[11px] font-semibold tabular-nums text-orange-800">
                            {row.pollDate ? format(parseISO(row.pollDate), "MMM d") : "—"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-stone-900" title={row.pollTitle}>
                              {row.pollTitle}
                            </p>
                            {selectedOpt ? (
                              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-500">
                                {Icon ? (
                                  <Icon className={cn("h-3.5 w-3.5 shrink-0", visual?.iconClass)} />
                                ) : null}
                                <span className="truncate">{selectedOpt.label}</span>
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-stone-400">No vote yet</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            amount != null && amount < 0
                              ? "text-rose-700"
                              : amount != null && amount > 0
                                ? "text-emerald-700"
                                : "text-stone-700",
                          )}
                        >
                          {amount != null ? formatBdt(amount) : "—"}
                        </span>
                      </div>

                      <PollVoteSelect
                        row={row}
                        saving={saving}
                        onChange={(value) => void handleOptionChange(row, value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-orange-100/80 bg-white px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-stone-200 hover:border-orange-200 hover:bg-orange-50/50 hover:text-stone-900"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
