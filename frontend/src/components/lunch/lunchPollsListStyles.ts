/** Equal-width 5-column grid: date/title → votes → end time → status → actions */
export const LUNCH_POLLS_COL_GRID = "grid grid-cols-5 items-center gap-x-4";

export const LUNCH_POLLS_TABLE_MIN_W = "w-full min-w-0";

export const LUNCH_POLLS_LIST_HPAD = "px-5 sm:px-6";

export const LUNCH_POLLS_TITLE_PL = "pl-2.5";

export function lunchPollStatusPillClass(status: string): string {
  if (status === "active") {
    return "border-emerald-200/80 bg-emerald-50 text-emerald-800";
  }
  return "border-stone-200 bg-stone-100 text-stone-600";
}

export function formatPollStatusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "closed") return "Poll closed";
  return status;
}
