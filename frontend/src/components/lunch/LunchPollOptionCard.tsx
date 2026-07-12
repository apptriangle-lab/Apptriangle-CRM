import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPollOptionVisual } from "@/components/lunch/lunchPollOptionVisuals";
import { LUNCH_OPTION_TYPE_LABELS } from "@/components/lunch/lunchConstants";
import { LunchPollProgressBar } from "@/components/lunch/LunchPollProgressBar";
import type { LunchPollOptionDto, LunchPollSummaryOptionDto } from "@/lib/lunchApi";

type Props = {
  option: LunchPollOptionDto;
  result?: LunchPollSummaryOptionDto;
  totalVotes: number;
  selected: boolean;
  pending: boolean;
  showResults: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function LunchPollOptionCard({
  option,
  result,
  totalVotes,
  selected,
  showResults,
  disabled,
  onSelect,
}: Props) {
  const count = result?.count ?? 0;
  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
  const voters = result?.voters ?? [];
  const visual = getPollOptionVisual(option.optionType);
  const Icon = visual.icon;
  const typeLabel = LUNCH_OPTION_TYPE_LABELS[option.optionType] ?? option.optionType;

  return (
    <button
      type="button"
      disabled={disabled && !selected}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={selected ? `${option.label} — your vote` : option.label}
      className={cn(
        "group relative mb-3 box-border w-full rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] duration-200 last:mb-0",
        selected
          ? "border-orange-500 bg-gradient-to-br from-orange-100/90 via-orange-50 to-amber-50/80 shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_6px_24px_rgba(249,115,22,0.18)]"
          : "border-stone-200/90 bg-white hover:border-orange-200 hover:bg-stone-50/40 hover:shadow-[0_4px_16px_rgba(251,146,60,0.08)]",
        disabled && !selected && "cursor-not-allowed opacity-45",
      )}
    >
      <span
        className={cn(
          "absolute bottom-4 left-0 top-4 w-1 rounded-r-full bg-orange-500 transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />

      <span
        className={cn(
          "absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30 transition-opacity duration-200",
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!selected}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>

      <div className="flex items-start gap-3 pl-1 pr-9">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
            selected
              ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25"
              : visual.chipClass,
          )}
        >
          <Icon
            className={cn("h-5 w-5", selected ? "text-white" : visual.iconClass)}
            strokeWidth={2}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-[22px] flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-[15px] font-semibold leading-snug",
                selected ? "font-bold text-orange-950" : "text-stone-900",
              )}
            >
              {option.label}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                selected ? "bg-orange-500 text-white" : "invisible bg-orange-500 text-white",
              )}
              aria-hidden={!selected}
            >
              Your vote
            </span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                selected
                  ? "bg-orange-200/60 text-orange-900"
                  : "bg-stone-100 text-stone-500",
              )}
            >
              {typeLabel}
            </span>
          </div>

          {/* Fixed-height stats row — always reserved when results are shown */}
          <div
            className={cn(
              "mt-2 flex h-6 items-center gap-2",
              !showResults && "invisible",
            )}
            aria-hidden={!showResults}
          >
            <div className="flex h-6 w-[52px] shrink-0 -space-x-1.5">
              {voters.slice(0, 3).map((v) => (
                <span
                  key={v.userId}
                  title={v.userName}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-white"
                  style={{ backgroundColor: avatarColor(v.userName) }}
                >
                  {initials(v.userName)}
                </span>
              ))}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">
              {count} vote{count === 1 ? "" : "s"}
            </span>
          </div>

          {/* Fixed-height progress slot */}
          <div className={cn("mt-2 h-1.5", !showResults && "invisible")} aria-hidden={!showResults}>
            <LunchPollProgressBar percent={pct} selected={selected} />
          </div>
        </div>
      </div>
    </button>
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
