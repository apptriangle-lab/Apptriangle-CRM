import { format, parseISO } from "date-fns";
import type { LeaveDto } from "@/lib/api";

/** Inclusive ISO date ranges (yyyy-MM-dd) overlap. */
export function inclusiveDateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Pending/approved leaves whose calendar range intersects the request (optional exclude for edits). */
export function findOverlappingLeaves(
  requestStartIso: string,
  requestEndIso: string,
  leaves: LeaveDto[],
  options?: { excludeLeaveId?: string },
): LeaveDto[] {
  const excludeId = options?.excludeLeaveId;
  return leaves.filter((l) => {
    if (l.status !== "pending" && l.status !== "approved") return false;
    if (excludeId && l.id === excludeId) return false;
    return inclusiveDateRangesOverlap(
      requestStartIso,
      requestEndIso,
      l.startDate,
      l.endDate,
    );
  });
}

/** Human-readable lines for the overlap alert (e.g. conflict on Mar 3, 2026). */
export function formatConflictSummaryLines(leaves: LeaveDto[]): string[] {
  return leaves.map((l) => {
    const sd = format(parseISO(l.startDate), "MMM d, yyyy");
    const ed = format(parseISO(l.endDate), "MMM d, yyyy");
    const name = l.leaveTypeName || "Leave";
    if (l.startDate === l.endDate) {
      return `Conflict on ${sd} (${name})`;
    }
    return `Conflict between ${sd} and ${ed} (${name})`;
  });
}
