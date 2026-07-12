import { Calendar, ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrmTasksListTabs } from "@/components/tasks/CrmTasksListTabs";
import { CrmTasksUserFilterDropdown } from "@/components/tasks/CrmTasksUserFilterDropdown";
import { CrmTasksStatusFilterDropdown } from "@/components/tasks/CrmTasksStatusFilterDropdown";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import type { CrmTasksTab } from "@/utils/crmTasksListFilters";
import type { CrmTasksFilterUser } from "@/components/tasks/CrmTasksUserFilterDropdown";
import { cn } from "@/lib/utils";

type Props = {
  tab: CrmTasksTab;
  onTabChange: (tab: CrmTasksTab) => void;
  tabCounts?: Partial<Record<CrmTasksTab, number>>;
  search: string;
  onSearchChange: (value: string) => void;
  filterAssignTo: string;
  onFilterAssignToChange: (value: string) => void;
  filterAssignBy: string;
  onFilterAssignByChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  dueDateRange: PmsDateRange;
  onDueDateRangeChange: (range: PmsDateRange) => void;
  dueDatePickerOpen: boolean;
  onDueDatePickerOpenChange: (open: boolean) => void;
  hasDueDateFilter: boolean;
  tasksScopeAdmin: boolean;
  users: CrmTasksFilterUser[];
  statuses: string[];
  onAddTask: () => void;
};

export function CrmTasksListToolbar({
  tab,
  onTabChange,
  tabCounts,
  search,
  onSearchChange,
  filterAssignTo,
  onFilterAssignToChange,
  filterAssignBy,
  onFilterAssignByChange,
  filterStatus,
  onFilterStatusChange,
  dueDateRange,
  onDueDateRangeChange,
  dueDatePickerOpen,
  onDueDatePickerOpenChange,
  hasDueDateFilter,
  tasksScopeAdmin,
  users,
  statuses,
  onAddTask,
}: Props) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <CrmTasksListTabs value={tab} onChange={onTabChange} counts={tabCounts} />

        <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto scrollbar-thinner sm:flex-none">
          <div className="relative w-72 min-w-[200px] max-w-sm shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
                search.trim() && "border-indigo-200 bg-indigo-50/40",
              )}
            />
          </div>

          {tasksScopeAdmin ? (
            <>
              <CrmTasksUserFilterDropdown
                kind="assignTo"
                value={filterAssignTo}
                onChange={onFilterAssignToChange}
                users={users}
              />
              <CrmTasksUserFilterDropdown
                kind="assignBy"
                value={filterAssignBy}
                onChange={onFilterAssignByChange}
                users={users}
              />
            </>
          ) : null}

          <CrmTasksStatusFilterDropdown
            value={filterStatus}
            onChange={onFilterStatusChange}
            statuses={statuses}
          />

          <PmsTaskDatePicker
            value={dueDateRange}
            onChange={onDueDateRangeChange}
            rangeSelect
            hideRangeFields
            clearAtBottom
            clearLabel="All due dates"
            open={dueDatePickerOpen}
            onOpenChange={onDueDatePickerOpenChange}
            modal={false}
          >
            <button
              type="button"
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50",
                hasDueDateFilter && "border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50",
              )}
            >
              <Calendar className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="max-w-[180px] truncate">{formatDueDateRangeLabel(dueDateRange)}</span>
              {hasDueDateFilter ? <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" /> : null}
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </PmsTaskDatePicker>

          <Button
            type="button"
            onClick={onAddTask}
            className="h-9 shrink-0 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>
    </div>
  );
}
