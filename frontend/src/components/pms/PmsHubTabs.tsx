import { NavLink } from "react-router-dom";
import { CheckSquare, FolderKanban, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { PMS_HUB_TASKS_BASE_PATH } from "@/lib/pmsMyTasksScope";

const ALL_TABS = [
  {
    label: "Dashboard",
    to: "/pms/dashboard",
    icon: LayoutDashboard,
    end: true,
    permission: "canViewHubDashboard" as const,
  },
  { label: "Projects", to: "/pms", icon: FolderKanban, end: true, permission: null },
  {
    label: "Resource",
    to: "/pms/resource",
    icon: Users,
    end: false,
    permission: "canViewResource" as const,
  },
  {
    label: "Tasks",
    to: PMS_HUB_TASKS_BASE_PATH,
    icon: CheckSquare,
    end: false,
    permission: null,
  },
] as const;

export function PmsHubTabs() {
  const { perms, loading } = usePmsPermissions();

  const tabs = ALL_TABS.filter(
    (tab) => !tab.permission || perms[tab.permission],
  );

  if (loading) {
    return null;
  }

  return (
    <nav
      aria-label="PMS sections"
      className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/20 p-1.5"
    >
      {tabs.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0 opacity-80" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
