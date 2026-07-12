import { isAfter, isBefore, isSameDay, isValid, max, min, parseISO, startOfDay } from "date-fns";
import type { PmsDateRange } from "@/components/pms/PmsTaskDatePicker";
import type { PmsTaskDto } from "@/lib/pmsApi";

export function parsePmsTaskDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
    return isValid(d) ? startOfDay(d) : null;
  } catch {
    return null;
  }
}

export function getPmsTaskDateSpan(task: Pick<PmsTaskDto, "startDate" | "endDate">): {
  start: Date | null;
  end: Date | null;
} {
  const start = parsePmsTaskDate(task.startDate);
  const end = parsePmsTaskDate(task.endDate);
  if (start && end) {
    return start <= end ? { start, end } : { start: end, end: start };
  }
  if (end) return { start: end, end };
  if (start) return { start, end: start };
  return { start: null, end: null };
}

export function taskHasDates(task: Pick<PmsTaskDto, "startDate" | "endDate">): boolean {
  return Boolean(task.startDate || task.endDate);
}

export function normalizeTaskDateRange(range: PmsDateRange): PmsDateRange {
  let { startDate, endDate } = range;
  if (startDate && !endDate) endDate = startDate;
  if (endDate && !startDate) startDate = endDate;
  if (startDate && endDate && startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export function validateTaskDateRange(range: PmsDateRange): string | null {
  const { startDate, endDate } = range;
  if (!startDate && !endDate) return null;
  if (startDate && endDate && isAfter(startOfDay(startDate), startOfDay(endDate))) {
    return "End date must be on or after start date";
  }
  return null;
}

export function taskOverlapsDateRange(
  task: Pick<PmsTaskDto, "startDate" | "endDate">,
  filter: PmsDateRange,
): boolean {
  const { startDate: fStart, endDate: fEnd } = filter;
  if (!fStart && !fEnd) return true;

  const { start: tStart, end: tEnd } = getPmsTaskDateSpan(task);
  if (!tStart || !tEnd) return false;

  if (fStart && fEnd) {
    const from = startOfDay(min([fStart, fEnd]));
    const to = startOfDay(max([fStart, fEnd]));
    return !isBefore(tEnd, from) && !isAfter(tStart, to);
  }
  if (fStart) return !isBefore(tEnd, startOfDay(fStart));
  if (fEnd) return !isAfter(tStart, startOfDay(fEnd));
  return true;
}

export function isPmsTaskOverdue(
  task: Pick<PmsTaskDto, "startDate" | "endDate" | "status">,
  now = new Date(),
): boolean {
  const { end } = getPmsTaskDateSpan(task);
  if (!end) return false;
  const status = task.status?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (status.includes("complete") || status.includes("cancel") || status.includes("done")) {
    return false;
  }
  return startOfDay(end) < startOfDay(now);
}

export function isMultiDayTask(task: Pick<PmsTaskDto, "startDate" | "endDate">): boolean {
  const { start, end } = getPmsTaskDateSpan(task);
  return Boolean(start && end && !isSameDay(start, end));
}
