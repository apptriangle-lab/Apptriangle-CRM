import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { lunchApi, type LunchEmployeeBalanceDto } from "@/lib/lunchApi";
import { LUNCH_EMPLOYEES_ALL, LunchEmployeesToolbar } from "@/components/lunch/LunchEmployeesToolbar";
import { employeeMatchesSearch } from "@/components/lunch/LunchEmployeesUserFilterDropdown";
import { LunchEmployeesBalancesSection } from "@/components/lunch/LunchEmployeesBalancesSection";
import {
  currentMonthDateRange,
  lunchDateRangeToIso,
  type LunchDateRange,
} from "@/components/lunch/lunchDateRangeUtils";

export function LunchEmployeesAdminPanel() {
  const [employees, setEmployees] = useState<LunchEmployeeBalanceDto[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [userFilter, setUserFilter] = useState(LUNCH_EMPLOYEES_ALL);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<LunchDateRange>(currentMonthDateRange);
  const [adjustTarget, setAdjustTarget] = useState<LunchEmployeeBalanceDto | null>(null);

  const isoRange = useMemo(() => lunchDateRangeToIso(dateRange), [dateRange]);
  const periodActive = Boolean(isoRange.from && isoRange.to);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const r = await lunchApi.listEmployeeBalances(
        periodActive ? { from: isoRange.from, to: isoRange.to } : undefined,
      );
      setEmployees(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  }, [isoRange.from, isoRange.to, periodActive]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const byUser =
      userFilter === LUNCH_EMPLOYEES_ALL
        ? employees
        : employees.filter((e) => e.userId === userFilter);
    const query = search.trim().toLowerCase();
    if (!query) return byUser;
    return byUser.filter((e) => employeeMatchesSearch(e, query));
  }, [employees, userFilter, search]);

  const selectedEmployee = useMemo(
    () => (userFilter === LUNCH_EMPLOYEES_ALL ? null : employees.find((e) => e.userId === userFilter) ?? null),
    [employees, userFilter],
  );

  const handleAdjustFromToolbar = () => {
    if (selectedEmployee) setAdjustTarget(selectedEmployee);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
      <LunchEmployeesToolbar
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        employees={employees}
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onAdjustBalance={handleAdjustFromToolbar}
        adjustDisabled={!selectedEmployee}
      />

      <LunchEmployeesBalancesSection
        className="min-h-0 flex-1"
        items={filteredEmployees}
        loading={loadingEmployees}
        onRefresh={loadEmployees}
        adjustTarget={adjustTarget}
        onAdjustTargetChange={setAdjustTarget}
        dateRange={dateRange}
        periodActive={periodActive}
      />
    </div>
  );
}
