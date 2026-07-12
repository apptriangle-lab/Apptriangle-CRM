import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPollCountdown, getPollRemainingMs } from "@/components/lunch/lunchPollUtils";
import { formatTime12Label } from "@/components/pms/PmsTimePicker";
import type { LunchPollDto } from "@/lib/lunchApi";

type Props = {
  poll: LunchPollDto;
  now: number;
  variant?: "default" | "table";
};

/** Polls admin table: live countdown while active, then scheduled end time (12h). */
export function LunchPollTableEndTimeCell({ poll, now, variant = "default" }: Props) {
  const remaining = getPollRemainingMs(poll.endsAt, now);
  const showTimer = poll.status === "active" && remaining !== null && remaining > 0;

  if (showTimer) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 font-medium tabular-nums text-orange-600",
          variant === "table" && "text-[13px]",
        )}
      >
        {variant === "table" ? <Hourglass className="h-3.5 w-3.5 shrink-0 text-orange-500/90" /> : null}
        <span className="truncate">{formatPollCountdown(remaining)}</span>
      </span>
    );
  }

  if (poll.endTime) {
    return (
      <span className={cn("tabular-nums text-stone-600", variant === "table" && "text-[13px]")}>
        {formatTime12Label(poll.endTime)}
      </span>
    );
  }

  return <span className="text-slate-400">—</span>;
}
