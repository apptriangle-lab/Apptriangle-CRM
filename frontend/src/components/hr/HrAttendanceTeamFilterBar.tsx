import { useMemo, useState, type ReactNode } from "react";
import { Briefcase, Calendar, Check, ChevronDown, Clock, Download, Search, Users } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Input } from "@/components/ui/input";
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
import type { ShiftDto, UserDto } from "@/lib/api";
import { ATTENDANCE_SHIFT_UNASSIGNED } from "@/components/hr/hrAttendanceUtils";
import { AttendanceClearFiltersButton } from "@/components/attendance/AttendanceClearFiltersButton";
import { AttendanceToolbarOutlineButton } from "@/components/attendance/AttendanceToolbarOutlineButton";
import { cn } from "@/lib/utils";

export type HrAttendancePeriod =
  | "today"
  | "yesterday"
  | "week"
  | "last_week"
  | "month"
  | "last_month"
  | "year"
  | "last_year";

const PERIOD_OPTIONS: { value: HrAttendancePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
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
  search: string;
  onSearchChange: (value: string) => void;
  period: HrAttendancePeriod;
  onPeriodChange: (value: HrAttendancePeriod) => void;
  periodDisabled?: boolean;
  shiftId: string;
  onShiftChange: (value: string) => void;
  shifts: ShiftDto[];
  employeeId: string;
  onEmployeeChange: (value: string) => void;
  employees: UserDto[];
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function HrAttendanceTeamFilterBar({
  leadingSlot,
  search,
  onSearchChange,
  period,
  onPeriodChange,
  periodDisabled = false,
  shiftId,
  onShiftChange,
  shifts,
  employeeId,
  onEmployeeChange,
  employees,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  hasActiveFilters,
  onExport,
  exportDisabled,
}: Props) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? "Today";
  const shiftLabel = useMemo(() => {
    if (shiftId === "all") return "All shifts";
    if (shiftId === ATTENDANCE_SHIFT_UNASSIGNED) return "No shift assigned";
    return shifts.find((s) => s.id === shiftId)?.name ?? "Shift";
  }, [shiftId, shifts]);

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
      <div className="relative w-52 min-w-[180px] max-w-[220px] shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search employees…"
          className="h-9 border-slate-200 bg-white pl-9 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-indigo-200"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <DropdownMenu open={periodOpen} onOpenChange={setPeriodOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={periodDisabled}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
              period !== "today" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
            )}
          >
            <Clock className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="max-w-[160px] truncate">{periodLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "max-h-[min(320px,50vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
            PMS_ASSIGNEE_MENU_OVERRIDES,
          )}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <FilterMenuItem
              key={opt.value}
              name={opt.label}
              icon={<Clock className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
              selected={period === opt.value}
              onSelect={() => {
                onPeriodChange(opt.value);
                setPeriodOpen(false);
              }}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={shiftOpen} onOpenChange={setShiftOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
              shiftId !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
            )}
          >
            <Briefcase className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="max-w-[160px] truncate">{shiftLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "max-h-[min(320px,50vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
            PMS_ASSIGNEE_MENU_OVERRIDES,
          )}
        >
          <FilterMenuItem
            name="All shifts"
            subtitle="Show every shift"
            icon={<Briefcase className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
            selected={shiftId === "all"}
            onSelect={() => {
              onShiftChange("all");
              setShiftOpen(false);
            }}
          />
          <FilterMenuItem
            name="No shift assigned"
            icon={<Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            selected={shiftId === ATTENDANCE_SHIFT_UNASSIGNED}
            onSelect={() => {
              onShiftChange(ATTENDANCE_SHIFT_UNASSIGNED);
              setShiftOpen(false);
            }}
          />
          {shifts.map((s) => (
            <FilterMenuItem
              key={s.id}
              name={s.name}
              icon={<Briefcase className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
              selected={shiftId === s.id}
              onSelect={() => {
                onShiftChange(s.id);
                setShiftOpen(false);
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
          align="start"
          className={cn("w-72 overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg", PMS_ASSIGNEE_MENU_OVERRIDES)}
        >
          <div className="border-b border-slate-100 bg-white p-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search employees…"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
            {showAllEmployees ? (
              <PmsAssigneeFilterMenuItem
                name="All employees"
                subtitle="Show everyone on the team"
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
            setPeriodOpen(false);
            setShiftOpen(false);
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

      <AttendanceToolbarOutlineButton onClick={onExport} disabled={exportDisabled}>
        <Download className="h-4 w-4" />
        Export
      </AttendanceToolbarOutlineButton>
      </div>
    </div>
  );
}
