import { describe, expect, it } from "vitest";
import { calculateProjectProgress } from "@/lib/pmsProjectProgress";

function tasksFromCounts(completed: number, cancelled: number, other = 0) {
  return [
    ...Array.from({ length: completed }, () => ({ status: "completed" })),
    ...Array.from({ length: cancelled }, () => ({ status: "cancelled" })),
    ...Array.from({ length: other }, () => ({ status: "in_progress" })),
  ];
}

describe("calculateProjectProgress", () => {
  it("returns 80% when 8 completed, 1 cancelled, 2 other out of 11", () => {
    const stats = calculateProjectProgress(tasksFromCounts(8, 1, 2));
    expect(stats.progressPercentage).toBe(80);
    expect(stats.nonCancelledTaskCount).toBe(10);
  });

  it("returns 100% when all non-cancelled tasks are completed", () => {
    const stats = calculateProjectProgress(tasksFromCounts(5, 0, 0));
    expect(stats.progressPercentage).toBe(100);
  });

  it("returns 0% when no tasks are completed", () => {
    const stats = calculateProjectProgress(tasksFromCounts(0, 0, 5));
    expect(stats.progressPercentage).toBe(0);
  });

  it("returns 0% when all tasks are cancelled", () => {
    const stats = calculateProjectProgress(tasksFromCounts(0, 5, 0));
    expect(stats.progressPercentage).toBe(0);
    expect(stats.nonCancelledTaskCount).toBe(0);
  });

  it("returns 0% for zero tasks", () => {
    const stats = calculateProjectProgress([]);
    expect(stats.progressPercentage).toBe(0);
    expect(stats.totalTaskCount).toBe(0);
  });

  it("treats canceled spelling as cancelled", () => {
    const stats = calculateProjectProgress([
      { status: "completed" },
      { status: "completed" },
      { status: "canceled" },
    ]);
    expect(stats.progressPercentage).toBe(100);
    expect(stats.cancelledTaskCount).toBe(1);
    expect(stats.nonCancelledTaskCount).toBe(2);
  });
});
