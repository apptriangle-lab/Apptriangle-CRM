import { format, formatDistanceToNow, isValid, parseISO, startOfDay } from "date-fns";
import type { PmsTaskDto } from "@/lib/pmsApi";
import { getPmsTaskDateSpan, isMultiDayTask } from "@/lib/pmsTaskDates";

export type PmsStatusTheme = {
  headerBg: string;
  headerText: string;
  headerBorder: string;
  /** Solid pill for status badges / selects */
  pill: string;
  dot: string;
  rowIcon: string;
  chartFill: string;
  kanbanColumn: string;
  /** Light tinted column background */
  kanbanColumnBg: string;
  /** Soft pill on task cards */
  kanbanCardPill: string;
  /** Count + add-task link accent */
  kanbanAccent: string;
};

const PMS_STATUS_THEMES: PmsStatusTheme[] = [
  {
    headerBg: "bg-indigo-50",
    headerText: "text-indigo-950",
    headerBorder: "border-indigo-200/90",
    pill: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700",
    dot: "bg-indigo-500",
    rowIcon: "text-indigo-500",
    chartFill: "#6366f1",
    kanbanColumn: "border-t-4 border-indigo-500 bg-indigo-50/40",
    kanbanColumnBg: "bg-indigo-50/70",
    kanbanCardPill: "bg-indigo-100 text-indigo-800 border-indigo-200/80",
    kanbanAccent: "text-indigo-600",
  },
  {
    headerBg: "bg-sky-50",
    headerText: "text-sky-950",
    headerBorder: "border-sky-200/90",
    pill: "bg-sky-600 text-white border-sky-600 hover:bg-sky-700",
    dot: "bg-sky-500",
    rowIcon: "text-sky-500",
    chartFill: "#0ea5e9",
    kanbanColumn: "border-t-4 border-sky-500 bg-sky-50/40",
    kanbanColumnBg: "bg-sky-50/80",
    kanbanCardPill: "bg-sky-100 text-sky-800 border-sky-200/80",
    kanbanAccent: "text-sky-600",
  },
  {
    headerBg: "bg-amber-50",
    headerText: "text-amber-950",
    headerBorder: "border-amber-200/90",
    pill: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    dot: "bg-amber-500",
    rowIcon: "text-amber-500",
    chartFill: "#f59e0b",
    kanbanColumn: "border-t-4 border-amber-500 bg-amber-50/40",
    kanbanColumnBg: "bg-amber-50/80",
    kanbanCardPill: "bg-amber-100 text-amber-900 border-amber-200/80",
    kanbanAccent: "text-amber-600",
  },
  {
    headerBg: "bg-violet-50",
    headerText: "text-violet-950",
    headerBorder: "border-violet-200/90",
    pill: "bg-violet-600 text-white border-violet-600 hover:bg-violet-700",
    dot: "bg-violet-500",
    rowIcon: "text-violet-500",
    chartFill: "#8b5cf6",
    kanbanColumn: "border-t-4 border-violet-500 bg-violet-50/40",
    kanbanColumnBg: "bg-violet-50/80",
    kanbanCardPill: "bg-violet-100 text-violet-800 border-violet-200/80",
    kanbanAccent: "text-violet-600",
  },
  {
    headerBg: "bg-fuchsia-50",
    headerText: "text-fuchsia-950",
    headerBorder: "border-fuchsia-200/90",
    pill: "bg-fuchsia-600 text-white border-fuchsia-600 hover:bg-fuchsia-700",
    dot: "bg-fuchsia-500",
    rowIcon: "text-fuchsia-500",
    chartFill: "#d946ef",
    kanbanColumn: "border-t-4 border-fuchsia-500 bg-fuchsia-50/40",
    kanbanColumnBg: "bg-fuchsia-50/80",
    kanbanCardPill: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200/80",
    kanbanAccent: "text-fuchsia-600",
  },
  {
    headerBg: "bg-emerald-50",
    headerText: "text-emerald-950",
    headerBorder: "border-emerald-200/90",
    pill: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
    dot: "bg-emerald-500",
    rowIcon: "text-emerald-500",
    chartFill: "#10b981",
    kanbanColumn: "border-t-4 border-emerald-500 bg-emerald-50/40",
    kanbanColumnBg: "bg-emerald-50/80",
    kanbanCardPill: "bg-emerald-100 text-emerald-800 border-emerald-200/80",
    kanbanAccent: "text-emerald-600",
  },
  {
    headerBg: "bg-rose-50",
    headerText: "text-rose-950",
    headerBorder: "border-rose-200/90",
    pill: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    dot: "bg-rose-500",
    rowIcon: "text-rose-500",
    chartFill: "#f43f5e",
    kanbanColumn: "border-t-4 border-rose-500 bg-rose-50/40",
    kanbanColumnBg: "bg-rose-50/90",
    kanbanCardPill: "bg-rose-100 text-rose-800 border-rose-200/80",
    kanbanAccent: "text-rose-600",
  },
  {
    headerBg: "bg-orange-50",
    headerText: "text-orange-950",
    headerBorder: "border-orange-200/90",
    pill: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600",
    dot: "bg-orange-500",
    rowIcon: "text-orange-500",
    chartFill: "#f97316",
    kanbanColumn: "border-t-4 border-orange-500 bg-orange-50/40",
    kanbanColumnBg: "bg-orange-50/80",
    kanbanCardPill: "bg-orange-100 text-orange-800 border-orange-200/80",
    kanbanAccent: "text-orange-600",
  },
  {
    headerBg: "bg-cyan-50",
    headerText: "text-cyan-950",
    headerBorder: "border-cyan-200/90",
    pill: "bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700",
    dot: "bg-cyan-500",
    rowIcon: "text-cyan-500",
    chartFill: "#06b6d4",
    kanbanColumn: "border-t-4 border-cyan-500 bg-cyan-50/40",
    kanbanColumnBg: "bg-cyan-50/80",
    kanbanCardPill: "bg-cyan-100 text-cyan-800 border-cyan-200/80",
    kanbanAccent: "text-cyan-600",
  },
  {
    headerBg: "bg-teal-50",
    headerText: "text-teal-950",
    headerBorder: "border-teal-200/90",
    pill: "bg-teal-600 text-white border-teal-600 hover:bg-teal-700",
    dot: "bg-teal-500",
    rowIcon: "text-teal-500",
    chartFill: "#14b8a6",
    kanbanColumn: "border-t-4 border-teal-500 bg-teal-50/40",
    kanbanColumnBg: "bg-teal-50/80",
    kanbanCardPill: "bg-teal-100 text-teal-800 border-teal-200/80",
    kanbanAccent: "text-teal-600",
  },
  {
    headerBg: "bg-lime-50",
    headerText: "text-lime-950",
    headerBorder: "border-lime-200/90",
    pill: "bg-lime-600 text-white border-lime-600 hover:bg-lime-700",
    dot: "bg-lime-500",
    rowIcon: "text-lime-600",
    chartFill: "#84cc16",
    kanbanColumn: "border-t-4 border-lime-500 bg-lime-50/40",
    kanbanColumnBg: "bg-lime-50/80",
    kanbanCardPill: "bg-lime-100 text-lime-800 border-lime-200/80",
    kanbanAccent: "text-lime-600",
  },
  {
    headerBg: "bg-slate-100",
    headerText: "text-slate-700",
    headerBorder: "border-slate-200/90",
    pill: "bg-slate-500 text-white border-slate-500 hover:bg-slate-600",
    dot: "bg-slate-400",
    rowIcon: "text-slate-500",
    chartFill: "#64748b",
    kanbanColumn: "border-t-4 border-slate-400 bg-slate-50/60",
    kanbanColumnBg: "bg-slate-50/90",
    kanbanCardPill: "bg-slate-100 text-slate-700 border-slate-200/80",
    kanbanAccent: "text-slate-600",
  },
];

