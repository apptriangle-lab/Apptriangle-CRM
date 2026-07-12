export const LUNCH_CARD = "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden";

export const LUNCH_PAGE_BG = "bg-[#f8f9fb]";

/** User lunch page — warm Dribbble-inspired palette */
export const LUNCH_USER_PAGE_BG = "bg-[#FFFBF7]";
export const LUNCH_USER_ACCENT = "orange";

export const LUNCH_OPTION_TYPE_LABELS: Record<string, string> = {
  office: "Office menu",
  personal: "Personal",
  off: "Off / absent",
};

export const LUNCH_OPTION_TYPE_COLORS: Record<string, string> = {
  office: "bg-orange-50 text-orange-800 ring-orange-200/80",
  personal: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  off: "bg-stone-100 text-stone-600 ring-stone-200/80",
};

/** Lunch poll card design tokens */
export const LUNCH_POLL_THEME = {
  card: "#FFFFFF",
  accent: "#EA580C",
  accentSoft: "#FFF7ED",
  text: "#1C1917",
  muted: "#78716C",
  track: "#F5F5F4",
  divider: "#E7E5E4",
  border: "#E7E5E4",
} as const;
