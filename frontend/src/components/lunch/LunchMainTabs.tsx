import { Fragment } from "react";
import {
  ClipboardList,
  HandPlatter,
  Settings2,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type LunchMainTab =
  | "my-lunch"
  | "polls"
  | "order-summary"
  | "employees"
  | "settings";

const ADMIN_TABS: { value: LunchMainTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "my-lunch", label: "My Lunch", icon: HandPlatter },
  { value: "polls", label: "Polls", icon: ClipboardList },
  { value: "order-summary", label: "Order Summary", icon: UtensilsCrossed },
  { value: "employees", label: "Employees", icon: Users },
  { value: "settings", label: "Settings", icon: Settings2 },
];

export const LUNCH_MAIN_TAB_DEFAULT: LunchMainTab = "my-lunch";

const LUNCH_MAIN_TAB_VALUES = new Set<string>(ADMIN_TABS.map((t) => t.value));

export function isLunchMainTab(value: string | null | undefined): value is LunchMainTab {
  return value != null && LUNCH_MAIN_TAB_VALUES.has(value);
}

export function resolveLunchMainTab(value: string | null | undefined): LunchMainTab {
  return isLunchMainTab(value) ? value : LUNCH_MAIN_TAB_DEFAULT;
}

const TAB_ACCENTS: Record<LunchMainTab, { active: string; inactive: string }> = {
  "my-lunch": {
    active: "bg-emerald-50 text-emerald-950 border-emerald-200",
    inactive: "border-transparent text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-900",
  },
  polls: {
    active: "bg-orange-50 text-orange-950 border-orange-200",
    inactive: "border-transparent text-slate-600 hover:bg-orange-50/50 hover:text-orange-900",
  },
  "order-summary": {
    active: "bg-orange-50 text-orange-950 border-orange-200",
    inactive: "border-transparent text-slate-600 hover:bg-orange-50/50 hover:text-orange-900",
  },
  employees: {
    active: "bg-orange-50 text-orange-950 border-orange-200",
    inactive: "border-transparent text-slate-600 hover:bg-orange-50/50 hover:text-orange-900",
  },
  settings: {
    active: "bg-orange-50 text-orange-950 border-orange-200",
    inactive: "border-transparent text-slate-600 hover:bg-orange-50/50 hover:text-orange-900",
  },
};

const sidebarTooltipClass = cn(
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 shadow-lg",
);

type Props = {
  value: LunchMainTab;
  onChange: (value: LunchMainTab) => void;
  orientation?: "horizontal" | "vertical";
  collapsed?: boolean;
};

/** Admin-only tab navigation. Standard users get a single combined page. */
export function LunchMainTabs({
  value,
  onChange,
  orientation = "horizontal",
  collapsed = false,
}: Props) {
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label="Lunch admin views"
      className={cn(
        isVertical
          ? cn(
              "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5 py-3",
            )
          : "inline-flex max-w-full shrink-0 flex-wrap gap-1 rounded-lg border border-slate-200/90 bg-slate-100/70 p-1",
      )}
    >
      {ADMIN_TABS.map((tab) => {
        const active = value === tab.value;
        const accent = TAB_ACCENTS[tab.value];
        const Icon = tab.icon;
        const button = (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center text-[13px] font-medium transition-all",
              isVertical
                ? cn(
                    "w-full min-w-0 border-l-2",
                    collapsed ? "justify-center border-l-0 px-0 py-2.5" : "gap-2 px-3 py-2.5 text-left",
                    active ? accent.active : accent.inactive,
                    collapsed && active && "rounded-lg ring-1 ring-inset ring-slate-200",
                  )
                : cn(
                    "gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5",
                    active ? cn(accent.active, "shadow-sm ring-1 ring-inset") : accent.inactive,
                  ),
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {!(isVertical && collapsed) && <span className="truncate">{tab.label}</span>}
          </button>
        );

        if (isVertical && collapsed) {
          return (
            <Tooltip key={tab.value} delayDuration={200}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right" align="center" sideOffset={12} className={sidebarTooltipClass}>
                {tab.label}
                <TooltipArrow className="fill-white" />
              </TooltipContent>
            </Tooltip>
          );
        }

        return <Fragment key={tab.value}>{button}</Fragment>;
      })}
    </nav>
  );
}
