import { describe, expect, it } from "vitest";
import {
  getPmsTaskDateSpan,
  isMultiDayTask,
  normalizeTaskDateRange,
  taskOverlapsDateRange,
  validateTaskDateRange,
} from "@/lib/pmsTaskDates";

describe("pmsTaskDates", () => {
  it("normalizes single end date to same start", () => {
    const end = new Date(2026, 5, 20);
    const result = normalizeTaskDateRange({ startDate: null, endDate: end });
    expect(result.startDate).toEqual(end);
    expect(result.endDate).toEqual(end);
  });

  it("rejects end before start", () => {
    const err = validateTaskDateRange({
      startDate: new Date(2026, 5, 20),
      endDate: new Date(2026, 5, 18),
    });
    expect(err).toMatch(/on or after/i);
  });

  it("detects multi-day tasks", () => {
    expect(
      isMultiDayTask({
        startDate: "2026-06-16",
        endDate: "2026-06-18",
      }),
    ).toBe(true);
    expect(
      isMultiDayTask({
        startDate: "2026-06-18",
        endDate: "2026-06-18",
      }),
    ).toBe(false);
  });

  it("spans task across filter range overlap", () => {
    const task = { startDate: "2026-06-10", endDate: "2026-06-20", status: "to_do" };
    expect(
      taskOverlapsDateRange(task, {
        startDate: new Date(2026, 5, 15),
        endDate: new Date(2026, 5, 25),
      }),
    ).toBe(true);
    expect(
      taskOverlapsDateRange(task, {
        startDate: new Date(2026, 5, 21),
        endDate: new Date(2026, 5, 30),
      }),
    ).toBe(false);
  });

  it("returns coherent span from API dates", () => {
    const span = getPmsTaskDateSpan({ startDate: "2026-06-18", endDate: "2026-06-16" });
    expect(span.start?.getDate()).toBe(16);
    expect(span.end?.getDate()).toBe(18);
  });
});
