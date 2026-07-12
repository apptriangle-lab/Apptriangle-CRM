import { Fragment } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  CheckSquare,
  DollarSign,
  Receipt,
  Wallet,
  KeyRound,
  Settings,
  Briefcase,
  CalendarDays,
  Clock,
  UtensilsCrossed,
  ClipboardList,
  FolderKanban,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  pageKey: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", pageKey: "dashboard" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks", pageKey: "tasks" },
  { label: "Sales", icon: DollarSign, path: "/sales", pageKey: "sales" },
  { label: "RFQ", icon: ClipboardList, path: "/rfq", pageKey: "rfq" },
  { label: "Leaves", icon: CalendarDays, path: "/leaves", pageKey: "leaves" },
  { label: "Attendance", icon: Clock, path: "/attendance", pageKey: "attendance" },
  { label: "Lunch", icon: UtensilsCrossed, path: "/lunch", pageKey: "lunch" },
  { label: "Expenses", icon: Receipt, path: "/expenses", pageKey: "expenses" },
  { label: "Accounts", icon: Wallet, path: "/accounts", pageKey: "accounts" },
  { label: "Contacts", icon: Users, path: "/contacts", pageKey: "contacts" },
  { label: "Companies", icon: Building2, path: "/companies", pageKey: "companies" },
  { label: "PMS", icon: FolderKanban, path: "/pms", pageKey: "pms" },
];

const adminNavItems: NavItem[] = [
  { label: "HRM", icon: Briefcase, path: "/hr", pageKey: "hr" },
  { label: "Credentials", icon: KeyRound, path: "/credentials", pageKey: "credentials" },
  { label: "Settings", icon: Settings, path: "/settings", pageKey: "settings" },
];

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const sidebarNavTooltipClass = cn(
  "animate-in fade-in-0 zoom-in-95 duration-150",
  "rounded-xl border border-white/12 bg-[#0c1422]/95 px-3 py-2 text-[13px] font-semibold tracking-tight text-slate-100",
  "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.75)] backdrop-blur-md",
);

/** Arrow on the left edge (toward the rail) when `side="right"`. */
const sidebarTooltipArrowClass = "fill-[#0c1422]";

function itemIsActive(pathname: string, item: NavItem): boolean {
  if (item.pageKey === "sales") {
    if (pathname === "/sales" || pathname.startsWith("/sales/")) return true;
    if (pathname.includes("/companies/") && pathname.includes("/sales/")) return true;
    return false;
  }
  if (item.pageKey === "rfq") {
    return pathname === "/rfq" || pathname.startsWith("/rfq/");
  }
  if (item.pageKey === "pms") {
    return pathname === "/pms" || pathname.startsWith("/pms/");
  }
  if (item.path === "/") return pathname === "/" || pathname === "";
  if (pathname === item.path) return true;
  if (pathname.startsWith(item.path + "/")) return true;
  return false;
}

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {
  const { user } = useAuth();
  const { canAccessModule } = useRbac();
  const location = useLocation();
  const navigate = useNavigate();

  const allItems = [...navItems, ...adminNavItems].filter((item) => {
    if (!canAccessModule(item.pageKey)) return false;
    if (item.pageKey === "settings" && user?.role !== "admin") return false;
    return true;
  });

  const navButtonClass = (active: boolean) =>
    cn(
      "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
      active
        ? "bg-indigo-500/15 text-white shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]"
        : "text-slate-200 hover:bg-white/[0.06] hover:text-white",
    );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#050A15] text-slate-100 transition-[width] duration-300 ease-in-out",
          collapsed ? "w-14" : "w-[11.5rem] sm:w-48",
        )}
      >
        {/* Match Login.tsx ambient orbs (scaled for narrow column) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-8 -top-24 h-48 w-48 rounded-full bg-indigo-600/15 blur-[72px] sm:h-56 sm:w-56 sm:blur-[90px]" />
          <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-violet-600/12 blur-[64px] sm:h-52 sm:w-52 sm:blur-[80px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10 px-2 transition-all duration-300 ease-in-out">
            <span
              className={cn(
                "select-none text-center font-bold tracking-tight text-slate-100 transition-all duration-300 ease-in-out",
                collapsed ? "text-[11px] leading-none" : "text-xl",
              )}
            >
              CRM
            </span>
          </div>

          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
            {allItems.map((item) => {
              const active = itemIsActive(location.pathname, item);
              const key = `${item.pageKey}-${item.path}`;
              const navButton = (
                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={cn(navButtonClass(active), collapsed && "justify-center px-2")}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[#5CC8FF]" : "text-slate-100",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {active && !collapsed && (
                    <span className="absolute right-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#5CC8FF] shadow-[0_0_8px_rgba(92,200,255,0.55)]" />
                  )}
                </button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={key} delayDuration={200}>
                    <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                    <TooltipContent side="right" align="center" sideOffset={12} className={sidebarNavTooltipClass}>
                      {item.label}
                      <TooltipArrow width={14} height={7} className={sidebarTooltipArrowClass} />
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <Fragment key={key}>{navButton}</Fragment>;
            })}
          </nav>

          <div className="shrink-0 border-t border-white/10 p-2">
            {collapsed ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onToggleCollapsed}
                    aria-expanded={false}
                    aria-label="Expand sidebar"
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-0 text-slate-200 shadow-none hover:bg-white/[0.08] hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4 rotate-180 transition-transform duration-300 ease-in-out" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" sideOffset={12} className={sidebarNavTooltipClass}>
                  Expand sidebar
                  <TooltipArrow width={14} height={7} className={sidebarTooltipArrowClass} />
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={onToggleCollapsed}
                aria-expanded
                aria-label="Collapse sidebar"
                className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-0 text-slate-200 shadow-none hover:bg-white/[0.08] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4 transition-transform duration-300 ease-in-out" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
