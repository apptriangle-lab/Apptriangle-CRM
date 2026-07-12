/** Shared layout + surface styles for RFQ module (full-width SaaS dashboard look). */

export const rfqShell =
  "w-full min-w-0 flex-1 bg-[#F1F4F9] bg-[radial-gradient(ellipse_100%_60%_at_50%_-30%,rgba(79,70,229,0.09),transparent_55%)] dark:bg-slate-950 dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.14),transparent_60%)]";

export const rfqInner =
  "w-full max-w-[1600px] px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10";

/** RFQ module pages (list, new, detail): flat white surface, full width; pair with Layout `p-0` on RFQ routes. */
export const rfqPageShell = "w-full min-w-0 flex-1 bg-white dark:bg-slate-950";

/** Full-width track in `<main>` (no horizontal padding — pair with `rfqPageGutter` where inset is needed). */
export const rfqPageInner = "w-full max-w-none px-0 pb-6 pt-0";

/** Horizontal inset for toolbars, list/new/detail body, and sticky bar. */
export const rfqPageGutter = "px-5 sm:px-8 lg:px-10 xl:px-12";

/** Vertical padding for RFQ main scroll areas (below sticky / mobile bars). */
export const rfqPageContentY = "pb-12 pt-6 sm:pb-14 sm:pt-8";

export const rfqCard =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-4px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] dark:border-slate-800/90 dark:bg-slate-950 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_12px_40px_-12px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]";

export const rfqCardMuted =
  "rounded-2xl border border-slate-200/60 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50";

/** Gradient strip header inside a card (SaaS section header). */
export const rfqCardHeader =
  "border-b border-slate-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50/50 px-6 py-5 sm:px-8 dark:border-slate-800/90 dark:from-indigo-950/40 dark:via-slate-950 dark:to-slate-950";

/** Card title row: same surface as rfqCard (no tinted band). */
export const rfqCardHeaderFlush =
  "bg-white px-6 py-4 sm:px-8 dark:bg-slate-950";

export const rfqCardBody = "p-6 sm:p-8";

export const rfqEyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400";

export const rfqSectionTitle =
  "text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50";

export const rfqH1 =
  "text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[1.75rem]";

export const rfqH2 = "text-sm font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400";

export const rfqBody = "text-sm leading-relaxed text-slate-600 dark:text-slate-400";

export const rfqPrimaryBtn =
  "rounded-xl bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:bg-indigo-500 dark:shadow-indigo-900/40 dark:hover:bg-indigo-400";

export const rfqStickyBar =
  "sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]";

/** Inset fields — same surface as card (no second background tone). */
export const rfqPanel =
  "rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950";

/** Table wrapper: border + radius + subtle bg */
export const rfqTableWrap =
  "overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/50";

export const rfqTableHead =
  "bg-indigo-50/90 text-[11px] font-semibold uppercase tracking-wider text-indigo-950/85 dark:bg-indigo-950/45 dark:text-indigo-100/90";

export const rfqTableHeadNeutral =
  "bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-900/90 dark:text-slate-300";

export const rfqInput =
  "h-9 rounded-lg border-slate-200 bg-white text-sm transition-colors focus-visible:border-indigo-400 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950";
