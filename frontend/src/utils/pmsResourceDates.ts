import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { PmsResourceTaskDto } from "@/lib/pmsApi";

export function parseResourceDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
    return isValid(d) ? startOfDay(d) : null;
  } catch {
    return null;
  }
}

export function defaultResourceDateRange(): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export function formatResourceApiDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function getTaskSpanDays(
  task: Pick<PmsResourceTaskDto, "startDate" | "endDate">,
  rangeFrom: Date,
  rangeTo: Date,
): Date[] {
  const start = parseResourceDate(task.startDate);
  const end = parseResourceDate(task.endDate);
  let spanStart: Date | null = null;
  let spanEnd: Date | null = null;

  if (start && end) {
    spanStart = start <= end ? start : end;
    spanEnd = start <= end ? end : start;
  } else if (end) {
    spanStart = spanEnd = end;
  } else if (start) {
    spanStart = spanEnd = start;
  } else {
    return [];
  }

  const clipStart = spanStart > rangeFrom ? spanStart : rangeFrom;
  const clipEnd = spanEnd < rangeTo ? spanEnd : rangeTo;
  if (clipStart > clipEnd) return [];
  return eachDayOfInterval({ start: clipStart, end: clipEnd });
}

export function formatTaskDateRange(task: Pick<PmsResourceTaskDto, "startDate" | "endDate">): string {
  const start = task.startDate ? format(parseResourceDate(task.startDate) ?? new Date(), "MMM d, yyyy") : null;
  const endLabel = task.endDate ? format(parseResourceDate(task.endDate) ?? new Date(), "MMM d, yyyy") : null;
  if (start && endLabel && start !== endLabel) return `${start} → ${endLabel}`;
  if (endLabel) return endLabel;
  if (start) return start;
  return "No dates";
}

export function buildTimelineDays(from: string, to: string): Date[] {
  const start = parseResourceDate(from);
  const end = parseResourceDate(to);
  if (!start || !end || start > end) return [];
  return eachDayOfInterval({ start, end });
}

export function formatResourceRangeMonthLabel(
  from: string | Date,
  to: string | Date,
): string {
  const start = typeof from === "string" ? parseResourceDate(from) : startOfDay(from);
  const end = typeof to === "string" ? parseResourceDate(to) : startOfDay(to);
  if (!start || !end) return "";

  if (format(start, "yyyy-MM") === format(end, "yyyy-MM")) {
    return format(start, "MMMM yyyy");
  }
  if (format(start, "yyyy") === format(end, "yyyy")) {
    return `${format(start, "MMMM")} – ${format(end, "MMMM yyyy")}`;
  }
  return `${format(start, "MMMM yyyy")} – ${format(end, "MMMM yyyy")}`;
}
