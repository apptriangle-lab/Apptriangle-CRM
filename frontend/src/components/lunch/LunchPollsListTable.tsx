import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LunchPollDto } from "@/lib/lunchApi";
import { getPollRemainingMs } from "@/components/lunch/lunchPollUtils";
import { LunchPollsListRow } from "@/components/lunch/LunchPollsListRow";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_LIST_HPAD,
  LUNCH_ORDER_TABLE_HEAD,
} from "@/components/lunch/lunchOrderSummaryStyles";
import {
  LUNCH_POLLS_COL_GRID,
  LUNCH_POLLS_TABLE_MIN_W,
  LUNCH_POLLS_TITLE_PL,
} from "@/components/lunch/lunchPollsListStyles";

const COLUMNS = ["Date", "Votes", "End time", "Status", "Actions"] as const;

type Props = {
  polls: LunchPollDto[];
  onEdit: (pollId: string) => void;
  onDelete: (poll: LunchPollDto) => void;
};

export function LunchPollsListTable({ polls, onEdit, onDelete }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const hasActiveTimer = polls.some(
      (p) => p.status === "active" && p.endsAt && (getPollRemainingMs(p.endsAt) ?? 0) > 0,
    );
    if (!hasActiveTimer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [polls]);

  return (
    <div className={cn(LUNCH_ORDER_CARD, "min-h-0 flex-1")}>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-table">
        <div className={LUNCH_POLLS_TABLE_MIN_W}>
          <div
            role="row"
            className={cn(
              LUNCH_POLLS_COL_GRID,
              LUNCH_ORDER_LIST_HPAD,
              LUNCH_ORDER_TABLE_HEAD,
            )}
          >
            <span className={cn("min-w-0 truncate", LUNCH_POLLS_TITLE_PL)}>
              {COLUMNS[0]}{" "}
              <span className="font-normal text-stone-400">({polls.length})</span>
            </span>
            {COLUMNS.slice(1).map((col) => (
              <span key={col} className={cn("min-w-0 truncate", col === "Actions" && "text-right")}>
                {col}
              </span>
            ))}
          </div>

          {polls.map((poll) => (
            <div key={poll.id} className={LUNCH_ORDER_LIST_HPAD}>
              <LunchPollsListRow
                poll={poll}
                now={now}
                onEdit={() => onEdit(poll.id)}
                onDelete={() => onDelete(poll)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
