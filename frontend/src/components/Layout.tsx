import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useAppContext } from "@/contexts/AppContext";
import { firstAllowedPath, pathnameToPageKey } from "@/lib/rbacPaths";
import { pathnameToPageTitle } from "@/lib/pageTitles";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppAccessLoadingShell } from "./AppAccessLoadingShell";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Persisted so the sidebar stays collapsed across navigations (each page mounts its own Layout). */
const SIDEBAR_COLLAPSED_KEY = "crm_sidebar_collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { hrInfo } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed());

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  if (!user) return <Navigate to="/login" replace />;

  const { loading: rbacLoading, canAccessModule, navPageKeys } = useRbac();
  const pageKey = pathnameToPageKey(location.pathname);

  if (rbacLoading) {
    return <AppAccessLoadingShell />;
  }

  if (pageKey !== null && !canAccessModule(pageKey)) {
    return <Navigate to={firstAllowedPath(navPageKeys)} replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAttendancePage = location.pathname === "/attendance";
  const isLunchPage = location.pathname === "/lunch";
  const isCredentialsPage = location.pathname === "/credentials";
  /** All RFQ routes: same flush main (no p-6 gray frame), white bg. */
  const isRfqModulePage =
    location.pathname === "/rfq" || location.pathname.startsWith("/rfq/");
  const isSalesDetailsPage = location.pathname.startsWith("/sales/") && location.pathname !== "/sales";
  const isPmsProjectWorkspace =
    location.pathname.startsWith("/pms/projects/") && location.pathname.length > "/pms/projects/".length;
  const isPmsHubTasksPage =
    location.pathname === "/pms/tasks" || location.pathname.startsWith("/pms/tasks/");
  const isPmsHubPage =
    location.pathname === "/pms" ||
    location.pathname === "/pms/resource" ||
    location.pathname === "/pms/dashboard" ||
    isPmsHubTasksPage;
  const isTasksModulePage =
    location.pathname === "/tasks" || /^\/tasks\/[^/]+$/.test(location.pathname);
  const isLeavesPage = location.pathname === "/leaves";
  const isNoAccessPage = location.pathname === "/no-access";
  const isHrEmployeeDetailsPage = /^\/hr\/[^/]+$/.test(location.pathname);
  const isFullHeightMain =
    isAttendancePage ||
    isLunchPage ||
    isCredentialsPage ||
    isRfqModulePage ||
    isSalesDetailsPage ||
    isPmsProjectWorkspace ||
    isPmsHubPage ||
    isTasksModulePage ||
    isLeavesPage ||
    isNoAccessPage ||
    isHrEmployeeDetailsPage;
  /** PMS project: main area is flex row (project rail + content), not scrollable as a whole */
  const isPmsProjectMain = isPmsProjectWorkspace;

  return (
    <div className={cn("flex w-full", isFullHeightMain ? "h-screen overflow-hidden" : "min-h-screen")}>
      <AppSidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((c) => !c)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-white/10 bg-[#050A15] px-4 text-slate-100 backdrop-blur-xl sm:px-6">
          {/* Ambient orbs — same vocabulary as Login / sidebar, scaled for the bar */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
            <div className="absolute -right-8 -top-20 h-44 w-44 rounded-full bg-indigo-600/12 blur-[64px] sm:h-52 sm:w-52 sm:blur-[72px]" />
            <div className="absolute -bottom-24 left-[12%] h-40 w-40 rounded-full bg-violet-600/10 blur-[56px] sm:h-48 sm:w-48" />
            <div className="absolute right-1/4 top-0 h-20 w-36 -translate-y-1/2 rounded-full bg-[#29B3FF]/[0.08] blur-[36px]" />
          </div>
          {/* Subtle premium gradient: deep navy → slightly lighter slate-blue */}
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#1e293b]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/[0.05] via-transparent to-transparent"
            aria-hidden
          />
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              title="Back to previous page"
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] text-slate-100 shadow-none hover:bg-white/[0.1] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 overflow-hidden pr-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={location.pathname}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  className="truncate text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl"
                >
                  {pathnameToPageTitle(location.pathname)}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-11 gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 text-slate-100 shadow-none hover:bg-white/[0.1] hover:text-white"
              >
                <Avatar className="h-8 w-8 rounded-lg border border-white/15">
                  {hrInfo?.profilePicture ? (
                    <AvatarImage src={hrInfo.profilePicture} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="rounded-lg bg-indigo-500/25 text-[10px] font-bold text-slate-100">
                    {getInitials(user?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[11rem] truncate text-sm font-semibold text-slate-100 sm:inline">
                  {user?.name ?? "Account"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-60 rounded-2xl border border-[#0C2242]/10 bg-white/95 p-1.5 shadow-[0_14px_35px_-20px_rgba(12,34,66,0.55)]"
            >
              <DropdownMenuLabel className="mb-1 rounded-xl border border-[#0C2242]/10 bg-[linear-gradient(145deg,rgba(12,34,66,0.04)_0%,rgba(41,179,255,0.08)_100%)] px-3 py-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#0C2242] leading-none">
                    {user?.name}
                  </p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-70">
                    {user?.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => navigate("/profile")}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[#0C2242] focus:bg-[#D7EFFF]/60 focus:text-[#0C2242] transition-colors"
              >
                <UserIcon className="h-4 w-4" />
                <span className="text-xs font-semibold">Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              <DropdownMenuItem
                onSelect={() => handleLogout()}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-xs font-semibold">Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        <main
          className={cn(
            "flex-1 animate-fade-in",
            isRfqModulePage && "bg-white p-0 dark:bg-slate-950",
            !isRfqModulePage && !isPmsProjectMain && !isHrEmployeeDetailsPage && "p-6",
            isFullHeightMain &&
              (isRfqModulePage
                ? "flex min-h-0 flex-1 flex-col overflow-y-auto"
                : isPmsProjectMain
                  ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"),
            !isFullHeightMain && "overflow-auto [scrollbar-gutter:stable]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
