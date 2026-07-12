import { cn } from "@/lib/utils";

export const statusColors: Record<string, string> = {
  lead: "bg-slate-100 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700",
  prospect: "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-800",
  negotiation: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
  closed: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-800/50",
  disqualified: "bg-red-50 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-900/50",
  pending: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700",
  in_progress: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-800/50",
  completed: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-800/50",
  cancelled: "bg-red-50 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-900/50",
};

export const categoryColors: Record<string, string> = {
  hot: "bg-orange-50 text-orange-900 ring-1 ring-orange-200/90 dark:bg-orange-950/45 dark:text-orange-100 dark:ring-orange-800/50",
  warm: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
  cold: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700",
};

export function statusBadgeClass(status: string) {
  return cn("font-medium", statusColors[status] ?? "bg-muted text-muted-foreground ring-1 ring-border");
}

export function categoryBadgeClass(category: string) {
  return cn("font-medium", categoryColors[category] ?? "bg-muted text-muted-foreground ring-1 ring-border");
}

/** Display-only heuristic when backend has no win % field */
export function heuristicWinProbability(category: string): number {
  const c = category.toLowerCase();
  if (c === "hot") return 72;
  if (c === "warm") return 48;
  if (c === "cold") return 22;
  return 40;
}
