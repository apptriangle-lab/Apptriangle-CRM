import { describe, expect, it } from "vitest";
import { isHubTaskOwnedByUser } from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import type { PmsTaskDto } from "@/lib/pmsApi";

function task(overrides: Partial<PmsTaskDto>): PmsTaskDto {
  return {
    id: "t1",
    projectId: "p1",
    title: "Task",
    status: "to_do",
    priority: "medium",
    createdBy: "other",
    ...overrides,
  } as PmsTaskDto;
}

describe("isHubTaskOwnedByUser", () => {
  const userId = "user-1";

  it("includes created, assigned-to, and assigned-by tasks", () => {
    expect(isHubTaskOwnedByUser(task({ createdBy: userId }), userId)).toBe(true);
    expect(
      isHubTaskOwnedByUser(
        task({ assignees: [{ userId, userName: "Me" }] }),
        userId,
      ),
    ).toBe(true);
    expect(isHubTaskOwnedByUser(task({ assignedBy: userId }), userId)).toBe(true);
  });

  it("excludes unrelated tasks", () => {
    expect(isHubTaskOwnedByUser(task({ createdBy: "other" }), userId)).toBe(false);
  });
});
