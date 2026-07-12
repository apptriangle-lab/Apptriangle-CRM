import { describe, expect, it } from "vitest";
import { parseISO, startOfDay } from "date-fns";
import {
  getTaskDayVisualStatus,
  summarizeDayTasksForDate,
} from "@/components/pms/resource/calendar/resourceTaskDayStatus";
import type { PmsResourceTaskDto } from "@/lib/pmsApi";

const today = startOfDay(parseISO("2026-06-18"));

function task(overrides: Partial<PmsResourceTaskDto> = {}): PmsResourceTaskDto {
  return {
    id: "t1",
    title: "Task",
    status: "in_progress",
    startDate: "2026-06-13",
    endDate: "2026-06-18",
    ...overrides,
  } as PmsResourceTaskDto;
}

describe("getTaskDayVisualStatus", () => {
  it("shows all span days GREEN when ongoing (today ≤ end_date)", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-13", endDate: "2026-06-20" });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-13"), today)).toBe("ongoing");
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-17"), today)).toBe("ongoing");
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-20"), today)).toBe("ongoing");
  });

  it("shows RED when single-day task is overdue", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-16", endDate: "2026-06-16" });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-16"), today)).toBe("overdue");
  });

  it("shows GREEN for multi-day task ending today", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-16", endDate: "2026-06-18" });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-16"), today)).toBe("ongoing");
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-18"), today)).toBe("ongoing");
  });

  it("shows GREEN for completed tasks on past/today", () => {
    const t = task({
      status: "completed",
      completedAt: "2026-06-16T10:00:00",
      startDate: "2026-06-13",
      endDate: "2026-06-20",
    });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-13"), today)).toBe("complete");
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-18"), today)).toBe("complete");
  });

  it("shows GRAY future-complete for completed tasks on future days", () => {
    const t = task({
      status: "completed",
      completedAt: "2026-06-16T10:00:00",
      startDate: "2026-06-13",
      endDate: "2026-06-25",
    });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-20"), today)).toBe("future-complete");
  });

  it("shows RED for all span days when end_date has passed", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-13", endDate: "2026-06-17" });
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-13"), today)).toBe("overdue");
    expect(getTaskDayVisualStatus(t, parseISO("2026-06-17"), today)).toBe("overdue");
  });
});

describe("summarizeDayTasksForDate", () => {
  it("ongoing multi-day task: past span days are GREEN (not overdue)", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-13", endDate: "2026-06-20" });
    const summary17 = summarizeDayTasksForDate([t], parseISO("2026-06-17"), today);
    expect(summary17.incompleteTasks).toBe(0);
  });

  it("overdue single-day task counts as incomplete on past day", () => {
    const t = task({ status: "in_progress", startDate: "2026-06-16", endDate: "2026-06-16" });
    const summary = summarizeDayTasksForDate([t], parseISO("2026-06-16"), today);
    expect(summary.incompleteTasks).toBe(1);
  });
});
