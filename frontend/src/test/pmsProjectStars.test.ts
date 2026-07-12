import { describe, expect, it } from "vitest";
import { sortPmsProjectsByStar } from "@/lib/pmsProjectStars";
import type { PmsProjectDto } from "@/lib/pmsApi";

function project(id: string, starred: boolean, updatedAt: string): PmsProjectDto {
  return {
    id,
    projectCode: id,
    title: id,
    description: "",
    companyId: null,
    status: "in_progress",
    priority: "medium",
    progress: 0,
    createdBy: "user-1",
    startDate: null,
    endDate: null,
    isStarred: starred,
    updatedAt,
  };
}

describe("sortPmsProjectsByStar", () => {
  it("places starred projects before unstarred ones", () => {
    const sorted = sortPmsProjectsByStar([
      project("b", false, "2026-06-03T00:00:00Z"),
      project("a", true, "2026-06-01T00:00:00Z"),
      project("c", false, "2026-06-04T00:00:00Z"),
    ]);

    expect(sorted.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts starred and unstarred groups by updatedAt descending", () => {
    const sorted = sortPmsProjectsByStar([
      project("old-star", true, "2026-06-01T00:00:00Z"),
      project("new-star", true, "2026-06-05T00:00:00Z"),
      project("old-plain", false, "2026-06-02T00:00:00Z"),
      project("new-plain", false, "2026-06-06T00:00:00Z"),
    ]);

    expect(sorted.map((p) => p.id)).toEqual(["new-star", "old-star", "new-plain", "old-plain"]);
  });
});
