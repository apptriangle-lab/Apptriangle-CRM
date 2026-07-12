import { cn } from "@/lib/utils";
import type { CrmTasksTab } from "@/utils/crmTasksListFilters";

const TABS: { value: CrmTasksTab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const TAB_ACCENTS: Record<
  CrmTasksTab,
  { active: string; inactive: string; countActive: string; countInactive: string }
> = {
  pending: {
    active: "bg-amber-50 text-amber-950 shadow-sm ring-1 ring-amber-200/90",
    inactive: "text-slate-600 hover:bg-amber-50/60 hover:text-amber-900",
    countActive: "bg-amber-100 text-amber-800",
    countInactive: "text-slate-400",
  },
  completed: {
    active: "bg-teal-50 text-teal-950 shadow-sm ring-1 ring-teal-200/90",
    inactive: "text-slate-600 hover:bg-teal-50/60 hover:text-teal-900",
    countActive: "bg-teal-100 text-teal-800",
    countInactive: "text-slate-400",
  },
  all: {
    active: "bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-200/90",
    inactive: "text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-900",
    countActive: "bg-indigo-100 text-indigo-800",
    countInactive: "text-slate-400",
  },
};

type Props = {
  value: CrmTasksTab;
  onChange: (value: CrmTasksTab) => void;
  counts?: Partial<Record<CrmTasksTab, number>>;
};

export function CrmTasksListTabs({ value, onChange, counts }: Props) {
  return (
    <nav
      aria-label="Task views"
      className="inline-flex shrink-0 rounded-lg border border-slate-200/90 bg-slate-100/70 p-1"
    >
      {TABS.map((tab) => {
        const active = value === tab.value;
        const count = counts?.[tab.value];
        const accent = TAB_ACCENTS[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all",
              active ? accent.active : accent.inactive,
            )}
          >
            {tab.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? accent.countActive : accent.countInactive,
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
