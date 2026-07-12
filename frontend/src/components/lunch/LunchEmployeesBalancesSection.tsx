import { Loader2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBalanceBdt, formatBdt, type LunchEmployeeBalanceDto } from "@/lib/lunchApi";
import { LunchEmployeeAdjustDialog } from "@/components/lunch/LunchEmployeeAdjustDialog";
import { formatLunchDateRangeLabel, type LunchDateRange } from "@/components/lunch/lunchDateRangeUtils";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_ROW,
  LUNCH_ORDER_TABLE_HEAD,
  LUNCH_ORDER_TITLE_PL,
} from "@/components/lunch/lunchOrderSummaryStyles";

const EMPLOYEES_COL_GRID =
  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,100px)_72px] items-center gap-x-2 sm:gap-x-3";

type Props = {
  className?: string;
  items: LunchEmployeeBalanceDto[];
  loading: boolean;
  onRefresh: () => void;
  adjustTarget: LunchEmployeeBalanceDto | null;
  onAdjustTargetChange: (employee: LunchEmployeeBalanceDto | null) => void;
  dateRange: LunchDateRange;
  periodActive: boolean;
};

export function LunchEmployeesBalancesSection({
  className,
  items,
  loading,
  onRefresh,
  adjustTarget,
  onAdjustTargetChange,
  dateRange,
  periodActive,
}: Props) {
  const periodLabel = formatLunchDateRangeLabel(dateRange);

  return (
    <>
      <div className={cn(LUNCH_ORDER_CARD, "flex min-h-0 flex-col", className)}>
        <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-900">
              {periodActive ? "Period balance" : "Wallet balances"}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {periodActive
                ? `Total lunch vote balance for ${periodLabel}`
                : "Current lunch balance per employee"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[160px] flex-1 items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto scrollbar-table">
            <div className="min-w-[560px]">
              <div
                role="row"
                className={cn(
                  EMPLOYEES_COL_GRID,
                  LUNCH_ORDER_LIST_HPAD,
                  LUNCH_ORDER_TABLE_HEAD,
                )}
              >
                <span className={LUNCH_ORDER_TITLE_PL}>Employee</span>
                <span>Email</span>
                <span className="text-right">{periodActive ? "Period total" : "Balance"}</span>
                <span className="text-right">Actions</span>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                    <Users className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium text-stone-700">No employees match your search</p>
                  <p className="text-xs text-stone-500">Try a different name or clear filters.</p>
                </div>
              ) : (
                items.map((row) => {
                  const amount = periodActive ? (row.periodBalanceChange ?? 0) : row.balance;
                  return (
                    <div
                      key={row.userId}
                      role="row"
                      className={cn(
                        EMPLOYEES_COL_GRID,
                        LUNCH_ORDER_LIST_HPAD,
                        LUNCH_ORDER_ROW,
                      )}
                    >
                      <div className={cn("flex min-w-0 items-center gap-2.5", LUNCH_ORDER_TITLE_PL)}>
                        <PmsMemberAvatar name={row.userName} userId={row.userId} size="sm" />
                        <span className="truncate font-medium text-stone-800">{row.userName}</span>
                      </div>
                      <span className="min-w-0 truncate text-stone-600">{row.email}</span>
                      <span
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          amount < 0 ? "text-rose-700" : amount > 0 ? "text-emerald-700" : "text-stone-800",
                        )}
                      >
                        {periodActive ? formatBdt(amount) : formatBalanceBdt(amount)}
                      </span>
                      <div className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-[13px] text-stone-600 hover:bg-orange-50 hover:text-orange-900"
                          onClick={() => onAdjustTargetChange(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Adjust
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <LunchEmployeeAdjustDialog
        employee={adjustTarget}
        dateRange={dateRange}
        onClose={() => onAdjustTargetChange(null)}
        onSaved={onRefresh}
      />
    </>
  );
}
