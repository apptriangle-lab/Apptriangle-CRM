import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  CheckSquare,
  LayoutGrid,
  CalendarDays,
  Settings,
  ChevronLeft,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";

const PMS_SIDEBAR_COLLAPSED_KEY = "crm_pms_project_sidebar_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(PMS_SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

type ProjectNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  suffix: string;
  end?: boolean;
  adminOnly?: boolean;
};

const projectNavItems: ProjectNavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, suffix: "/dashboard", end: true },
  { label: "Tasks", icon: CheckSquare, suffix: "/tasks", end: true },
  { label: "Kanban", icon: LayoutGrid, suffix: "/kanban", end: true },
  { label: "Calendar", icon: CalendarDays, suffix: "/calendar", end: true },
  { label: "Documents", icon: FileText, suffix: "/documents", end: true },
  { label: "Settings", icon: Settings, suffix: "/settings", end: true },
];

const tooltipClass = cn(
  "rounded-xl border border-violet-400/20 bg-[#1a1030]/95 px-3 py-2 text-[13px] font-semibold text-slate-100",
  "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.75)] backdrop-blur-md",
);

const navButtonClass = (active: boolean, collapsed: boolean) =>
  cn(
    "relative w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
    active
      ? "bg-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]"
      : "text-slate-200 hover:bg-white/[0.06] hover:text-white",
  );

export function PmsProjectSidebar() {
  const { project, basePath } = usePmsProject();
  const { perms } = usePmsPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(PMS_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const isActive = (suffix: string, end?: boolean) => {
    const path = `${basePath}${suffix}`;
    if (end && suffix === "") return location.pathname === basePath;
    if (end) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const wrapTooltip = (label: string, node: ReactNode) => {
    if (!collapsed) return node;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" align="center" sideOffset={12} className={tooltipClass}>
          {label}
          <TooltipArrow className="fill-[#1a1030]" />
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-in-out",
        "border-r border-violet-500/25 bg-[#120e1f] text-slate-100",
        "shadow-[inset_4px_0_0_0_rgba(167,139,250,0.4)]",
        collapsed ? "w-14" : "w-48",
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-8 -top-24 h-48 w-48 rounded-full bg-violet-600/14 blur-[80px]" />
        <div className="absolute -bottom-20 -left-8 h-44 w-44 rounded-full bg-fuchsia-600/10 blur-[72px]" />
        <div className="absolute right-0 top-2/3 h-28 w-28 rounded-full bg-purple-500/10 blur-[56px]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-violet-500/[0.07] via-transparent to-fuchsia-600/[0.05]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className={cn("shrink-0 border-b border-violet-500/20 py-3", collapsed ? "px-1.5" : "px-2")}>
          {wrapTooltip(
            "All projects",
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "rounded-lg border border-violet-400/10 bg-violet-500/[0.06] text-slate-200 hover:bg-violet-500/10 hover:text-white",
                collapsed ? "h-10 w-full justify-center px-0" : "h-9 w-full justify-start gap-2 px-2.5",
              )}
              onClick={() => navigate("/pms")}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-violet-300" />
              {!collapsed && <span className="truncate text-xs font-semibold">All projects</span>}
            </Button>,
          )}

          {project && !collapsed && (
            <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-2.5 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                This project
              </span>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100" title={project.title}>
                {project.title}
              </p>
              <p className="truncate font-mono text-[10px] text-violet-200/50">{project.projectCode}</p>
            </div>
          )}
        </div>

        <nav
          className={cn(
            "min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-3",
            collapsed ? "px-1.5" : "px-2",
          )}
          aria-label="Project sections"
        >
          {projectNavItems.map((item) => {
            if (
              item.suffix === "/settings" &&
              !perms.canManageSettings &&
              !perms.canCreateProject &&
              !perms.canInviteMember &&
              !perms.isPmsAdmin
            )
              return null;
            const to = `${basePath}${item.suffix}`;
            const active = isActive(item.suffix, item.end);
            const btn = (
              <button
                type="button"
                onClick={() => navigate(to)}
                className={navButtonClass(active, collapsed)}
              >
                <item.icon
                  className={cn("h-4 w-4 shrink-0", active ? "text-violet-300" : "text-slate-100")}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {active && !collapsed && (
                  <span
                    className="absolute right-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.65)]"
                    aria-hidden
                  />
                )}
              </button>
            );
            return <div key={to}>{wrapTooltip(item.label, btn)}</div>;
          })}
        </nav>

        <div className={cn("shrink-0 border-t border-violet-500/20 p-2", collapsed && "px-1.5")}>
          {collapsed ? (
            wrapTooltip(
              "Expand project menu",
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCollapsed(false)}
                aria-expanded={false}
                aria-label="Expand project menu"
                className="flex h-10 w-full items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/[0.06] px-0 text-slate-200 hover:bg-violet-500/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4 rotate-180 transition-transform duration-300" />
              </Button>,
            )
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCollapsed(true)}
              aria-expanded
              aria-label="Collapse project menu"
              className="flex h-10 w-full items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/[0.06] px-0 text-slate-200 hover:bg-violet-500/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 transition-transform duration-300" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
