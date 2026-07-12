import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { AttendanceClearFiltersButton } from "@/components/attendance/AttendanceClearFiltersButton";
import { LeaveStatusFilterDropdown } from "@/components/leaves/LeaveStatusFilterDropdown";
import { LeaveTypeFilterDropdown } from "@/components/leaves/LeaveTypeFilterDropdown";
import { PmsUserFilterDropdown } from "@/components/pms/PmsUserFilterDropdown";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import type { LeaveTypeDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type TeamUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type Props = {
  filterTeamUser: string;
  onFilterTeamUserChange: (value: string) => void;
  teamUsers: TeamUser[];
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  filterLeaveType: string;
  onFilterLeaveTypeChange: (value: string) => void;
  leaveTypes: LeaveTypeDto[];
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function LeaveRequestsFilterBar({
  filterTeamUser,
  onFilterTeamUserChange,
  teamUsers,
  dateRange,
  onDateRangeChange,
  filterLeaveType,
  onFilterLeaveTypeChange,
  leaveTypes,
  filterStatus,
  onFilterStatusChange,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const pmsDateRange: PmsDateRange = useMemo(
    () => ({
      startDate: dateRange.from ?? null,
      endDate: dateRange.to ?? null,
    }),
    [dateRange.from, dateRange.to],
  );
  const hasDateFilter = Boolean(dateRange.from || dateRange.to);

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto scrollbar-thinner">
      <PmsUserFilterDropdown
        value={filterTeamUser}
        onChange={onFilterTeamUserChange}
        users={teamUsers}
        allSubtitle="Show every team member"
        searchAllHints={["all users", "all team", "team member", "all"]}
      />

      <PmsTaskDatePicker
        value={pmsDateRange}
        onChange={(next) => {
          onDateRangeChange({
            from: next.startDate ?? undefined,
            to: next.endDate ?? undefined,
          });
        }}
        rangeSelect
        hideRangeFields
        clearAtBottom
        clearLabel="All dates"
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        modal
      >
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50",
            hasDateFilter && "border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Calendar className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[180px] truncate">
            {hasDateFilter ? formatDueDateRangeLabel(pmsDateRange) : "Date range"}
          </span>
          {hasDateFilter ? <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" /> : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PmsTaskDatePicker>

      <LeaveTypeFilterDropdown
        value={filterLeaveType}
        onChange={onFilterLeaveTypeChange}
        leaveTypes={leaveTypes}
        align="end"
      />

      <LeaveStatusFilterDropdown
        value={filterStatus}
        onChange={onFilterStatusChange}
        align="end"
      />

      {hasActiveFilters ? <AttendanceClearFiltersButton onClick={onClearFilters} /> : null}
    </div>
  );
}
