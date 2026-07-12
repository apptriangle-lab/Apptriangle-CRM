import { format, parseISO, isValid } from "date-fns";
import { PMS_SPRINT_STATUSES, type PmsSprintDto, type PmsSprintFilter } from "@/lib/pmsApi";

export function formatPmsSprintStatusLabel(status: string): string {
  const found = PMS_SPRINT_STATUSES.find((s) => s.value === status);
  if (found) return found.label;
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSprintDateRange(start: string | null, end: string | null): string {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
      return isValid(d) ? format(d, "MMM d, yyyy") : null;
    } catch {
      return null;
    }
  };
  const a = fmt(start);
  const b = fmt(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return "No dates set";
}

export const sprintStatusStyles: Record<string, string> = {
  planned: "bg-slate-200 text-slate-900 border-slate-400",
  active: "bg-emerald-100 text-emerald-950 border-emerald-400",
  completed: "bg-violet-100 text-violet-950 border-violet-400",
  cancelled: "bg-rose-100 text-rose-950 border-rose-400",
};

export const sprintStatusAccent: Record<string, string> = {
  planned: "bg-slate-600",
  active: "bg-emerald-600",
  completed: "bg-violet-600",
  cancelled: "bg-rose-600",
};

const SPRINT_STATUS_ORDER: Record<string, number> = {
  active: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
};

export function comparePmsSprints(a: { status: string; sortOrder: number }, b: { status: string; sortOrder: number }) {
  const sa = SPRINT_STATUS_ORDER[a.status] ?? 9;
  const sb = SPRINT_STATUS_ORDER[b.status] ?? 9;
  if (sa !== sb) return sa - sb;
  return a.sortOrder - b.sortOrder;
}

export function resolveSprintFilter(filter: PmsSprintFilter, sprints: PmsSprintDto[]): PmsSprintFilter {
  if (filter === "all") {
    const active = sprints.find((s) => s.status === "active");
    if (active) return active.id;
    const sorted = [...sprints].sort(comparePmsSprints);
    if (sorted.length > 0) return sorted[0].id;
    return "backlog";
  }
  if (filter === "backlog") return "backlog";
  if (sprints.some((s) => s.id === filter)) return filter;
  const active = sprints.find((s) => s.status === "active");
  if (active) return active.id;
  const sorted = [...sprints].sort(comparePmsSprints);
  if (sorted.length > 0) return sorted[0].id;
  return "backlog";
}

export function formatSprintDateRangeShort(start: string | null, end: string | null): string {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
      return isValid(d) ? format(d, "MMM d") : null;
    } catch {
      return null;
    }
  };
  const a = fmt(start);
  const b = fmt(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return "No dates";
}
