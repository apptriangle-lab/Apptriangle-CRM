import { ClipboardList, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttendanceMainTab = "my-history" | "team" | "reconciliation";

const TABS: {
  value: AttendanceMainTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}[] = [
  { value: "my-history", label: "My History", icon: History },
  { value: "team", label: "Team Attendance", icon: Users, adminOnly: true },
  { value: "reconciliation", label: "Reconciliation", icon: ClipboardList },
];

const TAB_ACCENTS: Record<
  AttendanceMainTab,
  { active: string; inactive: string }
> = {
  "my-history": {
    active: "bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-200/90",
    inactive: "text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-900",
  },
  team: {
    active: "bg-sky-50 text-sky-950 shadow-sm ring-1 ring-sky-200/90",
    inactive: "text-slate-600 hover:bg-sky-50/60 hover:text-sky-900",
  },
  reconciliation: {
    active: "bg-violet-50 text-violet-950 shadow-sm ring-1 ring-violet-200/90",
    inactive: "text-slate-600 hover:bg-violet-50/60 hover:text-violet-900",
  },
};

type Props = {
  value: AttendanceMainTab;
  onChange: (value: AttendanceMainTab) => void;
  showTeamTab?: boolean;
};

export function AttendanceMainTabs({ value, onChange, showTeamTab = false }: Props) {
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || showTeamTab);

  return (
    <nav
      aria-label="Attendance views"
      className="inline-flex shrink-0 rounded-lg border border-slate-200/90 bg-slate-100/70 p-1"
    >
      {visibleTabs.map((tab) => {
        const active = value === tab.value;
        const accent = TAB_ACCENTS[tab.value];
        const Icon = tab.icon;
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
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
