import { describe, expect, it } from "vitest";
import { canViewAllHubTasks } from "@/lib/pmsHubTasksAccess";

describe("canViewAllHubTasks", () => {
  it("allows PMS and system admins", () => {
    expect(canViewAllHubTasks({ isPmsAdmin: true, isSystemAdmin: false })).toBe(true);
    expect(canViewAllHubTasks({ isPmsAdmin: false, isSystemAdmin: true })).toBe(true);
  });

  it("denies standard PMS user access even when they can create tasks", () => {
    expect(canViewAllHubTasks({ isPmsAdmin: false, isSystemAdmin: false })).toBe(false);
  });
});
