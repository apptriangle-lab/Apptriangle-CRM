/** Order summary — shared layout + poll-page orange theme */
export const LUNCH_ORDER_VOTERS_COL_GRID =
  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,84px)_minmax(0,64px)] items-center gap-x-2 sm:gap-x-3";

export const LUNCH_ORDER_OPTIONS_COL_GRID =
  "grid grid-cols-[minmax(0,1.35fr)_minmax(0,84px)_40px_minmax(0,0.85fr)] items-center gap-x-2 sm:gap-x-3";

export const LUNCH_ORDER_LIST_HPAD = "px-4 sm:px-5";

export const LUNCH_ORDER_TITLE_PL = "pl-1.5 sm:pl-2";

export const LUNCH_ORDER_CARD =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-[0_4px_16px_rgba(251,146,60,0.06)]";

export const LUNCH_ORDER_CARD_HEADER =
  "flex shrink-0 items-start justify-between gap-3 border-b border-orange-100/80 bg-gradient-to-r from-orange-50/60 via-amber-50/30 to-white py-3.5";

export const LUNCH_ORDER_TABLE_HEAD =
  "sticky top-0 z-10 border-b border-orange-100 bg-orange-50/70 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-orange-800/75 backdrop-blur-sm";

export const LUNCH_ORDER_ROW =
  "border-b border-orange-50/80 py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-orange-50/35";

export function lunchOrderTypePillClass(optionType: string): string {
  if (optionType === "office") return "border-orange-200/80 bg-orange-50 text-orange-800";
  if (optionType === "personal") return "border-emerald-200/80 bg-emerald-50 text-emerald-800";
  return "border-stone-200 bg-stone-100 text-stone-600";
}

export function lunchOrderShareBarClass(optionType: string): string {
  if (optionType === "office") return "bg-gradient-to-r from-orange-500 to-amber-500";
  if (optionType === "personal") return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  return "bg-stone-400";
}