/** Known status slugs → stable palette index (each status gets a distinct color). */
const STATUS_INDEX: Record<string, number> = {
  to_do: 3,
  todo: 3,
  backlog: 3,
  open: 3,
  new: 3,
  in_progress: 1,
  inprogress: 1,
  progress: 1,
  active: 1,
  working: 1,
  on_hold: 2,
  onhold: 2,
  hold: 2,
  paused: 2,
  waiting: 2,
  in_review: 2,
  review: 2,
  reviewing: 2,
  qa: 4,
  testing: 4,
  test: 4,
  staging: 4,
  completed: 5,
  complete: 5,
  done: 5,
  closed: 5,
  resolved: 5,
  blocked: 6,
  failed: 6,
  rejected: 6,
  not_started: 6,
  notstarted: 6,
  pending: 6,
  planned: 8,
  ready: 8,
  deployed: 9,
  released: 9,
  cancelled: 11,
  canceled: 11,
  archived: 11,
};

function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function hashStatus(status: string): number {
  let h = 0;
  for (let i = 0; i < status.length; i++) {
    h = Math.imul(31, h) + status.charCodeAt(i);
  }
  return Math.abs(h);
}

function resolveStatusIndex(status: string, orderIndex?: number): number {
  const key = normalizeStatusKey(status);

  if (STATUS_INDEX[key] !== undefined) {
    return STATUS_INDEX[key] % PMS_STATUS_THEMES.length;
  }

  if (key.includes("done") || key.includes("complete")) return STATUS_INDEX.completed;
  if (key.includes("progress")) return STATUS_INDEX.in_progress;
  if (key.includes("hold") || key.includes("pause")) return STATUS_INDEX.on_hold;
  if (key.includes("review")) return STATUS_INDEX.in_review;
  if (key.includes("test") || key.includes("qa")) return STATUS_INDEX.testing;
  if (key.includes("cancel") || key.includes("archiv")) return STATUS_INDEX.cancelled;
  if (key.includes("block") || key.includes("fail")) return STATUS_INDEX.blocked;
  if (key.includes("not") && key.includes("start")) return STATUS_INDEX.not_started;

  if (orderIndex !== undefined && orderIndex >= 0) {
    return orderIndex % PMS_STATUS_THEMES.length;
  }

  return hashStatus(key) % PMS_STATUS_THEMES.length;
}

