import { format, isValid, parseISO, startOfDay, startOfMonth } from "date-fns";
import type { PmsDateRange } from "@/components/pms/PmsTaskDatePicker";
import { PMS_MY_TASKS_FILTER_SCOPE } from "@/lib/pmsMyTasksScope";

export type PmsViewId = "tasks" | "kanban" | "calendar";

export type AssigneeFilter = "all" | "me" | string;

type StoredDateRange = { startDate: string | null; endDate: string | null };

export type PmsTasksViewFilters = {
  search: string;
  assigneeFilter: AssigneeFilter;
  dueDateRange: PmsDateRange;
  projectFilter: string;
  companyFilter: string;
};

export type PmsKanbanViewFilters = {
  assigneeFilter: AssigneeFilter;
  statusFilter: string;
  dueDateRange: PmsDateRange;
};

export type PmsCalendarViewFilters = {
  assigneeFilter: AssigneeFilter;
  month: Date;
  selectedDay: Date;
};

const STORAGE_PREFIX = "pms_view_filters_";

const EMPTY_DATE_RANGE: PmsDateRange = { startDate: null, endDate: null };

export const PMS_TASKS_FILTER_DEFAULTS: PmsTasksViewFilters = {
  search: "",
  assigneeFilter: "all",
  dueDateRange: EMPTY_DATE_RANGE,
  projectFilter: "all",
  companyFilter: "all",
};

export const PMS_KANBAN_FILTER_DEFAULTS: PmsKanbanViewFilters = {
  assigneeFilter: "all",
  statusFilter: "all",
  dueDateRange: EMPTY_DATE_RANGE,
};

export function pmsCalendarFilterDefaults(now = new Date()): PmsCalendarViewFilters {
  const today = startOfDay(now);
  return {
    assigneeFilter: "all",
    month: startOfMonth(today),
    selectedDay: today,
  };
}

function storageKey(projectId: string, view: PmsViewId): string {
  return `${STORAGE_PREFIX}${projectId}_${view}`;
}

function serializeDateRange(range: PmsDateRange): StoredDateRange {
  return {
    startDate: range.startDate ? format(range.startDate, "yyyy-MM-dd") : null,
    endDate: range.endDate ? format(range.endDate, "yyyy-MM-dd") : null,
  };
}

function deserializeDateRange(stored: StoredDateRange | undefined): PmsDateRange {
  if (!stored) return { ...EMPTY_DATE_RANGE };
  const parse = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = parseISO(iso);
      return isValid(d) ? startOfDay(d) : null;
    } catch {
      return null;
    }
  };
  return { startDate: parse(stored.startDate), endDate: parse(stored.endDate) };
}

function parseStoredDate(iso: string | null | undefined, fallback: Date): Date {
  if (!iso) return fallback;
  try {
    const d = parseISO(iso);
    return isValid(d) ? startOfDay(d) : fallback;
  } catch {
    return fallback;
  }
}

function readRaw(projectId: string, view: PmsViewId): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(storageKey(projectId, view));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeRaw(projectId: string, view: PmsViewId, value: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(storageKey(projectId, view), JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readTasksFilters(projectId: string): PmsTasksViewFilters {
  const raw = readRaw(projectId, "tasks");
  const isHubScope = projectId === PMS_MY_TASKS_FILTER_SCOPE;
  const defaultAssignee: AssigneeFilter = isHubScope ? "me" : "all";
  if (!raw) {
    return {
      ...PMS_TASKS_FILTER_DEFAULTS,
      assigneeFilter: defaultAssignee,
      dueDateRange: { ...EMPTY_DATE_RANGE },
    };
  }
  return {
    search: typeof raw.search === "string" ? raw.search : "",
    assigneeFilter:
      typeof raw.assigneeFilter === "string" ? (raw.assigneeFilter as AssigneeFilter) : defaultAssignee,
    dueDateRange: deserializeDateRange(raw.dueDateRange as StoredDateRange | undefined),
    projectFilter: typeof raw.projectFilter === "string" ? raw.projectFilter : "all",
    companyFilter: typeof raw.companyFilter === "string" ? raw.companyFilter : "all",
  };
}

export function writeTasksFilters(projectId: string, filters: PmsTasksViewFilters): void {
  writeRaw(projectId, "tasks", {
    search: filters.search,
    assigneeFilter: filters.assigneeFilter,
    dueDateRange: serializeDateRange(filters.dueDateRange),
    projectFilter: filters.projectFilter,
    companyFilter: filters.companyFilter,
  });
}

export function readKanbanFilters(projectId: string): PmsKanbanViewFilters {
  const raw = readRaw(projectId, "kanban");
  if (!raw) return { ...PMS_KANBAN_FILTER_DEFAULTS, dueDateRange: { ...EMPTY_DATE_RANGE } };
  return {
    assigneeFilter:
      typeof raw.assigneeFilter === "string" ? (raw.assigneeFilter as AssigneeFilter) : "all",
    statusFilter: typeof raw.statusFilter === "string" ? raw.statusFilter : "all",
    dueDateRange: deserializeDateRange(raw.dueDateRange as StoredDateRange | undefined),
  };
}

export function writeKanbanFilters(projectId: string, filters: PmsKanbanViewFilters): void {
  writeRaw(projectId, "kanban", {
    assigneeFilter: filters.assigneeFilter,
    statusFilter: filters.statusFilter,
    dueDateRange: serializeDateRange(filters.dueDateRange),
  });
}

export function readCalendarFilters(projectId: string): PmsCalendarViewFilters {
  const defaults = pmsCalendarFilterDefaults();
  const raw = readRaw(projectId, "calendar");
  if (!raw) return defaults;
  const selectedDay = parseStoredDate(
    typeof raw.selectedDay === "string" ? raw.selectedDay : null,
    defaults.selectedDay,
  );
  const month = startOfMonth(
    parseStoredDate(typeof raw.month === "string" ? raw.month : null, defaults.month),
  );
  return {
    assigneeFilter:
      typeof raw.assigneeFilter === "string" ? (raw.assigneeFilter as AssigneeFilter) : "all",
    month,
    selectedDay,
  };
}

export function writeCalendarFilters(projectId: string, filters: PmsCalendarViewFilters): void {
  writeRaw(projectId, "calendar", {
    assigneeFilter: filters.assigneeFilter,
    month: format(filters.month, "yyyy-MM-dd"),
    selectedDay: format(filters.selectedDay, "yyyy-MM-dd"),
  });
}

/** Reset assignee if the stored user is no longer a project member. */
export function sanitizeAssigneeFilter(
  assigneeFilter: AssigneeFilter,
  memberUserIds: Set<string>,
): AssigneeFilter {
  if (assigneeFilter === "all" || assigneeFilter === "me") return assigneeFilter;
  return memberUserIds.has(assigneeFilter) ? assigneeFilter : "all";
}
