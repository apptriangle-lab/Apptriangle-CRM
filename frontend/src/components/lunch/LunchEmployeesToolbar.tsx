import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LunchDateRangeFilter } from "@/components/lunch/LunchDateRangeFilter";
import {
  LUNCH_EMPLOYEES_ALL,
  LunchEmployeesUserFilterDropdown,
} from "@/components/lunch/LunchEmployeesUserFilterDropdown";
import type { LunchDateRange } from "@/components/lunch/lunchDateRangeUtils";
import type { LunchEmployeeBalanceDto } from "@/lib/lunchApi";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export { LUNCH_EMPLOYEES_ALL };

type Props = {
  userFilter: string;
  onUserFilterChange: (userId: string) => void;
  employees: LunchEmployeeBalanceDto[];
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: LunchDateRange;
  onDateRangeChange: (range: LunchDateRange) => void;
  onAdjustBalance?: () => void;
  adjustDisabled?: boolean;
};

export function LunchEmployeesToolbar({
  userFilter,
  onUserFilterChange,
  employees,
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onAdjustBalance,
  adjustDisabled,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-stone-900">Employees</h1>
        
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:w-56 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Search employees…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "h-9 w-full rounded-xl border-stone-200 bg-white pl-9 text-[13px] shadow-sm",
              search.trim() && "border-orange-200 bg-orange-50/40",
            )}
          />
        </div>

        <LunchDateRangeFilter value={dateRange} onChange={onDateRangeChange} accent="orange" />

        <LunchEmployeesUserFilterDropdown
          value={userFilter}
          onChange={onUserFilterChange}
          employees={employees}
          align="end"
        />

        {userFilter !== LUNCH_EMPLOYEES_ALL && onAdjustBalance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adjustDisabled}
            onClick={onAdjustBalance}
            className="h-9 rounded-xl border-orange-200/80 bg-white text-[13px] text-stone-700 shadow-sm hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-900"
          >
            Adjust balance
          </Button>
        ) : null}
      </div>
    </div>
  );
}
