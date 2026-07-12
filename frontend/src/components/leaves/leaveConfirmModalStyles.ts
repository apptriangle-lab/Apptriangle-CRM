/** Shared layout classes so approve/reject modals fit laptop viewports without scrolling. */

export const leaveConfirmModalShellClass =
  "flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[420px] flex-col gap-0 overflow-hidden rounded-[28px] border border-slate-100 p-0 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] sm:max-w-[420px]";

export const leaveConfirmModalBodyWrapClass = "min-h-0 shrink px-5 pt-5 sm:px-6 sm:pt-6";

export const leaveConfirmModalFooterClass = "flex shrink-0 gap-3 px-5 pb-5 pt-3 sm:px-6 sm:pb-6";

export const leaveConfirmModalButtonClass =
  "h-11 flex-1 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-none hover:bg-slate-50 hover:text-slate-600";

export const leaveConfirmModalPrimaryButtonClass = "h-11 flex-[1.2] rounded-xl text-sm font-bold text-white shadow-none";

export const leaveConfirmBodyRootClass =
  "space-y-3.5 [@media(max-height:820px)]:space-y-2.5 [@media(max-height:700px)]:space-y-2";

export const leaveConfirmDetailsSectionClass =
  "space-y-3 [@media(max-height:820px)]:space-y-2.5 [@media(max-height:700px)]:space-y-2";

export const leaveConfirmHeaderIconWrapClass =
  "mb-2 flex h-11 w-11 items-center justify-center rounded-[12px] [@media(max-height:820px)]:mb-1.5 [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:w-10";

export const leaveConfirmHeaderIconInnerClass =
  "flex h-[30px] w-[30px] items-center justify-center rounded-full [@media(max-height:820px)]:h-[26px] [@media(max-height:820px)]:w-[26px]";

export const leaveConfirmTitleClass =
  "text-xl font-bold leading-tight tracking-tight text-slate-900 [@media(max-height:820px)]:text-lg";

export const leaveConfirmSubtitleClass =
  "mt-1 max-w-[280px] text-xs leading-snug text-slate-500 [@media(max-height:820px)]:text-[11px] [@media(max-height:820px)]:leading-tight";

export const leaveConfirmReasonBoxClass =
  "rounded-xl bg-slate-100/90 px-3.5 py-2 [@media(max-height:820px)]:px-3 [@media(max-height:820px)]:py-1.5";

export const leaveConfirmReasonTextClass =
  "line-clamp-2 text-[13px] italic leading-snug text-slate-600 [@media(max-height:820px)]:text-xs";

export const leaveConfirmBalanceCardClass =
  "rounded-2xl bg-[#f4f7fa] p-3.5 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:p-3";

export const leaveConfirmBalanceAfterClass =
  "mt-0.5 text-xl font-bold leading-none tabular-nums [@media(max-height:820px)]:text-lg";

export const leaveConfirmAppliedOnClass =
  "text-center text-[11px] leading-none text-slate-400 [@media(max-height:820px)]:text-[10px]";
