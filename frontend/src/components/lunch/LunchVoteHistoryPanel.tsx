import { useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { formatBdt, formatBalanceDisplay, lunchApi, type LunchVoteDto } from "@/lib/lunchApi";
import { LUNCH_CARD, LUNCH_OPTION_TYPE_COLORS } from "@/components/lunch/lunchConstants";
import { monthLabel, monthToDateRange } from "@/components/lunch/lunchMonthUtils";
import {
  LunchVoteHistoryTotalBar,
} from "@/components/lunch/LunchVoteHistoryTotalBar";

type Props = {
  userId?: string;
  adminView?: boolean;
  embedded?: boolean;
  userTheme?: boolean;
  /** yyyy-MM — limits rows to that calendar month (ignored when from/to set) */
  month?: string;
  from?: string;
  to?: string;
  /** Show range total from API (default true when from+to provided) */
  showRangeTotal?: boolean;
};

export function LunchVoteHistoryPanel({
  userId,
  adminView = false,
  embedded = false,
  userTheme = false,
  month,
  from: fromProp,
  to: toProp,
  showRangeTotal,
}: Props) {
  const rangeActive = Boolean(fromProp && toProp);
  const showTotal = showRangeTotal ?? rangeActive;
  const monthScoped = Boolean(month) && !rangeActive;
  const emptyLabel = monthScoped
    ? `No votes in ${monthLabel(month!)}`
    : rangeActive
      ? "No votes in this date range"
      : "No vote history yet";

  const historyParams = useMemo(() => {
    const params: { userId?: string; from?: string; to?: string; month?: string } = userId
      ? { userId }
      : adminView
        ? { userId: "all" }
        : {};
    if (fromProp && toProp) {
      params.from = fromProp;
      params.to = toProp;
    } else if (month) {
      const range = monthToDateRange(month);
      params.from = range.from;
      params.to = range.to;
      params.month = month;
    }
    return params;
  }, [userId, adminView, month, fromProp, toProp]);

  const { data, isLoading: loading } = useQuery({
    queryKey: lunchQueryKeys.voteHistory(historyParams),
    queryFn: async () => {
      const apiParams: { userId?: string; from?: string; to?: string } = {};
      if (historyParams.userId) apiParams.userId = historyParams.userId;
      if (historyParams.from) apiParams.from = historyParams.from;
      if (historyParams.to) apiParams.to = historyParams.to;
      return lunchApi.getVoteHistory(Object.keys(apiParams).length ? apiParams : undefined);
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];
  const totalBalanceChange = data?.totalBalanceChange ?? 0;

  const displayItems = items;

  const showRunningBalance = !showTotal && !monthScoped && !adminView;
  const colCount = useMemo(() => {
    let n = 4;
    if (adminView) n += 1;
    if (showRunningBalance) n += 1;
    return n;
  }, [adminView, showRunningBalance]);

  if (loading) {
    return (
      <div
        className={cn(
          embedded ? "flex min-h-[120px] items-center justify-center" : LUNCH_CARD,
          "flex min-h-[200px] items-center justify-center p-8",
        )}
      >
        <Loader2 className={cn("h-6 w-6 animate-spin", userTheme ? "text-orange-500" : "text-indigo-500")} />
      </div>
    );
  }

  const showMobileCards = embedded && userTheme && !adminView;
  const tableMinWidth = embedded && userTheme ? undefined : "min-w-[640px]";

  return (
    <div className="space-y-3">
      {showTotal ? (
        <LunchVoteHistoryTotalBar
          total={totalBalanceChange}
          dayCount={displayItems.length}
          userTheme={userTheme}
        />
      ) : null}

      {showMobileCards && (
        <div className="space-y-2 md:hidden">
          {displayItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{emptyLabel}</p>
          ) : (
            displayItems.map((row) => (
              <UserHistoryCard key={row.id} row={row} hideBalance={!showRunningBalance} />
            ))
          )}
        </div>
      )}

      <div
        className={cn(
          embedded
            ? userTheme
              ? "overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_4px_16px_rgba(251,146,60,0.06)]"
              : "overflow-hidden rounded-xl border border-slate-200"
            : LUNCH_CARD,
          "overflow-hidden",
          showMobileCards && "hidden md:block",
        )}
      >
        <div className={cn(embedded && userTheme ? "overflow-x-hidden" : "overflow-x-auto scrollbar-table")}>
          <table className={cn("w-full table-fixed text-left text-sm", tableMinWidth)}>
            <thead
              className={cn(
                "sticky top-0 border-b",
                userTheme ? "border-orange-100 bg-orange-50/60" : "border-slate-200 bg-slate-50/95",
              )}
            >
              <tr>
                <th
                  className={cn(
                    "w-[18%] px-3 py-3 text-xs font-semibold uppercase tracking-wide sm:px-4",
                    userTheme ? "text-orange-700/80" : "text-slate-500",
                  )}
                >
                  Date
                </th>
                {adminView && (
                  <th
                    className={cn(
                      "w-[16%] px-3 py-3 text-xs font-semibold uppercase tracking-wide sm:px-4",
                      userTheme ? "text-orange-700/80" : "text-slate-500",
                    )}
                  >
                    Employee
                  </th>
                )}
                <th
                  className={cn(
                    "px-3 py-3 text-xs font-semibold uppercase tracking-wide sm:px-4",
                    adminView ? "w-[22%]" : "w-[28%]",
                    userTheme ? "text-orange-700/80" : "text-slate-500",
                  )}
                >
                  Menu item
                </th>
                <th
                  className={cn(
                    "w-[14%] px-3 py-3 text-xs font-semibold uppercase tracking-wide sm:px-4",
                    userTheme ? "text-orange-700/80" : "text-slate-500",
                  )}
                >
                  Type
                </th>
                <th
                  className={cn(
                    "w-[18%] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide sm:px-4",
                    userTheme ? "text-orange-700/80" : "text-slate-500",
                  )}
                >
                  {userTheme ? "Amount" : "Daily amount"}
                </th>
                {showRunningBalance && (
                  <th
                    className={cn(
                      "w-[18%] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide sm:px-4",
                      userTheme ? "text-orange-700/80" : "text-slate-500",
                    )}
                  >
                    {userTheme ? "Balance" : "Running balance"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={cn("divide-y", userTheme ? "divide-orange-50" : "divide-slate-100")}>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-slate-500">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                displayItems.map((row) => (
                  <tr
                    key={row.id}
                    className={cn("transition-colors", userTheme ? "hover:bg-orange-50/50" : "hover:bg-slate-50/60")}
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700 sm:px-4">
                      <div>
                        {row.pollDate ? format(new Date(row.pollDate + "T12:00:00"), "MMM d, yyyy") : "—"}
                        {row.pollTitle ? (
                          <p className="mt-0.5 max-w-[140px] truncate text-[11px] font-normal text-slate-500" title={row.pollTitle}>
                            {row.pollTitle}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    {adminView && (
                      <td className="truncate px-3 py-3 font-medium text-slate-800 sm:px-4">{row.userName ?? "—"}</td>
                    )}
                    <td className="truncate px-3 py-3 font-medium text-slate-900 sm:px-4" title={row.optionLabel ?? ""}>
                      {row.optionLabel ?? "—"}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      {row.optionType && (
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset",
                            LUNCH_OPTION_TYPE_COLORS[row.optionType],
                          )}
                        >
                          {row.optionType}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-medium tabular-nums sm:px-4">
                      {row.balanceChange != null && row.balanceChange !== 0 ? (
                        <span className={row.balanceChange > 0 ? "text-emerald-700" : "text-rose-700"}>
                          {formatBdt(row.balanceChange)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {showRunningBalance && (
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] tabular-nums sm:px-4">
                        {row.runningBalance != null ? (
                          <span
                            className={cn(
                              row.runningBalance < 0
                                ? "text-rose-700"
                                : row.runningBalance > 0
                                  ? "text-emerald-700"
                                  : "text-slate-600",
                            )}
                          >
                            {formatBalanceDisplay(row.runningBalance)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserHistoryCard({ row, hideBalance = false }: { row: LunchVoteDto; hideBalance?: boolean }) {
  return (
    <div className="rounded-2xl border border-orange-100/80 bg-white p-3.5 shadow-[0_2px_10px_rgba(251,146,60,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-orange-700/80">
            {row.pollDate ? format(new Date(row.pollDate + "T12:00:00"), "MMM d, yyyy") : "—"}
          </p>
          {row.pollTitle ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.pollTitle}</p>
          ) : null}
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{row.optionLabel ?? "—"}</p>
          {row.optionType && (
            <span
              className={cn(
                "mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset",
                LUNCH_OPTION_TYPE_COLORS[row.optionType],
              )}
            >
              {row.optionType}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          {row.balanceChange != null && row.balanceChange !== 0 ? (
            <p className={cn("text-sm font-semibold tabular-nums", row.balanceChange > 0 ? "text-emerald-700" : "text-rose-700")}>
              {formatBdt(row.balanceChange)}
            </p>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
          {!hideBalance && row.runningBalance != null && (
            <p
              className={cn(
                "mt-1 text-xs tabular-nums",
                row.runningBalance < 0 ? "text-rose-600" : row.runningBalance > 0 ? "text-emerald-600" : "text-slate-500",
              )}
            >
              {formatBalanceDisplay(row.runningBalance)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