/** Color theme for a PMS task status (list headers, pills, kanban, charts). */
export function pmsStatusTheme(status: string, orderIndex?: number): PmsStatusTheme {
  return PMS_STATUS_THEMES[resolveStatusIndex(status, orderIndex)] ?? PMS_STATUS_THEMES[0];
}

export function pmsStatusChartFill(status: string, orderIndex?: number): string {
  return pmsStatusTheme(status, orderIndex).chartFill;
}

export const PMS_TASK_COL_GRID =
  "grid grid-cols-[minmax(0,1fr)_132px_88px_minmax(76px,max-content)_76px] items-center gap-2";

export const PMS_TASK_COL_GRID_WITH_PROJECT =
  "grid grid-cols-[minmax(0,1fr)_minmax(100px,120px)_132px_88px_minmax(76px,max-content)_76px] items-center gap-2";

/** Shared horizontal padding so column headers line up with task rows. */
export const PMS_TASK_LIST_HPAD = "pl-6 pr-4 sm:pl-8";

/** Tree branch colors by nesting level (level 1 = first subtask tier). */
export const PMS_TREE_LEVEL_STYLES = [
  {
    border: "border-sky-200",
    bg: "bg-sky-50/20",
    dot: "bg-sky-200",
    connector: "text-sky-300",
    addBorder: "border-sky-200",
    addBg: "bg-sky-50/50",
    addText: "text-sky-600",
    addHover: "group-hover/add:border-sky-300 group-hover/add:bg-sky-50/80 group-hover/add:text-sky-600",
    editorBorder: "border-sky-100",
    editorBg: "bg-sky-50/15",
    editorLabel: "text-sky-600",
  },
  {
    border: "border-violet-200",
    bg: "bg-violet-50/20",
    dot: "bg-violet-200",
    connector: "text-violet-300",
    addBorder: "border-violet-200",
    addBg: "bg-violet-50/50",
    addText: "text-violet-600",
    addHover: "group-hover/add:border-violet-300 group-hover/add:bg-violet-50/80 group-hover/add:text-violet-600",
    editorBorder: "border-violet-100",
    editorBg: "bg-violet-50/15",
    editorLabel: "text-violet-600",
  },
  {
    border: "border-amber-200",
    bg: "bg-amber-50/25",
    dot: "bg-amber-200",
    connector: "text-amber-300",
    addBorder: "border-amber-200",
    addBg: "bg-amber-50/50",
    addText: "text-amber-700",
    addHover: "group-hover/add:border-amber-300 group-hover/add:bg-amber-50/80 group-hover/add:text-amber-700",
    editorBorder: "border-amber-100",
    editorBg: "bg-amber-50/15",
    editorLabel: "text-amber-700",
  },
  {
    border: "border-emerald-200",
    bg: "bg-emerald-50/20",
    dot: "bg-emerald-200",
    connector: "text-emerald-300",
    addBorder: "border-emerald-200",
    addBg: "bg-emerald-50/50",
    addText: "text-emerald-600",
    addHover: "group-hover/add:border-emerald-300 group-hover/add:bg-emerald-50/80 group-hover/add:text-emerald-600",
    editorBorder: "border-emerald-100",
    editorBg: "bg-emerald-50/15",
    editorLabel: "text-emerald-700",
  },
  {
    border: "border-rose-200",
    bg: "bg-rose-50/20",
    dot: "bg-rose-200",
    connector: "text-rose-300",
    addBorder: "border-rose-200",
    addBg: "bg-rose-50/50",
    addText: "text-rose-600",
    addHover: "group-hover/add:border-rose-300 group-hover/add:bg-rose-50/80 group-hover/add:text-rose-600",
    editorBorder: "border-rose-100",
    editorBg: "bg-rose-50/15",
    editorLabel: "text-rose-600",
  },
  {
    border: "border-cyan-200",
    bg: "bg-cyan-50/20",
    dot: "bg-cyan-200",
    connector: "text-cyan-300",
    addBorder: "border-cyan-200",
    addBg: "bg-cyan-50/50",
    addText: "text-cyan-700",
    addHover: "group-hover/add:border-cyan-300 group-hover/add:bg-cyan-50/80 group-hover/add:text-cyan-700",
    editorBorder: "border-cyan-100",
    editorBg: "bg-cyan-50/15",
    editorLabel: "text-cyan-700",
  },
] as const;

