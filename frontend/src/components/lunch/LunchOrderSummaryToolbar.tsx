import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, Check, ChevronDown, Search, UtensilsCrossed } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { LunchOrderSummaryExportButton } from "@/components/lunch/LunchOrderSummaryExportButton";
import { cn } from "@/lib/utils";
import type { LunchPollDto, LunchPollSummaryDto } from "@/lib/lunchApi";
import { lunchPollStatusPillClass } from "@/components/lunch/lunchPollsListStyles";
import { exportLunchOrderSummaryPdf } from "@/components/lunch/lunchOrderPdf";

type Props = {
  polls: LunchPollDto[];
  selectedId: string;
  onSelectPoll: (id: string) => void;
  summary: LunchPollSummaryDto | null;
  search: string;
  onSearchChange: (value: string) => void;
};

function PollMenuItem({
  poll,
  selected,
  onSelect,
}: {
  poll: LunchPollDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const dateLabel = format(new Date(poll.date + "T12:00:00"), "EEE, MMM d, yyyy");

  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-orange-50 data-[highlighted]:to-amber-50",
        selected && "bg-orange-50/80 text-orange-950",
      )}
      onClick={onSelect}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200/80 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-600">
        <UtensilsCrossed className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{dateLabel}</p>
        <p className="truncate text-xs text-slate-500">{poll.title}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
          lunchPollStatusPillClass(poll.status),
        )}
      >
        {poll.status}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-orange-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

export function LunchOrderSummaryToolbar({
  polls,
  selectedId,
  onSelectPoll,
  summary,
  search,
  onSearchChange,
}: Props) {
  const [pollMenuOpen, setPollMenuOpen] = useState(false);
  const selectedPoll = polls.find((p) => p.id === selectedId);

  const triggerLabel = useMemo(() => {
    if (!selectedPoll) return "Select poll";
    const dateLabel = format(new Date(selectedPoll.date + "T12:00:00"), "MMM d, yyyy");
    return `${dateLabel} · ${selectedPoll.title}`;
  }, [selectedPoll]);

  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Order summary</h1>
        </div>
        <p className="mt-0.5 text-[13px] text-stone-500">
          Review votes, office meal counts, and export for the vendor.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:w-56 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search employees…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "h-9 w-full rounded-xl border-stone-200 bg-white pl-9 text-[13px] shadow-sm",
              search.trim() && "border-orange-200 bg-orange-50/40",
            )}
          />
        </div>

        <DropdownMenu open={pollMenuOpen} onOpenChange={setPollMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 max-w-[min(100%,280px)] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/30"
            >
              <Calendar className="h-4 w-4 shrink-0 text-orange-600" />
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "max-h-[min(360px,55vh)] w-80 overflow-y-auto rounded-xl border-orange-100 p-1.5 shadow-lg scrollbar-thinner",
              PMS_ASSIGNEE_MENU_OVERRIDES,
            )}
          >
            {polls.map((poll) => (
              <PollMenuItem
                key={poll.id}
                poll={poll}
                selected={poll.id === selectedId}
                onSelect={() => {
                  onSelectPoll(poll.id);
                  setPollMenuOpen(false);
                }}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {summary ? (
          <LunchOrderSummaryExportButton onClick={() => exportLunchOrderSummaryPdf(summary)} />
        ) : null}
      </div>
    </div>
  );
}
