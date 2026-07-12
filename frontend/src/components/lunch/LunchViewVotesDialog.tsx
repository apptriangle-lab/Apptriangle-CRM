import { BarChart3, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LunchPollProgressBar } from "@/components/lunch/LunchPollProgressBar";
import { getPollOptionVisual } from "@/components/lunch/lunchPollOptionVisuals";
import { LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { cn } from "@/lib/utils";
import type {
  LunchPollDto,
  LunchPollSummaryDto,
  LunchSnapshotOptionDto,
} from "@/lib/lunchApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll: LunchPollDto;
  results: LunchPollSummaryDto | null;
  options: LunchSnapshotOptionDto[];
  totalVotes: number;
};

export function LunchViewVotesDialog({
  open,
  onOpenChange,
  poll,
  results,
  options,
  totalVotes,
}: Props) {
  const rows =
    results?.options?.length
      ? results.options
      : options.map((opt) => ({
          optionId: opt.id,
          label: opt.label || opt.name || "",
          optionType: opt.optionType,
          count: opt.count ?? 0,
          voters: opt.voters,
        }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg gap-0 overflow-hidden rounded-3xl border-stone-200/80 p-0 shadow-[0_8px_30px_rgba(251,146,60,0.12)] [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-lg [&>button]:hover:bg-orange-50">
        <DialogHeader className="relative overflow-hidden border-b border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white px-5 py-4 pr-12">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-200/30 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-base font-bold leading-snug text-stone-900">
                {poll.title}
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200/70">
                  <Users className="h-3 w-3" />
                  {totalVotes} vote{totalVotes === 1 ? "" : "s"} total
                </span>
                <span className="text-xs text-stone-500">All poll results</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(85vh-6rem)] overflow-y-auto bg-[#FFFBF7] p-4 scrollbar-thinner sm:p-5">
          <div className="space-y-3">
            {rows.map((opt) => {
              const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
              const visual = getPollOptionVisual(opt.optionType);
              const Icon = visual.icon;
              const typeLabel = LUNCH_OPTION_TYPE_LABELS[opt.optionType ?? ""] ?? opt.optionType;

              return (
                <div
                  key={opt.optionId}
                  className="overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-[0_2px_12px_rgba(251,146,60,0.06)]"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          visual.chipClass,
                        )}
                      >
                        <Icon className={cn("h-4 w-4", visual.iconClass)} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">{opt.label}</p>
                          {typeLabel && (
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                              {typeLabel}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className="text-xs text-stone-500">
                            {opt.count} vote{opt.count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <LunchPollProgressBar percent={pct} />
                      </div>
                    </div>
                  </div>

                  {opt.voters && opt.voters.length > 0 ? (
                    <ul className="divide-y divide-orange-50 border-t border-orange-50 bg-orange-50/20 px-4 py-1">
                      {opt.voters.map((v) => (
                        <li
                          key={v.userId}
                          className="flex items-center gap-2.5 py-2.5 text-sm text-stone-700"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white"
                            style={{ backgroundColor: avatarColor(v.userName) }}
                          >
                            {initials(v.userName)}
                          </span>
                          <span className="font-medium">{v.userName}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-orange-50 bg-stone-50/50 px-4 py-3 text-center text-xs text-stone-400">
                      No votes for this option
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const AVATAR_COLORS = ["#FB923C", "#34D399", "#60A5FA", "#A78BFA", "#F472B6", "#FBBF24", "#94A3B8"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
