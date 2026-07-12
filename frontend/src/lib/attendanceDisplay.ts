import { differenceInMinutes, format } from "date-fns";
import type { AttendanceDto } from "@/lib/api";

/** Periods supported by GET /api/attendance/records for the current user. */
export type AttendanceHistoryPeriod =
  | "week"
  | "last_week"
  | "month"
  | "last_month"
  | "year"
  | "last_year";

export const ATTENDANCE_HISTORY_FILTERS: {
  value: AttendanceHistoryPeriod;
  label: string;
}[] = [
  { value: "week", label: "This Week" },
  { value: "last_week", label: "Previous Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Previous Month" },
  { value: "year", label: "This Year" },
  { value: "last_year", label: "Previous Year" },
];

export type TodayAttendanceView = Pick<
  AttendanceDto,
  | "id"
  | "checkInTime"
  | "checkOutTime"
  | "hasShiftAssigned"
  | "status"
  | "isWeekend"
  | "isHoliday"
  | "date"
  | "lateReconciliation"
>;

export function toTodayAttendanceView(a: AttendanceDto): TodayAttendanceView {
  return {
    id: a.id,
    checkInTime: a.checkInTime,
    checkOutTime: a.checkOutTime,
    hasShiftAssigned: a.hasShiftAssigned,
    status: a.status,
    isWeekend: a.isWeekend,
    isHoliday: a.isHoliday,
    date: a.date,
    lateReconciliation: a.lateReconciliation,
  };
}

export function formatAttendanceStatusLabel(status: string | undefined): string {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "off_day":
      return "Off day";
    case "no_shift":
      return "No shift";
    default:
      return status ? status.replace(/_/g, " ") : "—";
  }
}

/** User-facing status for today's action card (check-in flow). */
export function getTodayActionStatusLabel(
  today: TodayAttendanceView | null,
  blocked: boolean,
): string {
  if (blocked) return "Attendance unavailable";
  if (!today?.checkInTime) {
    if (today?.status === "off_day") return "Off day";
    if (today?.isWeekend) return "Weekend";
    if (today?.isHoliday) return "Holiday";
    return "Not checked in";
  }
  if (!today.checkOutTime) return "Checked in";
  return "Checked out";
}

export function formatWorkingHours(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string {
  if (!checkIn || !checkOut) return "—";
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "—";
  const totalMin = differenceInMinutes(new Date(end), new Date(start));
  if (totalMin < 0) return "—";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Format attendance calendar date as month + day (e.g. "Jun 16"). */
export function formatAttendanceDateShort(value?: string | null): string {
  if (!value?.trim()) return "—";
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "MMM d");
}

/** Format API ISO datetime or HH:mm / HH:mm:ss as 12-hour clock (e.g. "09:25 AM"). */
export function formatAttendanceHhmm12h(value?: string | null): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  if (trimmed.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return format(d, "hh:mm a");
  }
  const [h, m] = trimmed.split(":");
  const hour = Number(h);
  const minute = Number(m ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return trimmed;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return format(date, "hh:mm a");
}
