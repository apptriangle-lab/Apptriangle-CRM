import { format } from "date-fns";
import { Trash2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LunchPollDto } from "@/lib/lunchApi";
import { LunchPollTableEndTimeCell } from "@/components/lunch/LunchPollTableEndTimeCell";
import { LUNCH_ORDER_ROW } from "@/components/lunch/lunchOrderSummaryStyles";
import {
  LUNCH_POLLS_COL_GRID,
  LUNCH_POLLS_TITLE_PL,
  lunchPollStatusPillClass,
  formatPollStatusLabel,
} from "@/components/lunch/lunchPollsListStyles";

type Props = {
  poll: LunchPollDto;
  now: number;
  onEdit: () => void;
  onDelete: () => void;
};

export function LunchPollsListRow({ poll, now, onEdit, onDelete }: Props) {
  const dateLabel = format(new Date(poll.date + "T12:00:00"), "MMM d, yyyy");

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className={cn(
        LUNCH_POLLS_COL_GRID,
        LUNCH_ORDER_ROW,
        "group cursor-pointer focus-visible:bg-orange-50/50 focus-visible:outline-none",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5 self-stretch -my-2.5 py-2.5 pr-2",
          LUNCH_POLLS_TITLE_PL,
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-orange-200/80 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-600">
          <UtensilsCrossed className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-800">{dateLabel}</p>
          <p className="truncate text-xs text-stone-500">{poll.title}</p>
        </div>
      </div>

      <span className="min-w-0 truncate tabular-nums font-medium text-stone-700">{poll.totalVotes ?? 0}</span>

      <div className="min-w-0">
        <LunchPollTableEndTimeCell poll={poll} now={now} variant="table" />
      </div>

      <span
        className={cn(
          "inline-flex h-7 w-fit max-w-full min-w-0 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide",
          lunchPollStatusPillClass(poll.status),
        )}
      >
        <span className="truncate">{formatPollStatusLabel(poll.status)}</span>
      </span>

      <div
        className="flex min-w-0 items-center justify-end gap-0.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title="Delete poll"
          aria-label="Delete poll"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
