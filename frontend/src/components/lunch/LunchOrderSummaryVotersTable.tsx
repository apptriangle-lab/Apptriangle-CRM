import { format } from "date-fns";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LunchPollSummaryDto } from "@/lib/lunchApi";
import { LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_ROW,
  LUNCH_ORDER_TABLE_HEAD,
  LUNCH_ORDER_TITLE_PL,
  LUNCH_ORDER_VOTERS_COL_GRID,
  lunchOrderTypePillClass,
} from "@/components/lunch/lunchOrderSummaryStyles";
import { LunchOrderSummaryReloadButton } from "@/components/lunch/LunchOrderSummaryReloadButton";
import { LunchOrderSummaryVotersBodySkeleton } from "@/components/lunch/LunchOrderSummarySkeleton";

type Props = {
  voters: LunchPollSummaryDto["voters"];
  search: string;
  onReload: () => void;
  reloading?: boolean;
};

function formatVotedAt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "h:mm a");
  } catch {
    return "—";
  }
}

export function LunchOrderSummaryVotersTable({
  voters,
  search,
  onReload,
  reloading = false,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? voters.filter(
        (v) =>
          v.userName.toLowerCase().includes(q) ||
          v.optionLabel.toLowerCase().includes(q) ||
          v.optionType.toLowerCase().includes(q),
      )
    : voters;

  return (
    <div className={LUNCH_ORDER_CARD}>
      <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900">Employee votes</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {reloading
              ? "Refreshing votes…"
              : `Who chose what · ${filtered.length} of ${voters.length} shown`}
          </p>
        </div>
        <LunchOrderSummaryReloadButton onClick={onReload} loading={reloading} />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-table">
        <div className="w-full min-w-0">
          <div
            role="row"
            className={cn(
              LUNCH_ORDER_VOTERS_COL_GRID,
              LUNCH_ORDER_LIST_HPAD,
              LUNCH_ORDER_TABLE_HEAD,
            )}
          >
            <span className={cn("min-w-0 truncate", LUNCH_ORDER_TITLE_PL)}>
              Employee{" "}
              <span className="font-normal text-slate-400">
                ({reloading ? "…" : filtered.length})
              </span>
            </span>
            <span>Choice</span>
            <span>Type</span>
            <span>Voted</span>
          </div>

          {reloading ? (
            <LunchOrderSummaryVotersBodySkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                <Users className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-700">
                {voters.length === 0 ? "No votes yet" : "No employees match your search"}
              </p>
              <p className="text-xs text-slate-500">
                {voters.length === 0
                  ? "Votes will appear here once employees respond to the poll."
                  : "Try a different name or clear the search."}
              </p>
            </div>
          ) : (
            filtered.map((v) => (
              <div
                key={`${v.userId}-${v.optionId}`}
                role="row"
                className={cn(
                  LUNCH_ORDER_VOTERS_COL_GRID,
                  LUNCH_ORDER_LIST_HPAD,
                  LUNCH_ORDER_ROW,
                )}
              >
                <div className={cn("flex min-w-0 items-center gap-2.5", LUNCH_ORDER_TITLE_PL)}>
                  <PmsMemberAvatar name={v.userName} userId={v.userId} size="sm" />
                  <span className="truncate font-medium text-slate-800">{v.userName}</span>
                </div>
                <span className="min-w-0 truncate text-slate-700">{v.optionLabel}</span>
                <span
                  className={cn(
                    "inline-flex h-6 w-fit max-w-full min-w-0 items-center truncate rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide",
                    lunchOrderTypePillClass(v.optionType),
                  )}
                >
                  {LUNCH_OPTION_TYPE_LABELS[v.optionType] ?? v.optionType}
                </span>
                <span className="tabular-nums text-slate-600">{formatVotedAt(v.votedAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
