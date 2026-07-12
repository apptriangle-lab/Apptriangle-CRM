/** URL / session helpers for CRM Tasks list (`/tasks`). */

import { format, isValid, parseISO } from "date-fns";

export type CrmTasksTab = "pending" | "completed" | "all";

export type CrmTasksDateRange = { from?: Date; to?: Date };

export function parseCrmTasksTab(value: string | null): CrmTasksTab {
  if (value === "completed" || value === "all") return value;
  return "pending";
}

export function parseCrmTasksAssignTo(value: string | null): string {
  if (!value || value === "all") return "all";
  return value;
}

export function parseCrmTasksAssignBy(value: string | null): string {
  if (!value || value === "all") return "all";
  return value;
}

export function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  return isValid(d) ? d : undefined;
}

export function readFiltersFromSearchParams(params: URLSearchParams): {
  tab: CrmTasksTab;
  search: string;
  filterAssignTo: string;
  filterAssignBy: string;
  filterStatus: string;
  dateRange: CrmTasksDateRange;
} {
  return {
    tab: parseCrmTasksTab(params.get("tab")),
    search: params.get("q") ?? "",
    filterAssignTo: parseCrmTasksAssignTo(params.get("assignTo")),
    filterAssignBy: parseCrmTasksAssignBy(params.get("assignBy")),
    filterStatus: params.get("status") ?? "all",
    dateRange: {
      from: parseDateParam(params.get("from")),
      to: parseDateParam(params.get("to")),
    },
  };
}

export function writeFiltersToSearchParams(
  prev: URLSearchParams,
  filters: {
    tab: CrmTasksTab;
    search: string;
    filterAssignTo: string;
    filterAssignBy: string;
    filterStatus: string;
    dateRange: CrmTasksDateRange;
  },
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (filters.tab !== "pending") next.set("tab", filters.tab);
  else next.delete("tab");

  const q = filters.search.trim();
  if (q) next.set("q", q);
  else next.delete("q");

  if (filters.filterAssignTo === "all") next.delete("assignTo");
  else next.set("assignTo", filters.filterAssignTo);

  if (filters.filterAssignBy === "all") next.delete("assignBy");
  else next.set("assignBy", filters.filterAssignBy);

  if (filters.filterStatus !== "all") next.set("status", filters.filterStatus);
  else next.delete("status");

  if (filters.dateRange.from) next.set("from", format(filters.dateRange.from, "yyyy-MM-dd"));
  else next.delete("from");

  if (filters.dateRange.to) next.set("to", format(filters.dateRange.to, "yyyy-MM-dd"));
  else next.delete("to");

  return next;
}

export const CRM_TASKS_LIST_SEARCH_KEY = "crm_tasks_list_search";

export function saveTasksListSearch(search: string) {
  try {
    if (search) sessionStorage.setItem(CRM_TASKS_LIST_SEARCH_KEY, search);
    else sessionStorage.removeItem(CRM_TASKS_LIST_SEARCH_KEY);
  } catch {
    /* ignore */
  }
}

export function readTasksListSearch(): string {
  try {
    return sessionStorage.getItem(CRM_TASKS_LIST_SEARCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function tasksListPathFromSearch(search: string): string {
  return search ? `/tasks?${search}` : "/tasks";
}
