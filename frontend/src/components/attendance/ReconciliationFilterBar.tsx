import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Check, ChevronDown, Layers, Users } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuItem,
  PmsMemberAvatar,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import type { AttendanceReconciliationStatus, UserDto } from "@/lib/api";
import { AttendanceClearFiltersButton } from "@/components/attendance/AttendanceClearFiltersButton";
import { cn } from "@/lib/utils";

export type ReconciliationStatusFilter = AttendanceReconciliationStatus | "all";

const STATUS_OPTIONS: {
  value: ReconciliationStatusFilter;
  label: string;
  subtitle?: string;
  dotClass: string;
}[] = [
  { value: "pending", label: "Pending", subtitle: "Awaiting review", dotClass: "bg-amber-500" },
  { value: "approved", label: "Approved", subtitle: "Accepted requests", dotClass: "bg-emerald-500" },
  { value: "rejected", label: "Rejected", subtitle: "Declined requests", dotClass: "bg-rose-500" },
  { value: "all", label: "All statuses", subtitle: "Show every request", dotClass: "bg-slate-300" },
];

function FilterMenuItem({
  name,
  subtitle,
  icon,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-sky-50 data-[highlighted]:to-indigo-50 data-[highlighted]:text-slate-900",
        "focus:bg-gradient-to-r focus:from-sky-50 focus:to-indigo-50 focus:text-slate-900",
        selected && "bg-indigo-50/80 text-indigo-950",
      )}
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  leadingSlot?: ReactNode;
  status: ReconciliationStatusFilter;
  onStatusChange: (value: ReconciliationStatusFilter) => void;
  employeeId: string;
  onEmployeeChange: (value: string) => void;
  employees: UserDto[];
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function ReconciliationFilterBar({
  leadingSlot,
  status,
  onStatusChange,
  employeeId,
  onEmployeeChange,
  employees,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const statusLabel =
    STATUS_OPTIONS.find((s) => s.value === status)?.label ?? "Pending";
  const statusDot =
    STATUS_OPTIONS.find((s) => s.value === status)?.dotClass ?? "bg-amber-500";

  const selectedEmployee = useMemo(
    () => (employeeId === "all" ? null : employees.find((u) => u.id === employeeId) ?? null),
    [employeeId, employees],
  );
  const employeeLabel = selectedEmployee?.name ?? "All employees";

  const pmsDateRange: PmsDateRange = useMemo(
    () => ({
      startDate: dateRange.from ?? null,
      endDate: dateRange.to ?? null,
    }),
    [dateRange.from, dateRange.to],
  );
  const hasDateFilter = Boolean(dateRange.from || dateRange.to);

  const searchQuery = employeeSearch.trim().toLowerCase();
  const showAllEmployees = useMemo(() => {
    if (!searchQuery) return true;
    return (
      "all employees".includes(searchQuery) ||
      "every employee".includes(searchQuery) ||
      searchQuery === "all"
    );
  }, [searchQuery]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery) ||
        (u.email ?? "").toLowerCase().includes(searchQuery),
    );
  }, [employees, searchQuery]);

  return (
    <div className="flex h-[52px] shrink-0 flex-nowrap items-center justify-between gap-3">
      {leadingSlot ? <div className="shrink-0">{leadingSlot}</div> : null}
      <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto scrollbar-thinner">
        <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
                status !== "pending" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
              )}
            >
              <Layers className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot)} />
              <span className="max-w-[140px] truncate">{statusLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "max-h-[min(320px,50vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
              PMS_ASSIGNEE_MENU_OVERRIDES,
            )}
          >
            {STATUS_OPTIONS.map((opt) => (
              <FilterMenuItem
                key={opt.value}
                name={opt.label}
                subtitle={opt.subtitle}
                icon={<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", opt.dotClass)} />}
                selected={status === opt.value}
                onSelect={() => {
                  onStatusChange(opt.value);
                  setStatusOpen(false);
                }}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={employeeOpen}
          onOpenChange={(open) => {
            setEmployeeOpen(open);
            if (!open) setEmployeeSearch("");
          }}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!employees.length}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                employeeId !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
              )}
            >
              <Users className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="max-w-[160px] truncate">{employeeLabel}</span>
              {selectedEmployee ? (
                <PmsMemberAvatar name={selectedEmployee.name} userId={selectedEmployee.id} size="xs" />
              ) : null}
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn("w-72 overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg", PMS_ASSIGNEE_MENU_OVERRIDES)}
          >
            <div className="border-b border-slate-100 bg-white p-2" onPointerDown={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search employees…"
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                autoFocus
              />
            </div>
            <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
              {showAllEmployees ? (
                <PmsAssigneeFilterMenuItem
                  name="All employees"
                  subtitle="Show everyone"
                  selected={employeeId === "all"}
                  onSelect={() => {
                    onEmployeeChange("all");
                    setEmployeeOpen(false);
                  }}
                  icon={<PmsAssigneeFilterAllIcon />}
                />
              ) : null}
              {filteredEmployees.map((u) => (
                <PmsAssigneeFilterMenuItem
                  key={u.id}
                  name={u.name}
                  email={u.email || undefined}
                  userId={u.id}
                  selected={employeeId === u.id}
                  onSelect={() => {
                    onEmployeeChange(u.id);
                    setEmployeeOpen(false);
                  }}
                />
              ))}
              {!showAllEmployees && filteredEmployees.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">No employees found.</p>
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
          onOpenChange={(open) => {
            setDatePickerOpen(open);
            if (open) {
              setStatusOpen(false);
              setEmployeeOpen(false);
            }
          }}
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

        {hasActiveFilters ? (
          <AttendanceClearFiltersButton onClick={onClearFilters} />
        ) : null}
      </div>
    </div>
  );
}
