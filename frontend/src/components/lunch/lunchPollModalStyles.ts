export const LUNCH_POLL_MODAL_CONTENT =
  "flex w-[min(96vw,980px)] max-w-[980px] flex-col gap-0 overflow-hidden rounded-3xl border-stone-200/80 bg-white p-0 shadow-[0_8px_30px_rgba(251,146,60,0.12)]";

export const LUNCH_POLL_MODAL_HEADER =
  "flex items-start justify-between gap-4 border-b border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white px-6 py-4";

export const LUNCH_POLL_MODAL_BODY = "bg-[#FFFBF7] px-4 py-4 sm:px-6";

export const LUNCH_POLL_MODAL_FOOTER =
  "flex flex-col-reverse gap-2 border-t border-orange-100/80 bg-gradient-to-r from-orange-50/30 via-white to-amber-50/20 px-6 py-3 sm:flex-row sm:justify-end";

export const LUNCH_POLL_SECTION_CARD =
  "rounded-2xl border border-orange-100/80 bg-white p-3.5 shadow-[0_2px_10px_rgba(251,146,60,0.05)]";

export const LUNCH_POLL_CHIP_INACTIVE =
  "border-stone-200 bg-stone-100/70 text-stone-500 hover:border-orange-200 hover:bg-orange-50/50 hover:text-stone-600";

export const LUNCH_POLL_CHIP_ACTIVE =
  "border-orange-300 bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200";

export const LUNCH_POLL_ACCENT = {
  details: "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 ring-1 ring-inset ring-orange-200/60",
  rules: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
  menu: "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 ring-1 ring-inset ring-orange-200/60",
  votes: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100",
} as const;
