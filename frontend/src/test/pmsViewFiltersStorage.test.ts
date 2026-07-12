import { describe, expect, it, beforeEach } from "vitest";
import { format, parseISO, startOfMonth } from "date-fns";
import {
  PMS_TASKS_FILTER_DEFAULTS,
  readCalendarFilters,
  readKanbanFilters,
  readTasksFilters,
  writeCalendarFilters,
  writeKanbanFilters,
  writeTasksFilters,
} from "@/lib/pmsViewFiltersStorage";

const PROJECT_ID = "proj-test-1";

describe("pmsViewFiltersStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips task filters per project", () => {
    writeTasksFilters(PROJECT_ID, {
      search: "bug",
      assigneeFilter: "user-42",
      dueDateRange: { startDate: parseISO("2026-06-01"), endDate: parseISO("2026-06-30") },
    });

    const restored = readTasksFilters(PROJECT_ID);
    expect(restored.search).toBe("bug");
    expect(restored.assigneeFilter).toBe("user-42");
    expect(format(restored.dueDateRange.startDate!, "yyyy-MM-dd")).toBe("2026-06-01");
    expect(format(restored.dueDateRange.endDate!, "yyyy-MM-dd")).toBe("2026-06-30");
  });

  it("returns defaults when nothing stored", () => {
    expect(readTasksFilters(PROJECT_ID).search).toBe(PMS_TASKS_FILTER_DEFAULTS.search);
    expect(readTasksFilters(PROJECT_ID).assigneeFilter).toBe("all");
    expect(readKanbanFilters(PROJECT_ID).statusFilter).toBe("all");
    expect(readKanbanFilters(PROJECT_ID).assigneeFilter).toBe("all");
  });

  it("isolates filters by project id", () => {
    writeKanbanFilters(PROJECT_ID, {
      assigneeFilter: "all",
      statusFilter: "in_progress",
      dueDateRange: { startDate: null, endDate: null },
    });
    writeKanbanFilters("other-project", {
      assigneeFilter: "all",
      statusFilter: "completed",
      dueDateRange: { startDate: null, endDate: null },
    });

    expect(readKanbanFilters(PROJECT_ID).statusFilter).toBe("in_progress");
    expect(readKanbanFilters("other-project").statusFilter).toBe("completed");
  });

  it("persists calendar month and selected day", () => {
    const month = startOfMonth(parseISO("2026-03-15"));
    const selectedDay = parseISO("2026-03-10");
    writeCalendarFilters(PROJECT_ID, {
      assigneeFilter: "me",
      month,
      selectedDay,
    });

    const restored = readCalendarFilters(PROJECT_ID);
    expect(restored.assigneeFilter).toBe("me");
    expect(format(restored.month, "yyyy-MM-dd")).toBe("2026-03-01");
    expect(format(restored.selectedDay, "yyyy-MM-dd")).toBe("2026-03-10");
  });
});
