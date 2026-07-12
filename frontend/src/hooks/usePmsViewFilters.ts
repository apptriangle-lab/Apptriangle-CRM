import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PmsDateRange } from "@/components/pms/PmsTaskDatePicker";
import { PmsProjectContext } from "@/contexts/PmsProjectContext";
import { usePmsTaskViewContext } from "@/contexts/PmsTaskViewContext";
import {
  type AssigneeFilter,
  type PmsCalendarViewFilters,
  type PmsKanbanViewFilters,
  type PmsTasksViewFilters,
  pmsCalendarFilterDefaults,
  PMS_KANBAN_FILTER_DEFAULTS,
  PMS_TASKS_FILTER_DEFAULTS,
  readCalendarFilters,
  readKanbanFilters,
  readTasksFilters,
  sanitizeAssigneeFilter,
  writeCalendarFilters,
  writeKanbanFilters,
  writeTasksFilters,
} from "@/lib/pmsViewFiltersStorage";

function useFilterScopeId(): string {
  const { filterScopeId: taskViewScopeId } = usePmsTaskViewContext();
  const projectCtx = useContext(PmsProjectContext);
  return taskViewScopeId || projectCtx?.projectId || "";
}

function usePersistedFilters<T>(
  read: (projectId: string) => T,
  write: (projectId: string, value: T) => void,
  fallback: T,
): [T, (patch: Partial<T> | ((prev: T) => T)) => void] {
  const filterScopeId = useFilterScopeId();
  const writeRef = useRef(write);
  writeRef.current = write;

  const [filters, setFiltersState] = useState<T>(() =>
    filterScopeId ? read(filterScopeId) : fallback,
  );

  useEffect(() => {
    if (!filterScopeId) return;
    setFiltersState(read(filterScopeId));
  }, [filterScopeId, read]);

  const setFilters = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setFiltersState((prev) => {
        const next =
          typeof patch === "function" ? (patch as (p: T) => T)(prev) : { ...prev, ...patch };
        if (filterScopeId) writeRef.current(filterScopeId, next);
        return next;
      });
    },
    [filterScopeId],
  );

  return [filters, setFilters];
}

export function usePmsTasksFilters() {
  const [filters, setFilters] = usePersistedFilters(
    readTasksFilters,
    writeTasksFilters,
    PMS_TASKS_FILTER_DEFAULTS,
  );

  const setSearch = useCallback((search: string) => setFilters({ search }), [setFilters]);
  const setAssigneeFilter = useCallback(
    (assigneeFilter: AssigneeFilter) => setFilters({ assigneeFilter }),
    [setFilters],
  );
  const setDueDateRangeFilter = useCallback(
    (dueDateRange: PmsDateRange) => setFilters({ dueDateRange }),
    [setFilters],
  );
  const setProjectFilter = useCallback(
    (projectFilter: string) => setFilters({ projectFilter }),
    [setFilters],
  );
  const setCompanyFilter = useCallback(
    (companyFilter: string) => setFilters({ companyFilter }),
    [setFilters],
  );

  return {
    search: filters.search,
    setSearch,
    assigneeFilter: filters.assigneeFilter,
    setAssigneeFilter,
    dueDateRangeFilter: filters.dueDateRange,
    setDueDateRangeFilter,
    projectFilter: filters.projectFilter,
    setProjectFilter,
    companyFilter: filters.companyFilter,
    setCompanyFilter,
  };
}

export function usePmsKanbanFilters() {
  const [filters, setFilters] = usePersistedFilters(
    readKanbanFilters,
    writeKanbanFilters,
    PMS_KANBAN_FILTER_DEFAULTS,
  );

  const setAssigneeFilter = useCallback(
    (assigneeFilter: AssigneeFilter) => setFilters({ assigneeFilter }),
    [setFilters],
  );
  const setStatusFilter = useCallback(
    (statusFilter: string) => setFilters({ statusFilter }),
    [setFilters],
  );
  const setDueDateRangeFilter = useCallback(
    (dueDateRange: PmsDateRange) => setFilters({ dueDateRange }),
    [setFilters],
  );

  return {
    assigneeFilter: filters.assigneeFilter,
    setAssigneeFilter,
    statusFilter: filters.statusFilter,
    setStatusFilter,
    dueDateRangeFilter: filters.dueDateRange,
    setDueDateRangeFilter,
  };
}

export function usePmsCalendarFilters() {
  const defaults = pmsCalendarFilterDefaults();
  const [filters, setFilters] = usePersistedFilters(
    readCalendarFilters,
    writeCalendarFilters,
    defaults,
  );

  const setAssigneeFilter = useCallback(
    (assigneeFilter: AssigneeFilter) => setFilters({ assigneeFilter }),
    [setFilters],
  );
  const setMonth = useCallback((month: Date) => setFilters({ month }), [setFilters]);
  const setSelectedDay = useCallback(
    (selectedDay: Date) => setFilters({ selectedDay }),
    [setFilters],
  );

  return {
    assigneeFilter: filters.assigneeFilter,
    setAssigneeFilter,
    month: filters.month,
    setMonth,
    selectedDay: filters.selectedDay,
    setSelectedDay,
  };
}

/** Clear invalid assignee id when project members change; persists correction. */
export function useSanitizeAssigneeFilter(
  assigneeFilter: AssigneeFilter,
  setAssigneeFilter: (value: AssigneeFilter) => void,
  memberUserIds: string[],
): void {
  useEffect(() => {
    const next = sanitizeAssigneeFilter(assigneeFilter, new Set(memberUserIds));
    if (next !== assigneeFilter) setAssigneeFilter(next);
  }, [assigneeFilter, memberUserIds, setAssigneeFilter]);
}

export type { AssigneeFilter, PmsCalendarViewFilters, PmsKanbanViewFilters, PmsTasksViewFilters };
