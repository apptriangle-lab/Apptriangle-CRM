/** Shared visual tokens for CRM task detail (matches tasks list / ClickUp theme). */

export const CRM_TASK_DETAIL_CARD =
  "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden";

export const CRM_TASK_DETAIL_SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export const CRM_TASK_DETAIL_BODY = "text-[13px] text-slate-700";

export const CRM_TASK_DETAIL_META_LABEL = "text-[11px] font-medium text-slate-400";

export const CRM_TASK_DETAIL_META_VALUE = "text-[13px] font-medium text-slate-800";

export const CRM_TASK_DETAIL_PILL =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700";

export const activityDotColors: Record<string, string> = {
  created: "bg-teal-500",
  updated: "bg-sky-500",
  status_changed: "bg-indigo-500",
  deleted: "bg-rose-500",
};
