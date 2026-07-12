/** Shared visual tokens for Attendance (matches Tasks / PMS ClickUp theme). */

export const ATTENDANCE_CARD =
  "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden";

export const ATTENDANCE_SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export const ATTENDANCE_META_LABEL = "text-[11px] font-medium text-slate-400";

export const ATTENDANCE_META_VALUE = "text-[13px] font-semibold text-slate-800";

export const ATTENDANCE_STAT_TILE =
  "rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5";

/** Session flag: user closed the late reconciliation modal without submitting. */
export const lateReconDismissStorageKey = (attendanceId: string) =>
  `crm-late-recon-dismissed-${attendanceId}`;
