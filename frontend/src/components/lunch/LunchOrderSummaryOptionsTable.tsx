import { cn } from "@/lib/utils";
import type { LunchPollSummaryOptionDto } from "@/lib/lunchApi";
import { LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_OPTIONS_COL_GRID,
  LUNCH_ORDER_ROW,
  LUNCH_ORDER_TABLE_HEAD,
  LUNCH_ORDER_TITLE_PL,
  lunchOrderShareBarClass,
  lunchOrderTypePillClass,
} from "@/components/lunch/lunchOrderSummaryStyles";
import { LunchOrderSummaryReloadButton } from "@/components/lunch/LunchOrderSummaryReloadButton";
import { LunchOrderSummaryOptionsBodySkeleton } from "@/components/lunch/LunchOrderSummarySkeleton";

type Props = {
  options: LunchPollSummaryOptionDto[];
  onReload: () => void;
  reloading?: boolean;
};

export function LunchOrderSummaryOptionsTable({ options, onReload, reloading = false }: Props) {
  const maxCount = Math.max(...options.map((o) => o.count), 1);

  return (
    <div className={LUNCH_ORDER_CARD}>
      <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900">Menu breakdown</h2>
          <p className="mt-0.5 text-xs text-stone-500">Vote count per option</p>
        </div>
        <LunchOrderSummaryReloadButton onClick={onReload} loading={reloading} />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-table">
        <div className="w-full min-w-0">
          <div
            role="row"
            className={cn(
              LUNCH_ORDER_OPTIONS_COL_GRID,
              LUNCH_ORDER_LIST_HPAD,
              LUNCH_ORDER_TABLE_HEAD,
            )}
          >
            <span className={cn("min-w-0 truncate", LUNCH_ORDER_TITLE_PL)}>
              Menu item{" "}
              <span className="font-normal text-slate-400">
                ({reloading ? "…" : options.length})
              </span>
            </span>
            <span>Type</span>
            <span className="text-right">Votes</span>
            <span>Share</span>
          </div>

          {reloading ? (
            <LunchOrderSummaryOptionsBodySkeleton />
          ) : options.length === 0 ? (
            <div className={cn(LUNCH_ORDER_LIST_HPAD, "py-12 text-center text-sm text-slate-500")}>
              No menu options for this poll
            </div>
          ) : (
            options.map((opt) => {
              const barPct = maxCount > 0 ? (opt.count / maxCount) * 100 : 0;

              return (
                <div
                  key={opt.optionId}
                  role="row"
                  className={cn(
                    LUNCH_ORDER_OPTIONS_COL_GRID,
                    LUNCH_ORDER_LIST_HPAD,
                    LUNCH_ORDER_ROW,
                  )}
                >
                  <div className={cn("min-w-0", LUNCH_ORDER_TITLE_PL)}>
                    <p className="truncate font-medium text-slate-800">{opt.label}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-6 w-fit max-w-full min-w-0 items-center truncate rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide",
                      lunchOrderTypePillClass(opt.optionType),
                    )}
                  >
                    {LUNCH_OPTION_TYPE_LABELS[opt.optionType] ?? opt.optionType}
                  </span>
                  <span className="text-right text-base font-bold tabular-nums text-slate-900">
                    {opt.count}
                  </span>
                  <div className="min-w-0">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100/80">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          lunchOrderShareBarClass(opt.optionType),
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
