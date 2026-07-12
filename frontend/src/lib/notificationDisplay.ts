import type { LucideIcon } from "lucide-react";
import { CheckSquare, Clock, FolderKanban, Bell, UtensilsCrossed } from "lucide-react";
import type { NotificationDto } from "@/lib/api";

export type NotificationCategory = "task" | "pms" | "hr" | "lunch" | "system";

export type NotificationCategoryMeta = {
  id: NotificationCategory;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  iconWrapClass: string;
  iconClass: string;
  accentClass: string;
};

const CATEGORY_META: Record<NotificationCategory, NotificationCategoryMeta> = {
  task: {
    id: "task",
    label: "Task",
    icon: CheckSquare,
    badgeClass: "bg-sky-50 text-sky-700 ring-sky-200/80",
    iconWrapClass: "bg-sky-50 ring-sky-100",
    iconClass: "text-sky-600",
    accentClass: "bg-sky-500",
  },
  pms: {
    id: "pms",
    label: "PMS",
    icon: FolderKanban,
    badgeClass: "bg-violet-50 text-violet-700 ring-violet-200/80",
    iconWrapClass: "bg-violet-50 ring-violet-100",
    iconClass: "text-violet-600",
    accentClass: "bg-violet-500",
  },
  hr: {
    id: "hr",
    label: "HR",
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200/80",
    iconWrapClass: "bg-amber-50 ring-amber-100",
    iconClass: "text-amber-600",
    accentClass: "bg-amber-500",
  },
  lunch: {
    id: "lunch",
    label: "Lunch",
    icon: UtensilsCrossed,
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    iconWrapClass: "bg-emerald-50 ring-emerald-100",
    iconClass: "text-emerald-600",
    accentClass: "bg-emerald-500",
  },
  system: {
    id: "system",
    label: "System",
    icon: Bell,
    badgeClass: "bg-slate-100 text-slate-600 ring-slate-200/80",
    iconWrapClass: "bg-slate-50 ring-slate-100",
    iconClass: "text-slate-500",
    accentClass: "bg-slate-400",
  },
};

function inferCategoryFromContent(n: Pick<NotificationDto, "title" | "message" | "category">): NotificationCategory {
  const raw = (n.category || "").toLowerCase();
  if (raw === "task" || raw === "pms" || raw === "hr" || raw === "lunch" || raw === "system") {
    return raw;
  }

  const title = n.title.toLowerCase();
  const haystack = `${n.title} ${n.message}`.toLowerCase();
  if (title.startsWith("lunch") || haystack.includes("lunch ·")) return "lunch";
  if (title.startsWith("pms") || haystack.includes("pms ·")) return "pms";
  if (haystack.includes("assigned you to \"") || haystack.includes("added you to the project")) {
    return "pms";
  }
  if (haystack.includes("shift")) return "hr";
  if (haystack.includes("task")) return "task";
  return "system";
}

export function resolveNotificationCategory(
  n: Pick<NotificationDto, "title" | "message" | "category">,
): NotificationCategory {
  return inferCategoryFromContent(n);
}

export function getNotificationCategoryMeta(
  n: Pick<NotificationDto, "title" | "message" | "category">,
): NotificationCategoryMeta {
  return CATEGORY_META[resolveNotificationCategory(n)];
}

export function formatNotificationTitle(title: string, category: NotificationCategory): string {
  const trimmed = title.trim();
  if (category === "pms") {
    return trimmed.replace(/^PMS\s*[·•\-–—]\s*/i, "").trim() || trimmed;
  }
  if (category === "lunch") {
    return trimmed.replace(/^Lunch\s*[·•\-–—]\s*/i, "").trim() || trimmed;
  }
  return trimmed;
}

/** In-app route when the user clicks a notification, or null if none. */
export function getNotificationHref(
  n: Pick<NotificationDto, "title" | "message" | "category">,
): string | null {
  const category = resolveNotificationCategory(n);
  if (category === "lunch") return "/lunch";
  return null;
}

export function formatCompactTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