export function pmsTreeLevelStyle(level?: number) {
  const safe =
    typeof level === "number" && Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  const idx = (safe - 1) % PMS_TREE_LEVEL_STYLES.length;
  return PMS_TREE_LEVEL_STYLES[idx] ?? PMS_TREE_LEVEL_STYLES[0];
}

export function formatPmsListDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return "—";
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return formatDistanceToNow(d, { addSuffix: true });
    return format(d, "M/d/yy");
  } catch {
    return "—";
  }
}

export function parsePmsDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

export function isPmsDueDateOverdue(
  iso: string | null | undefined,
  status?: string | null,
): boolean {
  const d = parsePmsDueDate(iso);
  if (!d) return false;
  if (status) {
    const key = status.toLowerCase().replace(/[\s-]+/g, "_");
    if (key.includes("complete") || key.includes("cancel") || key.includes("done")) return false;
  }
  return startOfDay(d) < startOfDay(new Date());
}

export function pmsDueDateTextClass(
  iso: string | null | undefined,
  status?: string | null,
): string {
  if (!iso) return "text-slate-400";
  return isPmsDueDateOverdue(iso, status) ? "text-red-600 font-medium" : "text-slate-500";
}

export function formatPmsListDateOnly(iso: string | null | undefined): string {
  const d = parsePmsDueDate(iso);
  if (!d) return "—";
  return format(d, "d MMMM").toLowerCase();
}

export function formatPmsTaskDateRange(task: Pick<PmsTaskDto, "startDate" | "endDate">): string {
  const { start, end } = getPmsTaskDateSpan(task);
  if (!start && !end) return "—";
  if (start && end) {
    if (isMultiDayTask(task)) {
      return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
    }
    return format(start, "d MMMM").toLowerCase();
  }
  return format((start ?? end)!, "d MMMM").toLowerCase();
}

export function pmsTaskDateTextClass(
  task: Pick<PmsTaskDto, "startDate" | "endDate" | "status">,
): string {
  const { end } = getPmsTaskDateSpan(task);
  if (!end) return "text-slate-400";
  return isPmsDueDateOverdue(format(end, "yyyy-MM-dd"), task.status)
    ? "text-red-600 font-medium"
    : "text-slate-500";
}

/** Projects table: e.g. 08-jun-26 */
export function formatPmsProjectTableDate(iso: string | null | undefined): string {
  const d = parsePmsDueDate(iso);
  if (!d) return "—";
  return format(d, "dd-MMM-yy").toLowerCase();
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const AVATAR_BG = ["bg-slate-800", "bg-teal-600", "bg-sky-600", "bg-orange-500", "bg-violet-600", "bg-rose-500"];

export function avatarBgClass(userId?: string): string {
  const idx = userId ? [...userId].reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  return AVATAR_BG[idx % AVATAR_BG.length];
}
