import type { PmsProjectDto } from "@/lib/pmsApi";

/** Starred projects first, then most recently updated within each group. */
export function sortPmsProjectsByStar(projects: PmsProjectDto[]): PmsProjectDto[] {
  return [...projects].sort((a, b) => {
    const aStar = a.isStarred ? 1 : 0;
    const bStar = b.isStarred ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}
