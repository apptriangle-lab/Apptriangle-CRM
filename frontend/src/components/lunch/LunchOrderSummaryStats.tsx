import type { ReactNode } from "react";
import { Building2, Salad, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LunchOptionType, LunchPollSummaryDto } from "@/lib/lunchApi";
import { lunchOrderTypePillClass } from "@/components/lunch/lunchOrderSummaryStyles";

type VoterRow = LunchPollSummaryDto["voters"][number];

type StatCardProps = {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string | number;
  hint?: string;
  voters: VoterRow[];
  tooltipTitle: string;
};

function VoterChoiceBadge({ voter }: { voter: VoterRow }) {
  const label = voter.optionLabel?.trim() || voter.optionType;
  return (
    <span
      className={cn(
        "inline-flex max-w-[11rem] shrink-0 items-center truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1 ring-inset",
        lunchOrderTypePillClass(voter.optionType),
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
  hint,
  voters,
  tooltipTitle,
}: StatCardProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className="cursor-default rounded-2xl border border-orange-100/80 bg-gradient-to-br from-white to-orange-50/30 p-4 shadow-[0_2px_12px_rgba(251,146,60,0.06)] outline-none transition-shadow hover:shadow-[0_4px_16px_rgba(251,146,60,0.14)] focus-visible:ring-2 focus-visible:ring-orange-200"
        >
          <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", iconClass)}>
            {icon}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-stone-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="z-[10050] w-[min(100vw-2rem,400px)] max-w-none overflow-hidden rounded-xl border border-orange-100 bg-white p-0 text-stone-800 shadow-[0_8px_24px_rgba(251,146,60,0.15)]"
      >
        <div className="border-b border-orange-50 bg-gradient-to-r from-orange-50/80 to-amber-50/40 px-4 py-2.5">
          <p className="text-xs font-semibold text-orange-900">{tooltipTitle}</p>
          <p className="text-[11px] text-stone-500">
            {voters.length} {voters.length === 1 ? "person" : "people"}
          </p>
        </div>
        {voters.length === 0 ? (
          <p className="px-4 py-3 text-xs text-stone-500">No votes in this category yet.</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto py-1.5 scrollbar-thinner">
            {voters.map((v) => (
              <li
                key={`${v.userId}-${v.optionId}`}
                className="flex min-w-0 items-center gap-3 px-4 py-2 text-sm text-stone-700"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(v.userName) }}
                >
                  {initials(v.userName)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{v.userName}</span>
                <VoterChoiceBadge voter={v} />
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

type Props = {
  summary: LunchPollSummaryDto;
};

function votersForType(voters: VoterRow[], optionType: LunchOptionType): VoterRow[] {
  return voters.filter((v) => v.optionType === optionType);
}

export function LunchOrderSummaryStats({ summary }: Props) {
  const { voters, options } = summary;

  const officeVoters = votersForType(voters, "office");
  const personalVoters = votersForType(voters, "personal");

  const personalCount = options
    .filter((o) => o.optionType === "personal")
    .reduce((sum, o) => sum + o.count, 0);
  const offCount = options
    .filter((o) => o.optionType === "off")
    .reduce((sum, o) => sum + o.count, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={<Building2 className="h-4 w-4 text-orange-600" />}
          iconClass="bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600 ring-1 ring-inset ring-orange-200/60"
          label="Office orders"
          value={summary.officeOrderCount}
          hint="Meals to place with vendor"
          voters={officeVoters}
          tooltipTitle="Office menu voters"
        />
        <StatCard
          icon={<Salad className="h-4 w-4 text-emerald-600" />}
          iconClass="bg-emerald-50 ring-1 ring-inset ring-emerald-100"
          label="Personal"
          value={personalCount}
          hint="Bringing own lunch"
          voters={personalVoters}
          tooltipTitle="Personal lunch voters"
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-amber-700" />}
          iconClass="bg-amber-50 ring-1 ring-inset ring-amber-100"
          label="Total votes"
          value={summary.totalVotes}
          hint={offCount > 0 ? `${offCount} off / absent` : undefined}
          voters={voters}
          tooltipTitle="All voters"
        />
      </div>
    </TooltipProvider>
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
