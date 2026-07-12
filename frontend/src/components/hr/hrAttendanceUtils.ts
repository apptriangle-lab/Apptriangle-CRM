import type { HRInfoDto } from "@/lib/api";

/** Sentinel for attendance shift filter: employees with no shift assigned. */
export const ATTENDANCE_SHIFT_UNASSIGNED = "__unassigned__";

export function userHasShiftAssigned(hr: HRInfoDto | undefined): boolean {
  const id = hr?.shiftId?.trim();
  return !!id;
}
