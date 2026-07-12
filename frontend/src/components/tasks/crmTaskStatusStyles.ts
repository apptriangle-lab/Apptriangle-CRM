/** Cool-theme palette for CRM task statuses (list pills, filters, badges). */
export type CrmTaskStatusTheme = {
  dot: string;
  pill: string;
  badge: string;
};

const CRM_TASK_STATUS_THEMES: Record<string, CrmTaskStatusTheme> = {
  pending: {
    dot: "bg-amber-400",
    pill: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    badge: "bg-amber-50 text-amber-800 border-amber-200/80",
  },
  in_progress: {
    dot: "bg-sky-500",
    pill: "bg-sky-600 text-white border-sky-600 hover:bg-sky-700",
    badge: "bg-sky-50 text-sky-800 border-sky-200/80",
  },
  completed: {
    dot: "bg-teal-500",
    pill: "bg-teal-600 text-white border-teal-600 hover:bg-teal-700",
    badge: "bg-teal-50 text-teal-800 border-teal-200/80",
  },
  cancelled: {
    dot: "bg-rose-400",
    pill: "bg-rose-500 text-white border-rose-500 hover:bg-rose-600",
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
  },
};

const CRM_TASK_STATUS_DEFAULT: CrmTaskStatusTheme = {
  dot: "bg-violet-400",
  pill: "bg-violet-600 text-white border-violet-600 hover:bg-violet-700",
  badge: "bg-violet-50 text-violet-800 border-violet-200/80",
};

export function crmTaskStatusTheme(status: string): CrmTaskStatusTheme {
  return CRM_TASK_STATUS_THEMES[status] ?? CRM_TASK_STATUS_DEFAULT;
}

/** @deprecated Use crmTaskStatusTheme(status).dot */
export const CRM_TASK_STATUS_DOT: Record<string, string> = Object.fromEntries(
  Object.entries(CRM_TASK_STATUS_THEMES).map(([k, v]) => [k, v.dot]),
);

/** @deprecated Use crmTaskStatusTheme(status).badge */
export const CRM_TASK_STATUS_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(CRM_TASK_STATUS_THEMES).map(([k, v]) => [k, v.badge]),
);

export function crmTaskStatusDotClass(status: string): string {
  return crmTaskStatusTheme(status).dot;
}

export function crmTaskStatusBadgeClass(status: string): string {
  return crmTaskStatusTheme(status).badge;
}

export function crmTaskStatusPillClass(status: string): string {
  return crmTaskStatusTheme(status).pill;
}
