import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  MapPinOff,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useRbac } from "@/contexts/RbacContext";
import { firstAllowedPath } from "@/lib/rbacPaths";
import { cn } from "@/lib/utils";

const QUICK_DESTINATIONS: { label: string; path: string; pageKey: string; icon: LucideIcon }[] = [
  { label: "Dashboard", path: "/", pageKey: "dashboard", icon: LayoutDashboard },
  { label: "Tasks", path: "/tasks", pageKey: "tasks", icon: CheckSquare },
  { label: "PMS", path: "/pms", pageKey: "pms", icon: FolderKanban },
];

function PathIllustration({ path }: { path: string }) {
  const preview = path.length > 28 ? `${path.slice(0, 26)}…` : path;
  return (
    <div className="relative mx-auto mb-6 h-[132px] w-full max-w-[280px]">
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-[#f8f9fb] to-slate-100 shadow-sm"
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="ml-auto h-5 w-24 rounded-md bg-white/80 ring-1 ring-slate-200/80" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300/90 bg-white/70 px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-[11px] font-medium text-slate-400">{preview}</span>
          </div>
          <div className="flex gap-2">
            <span className="h-2 flex-1 rounded-full bg-slate-200/70" />
            <span className="h-2 w-10 rounded-full bg-slate-200/50" />
          </div>
        </div>
        <div className="flex justify-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md ring-4 ring-white/80">
            <MapPinOff className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </div>
  );
}

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navPageKeys } = useRbac();

  const homePath = useMemo(() => firstAllowedPath(navPageKeys), [navPageKeys]);

  const shortcuts = useMemo(
    () => QUICK_DESTINATIONS.filter((item) => navPageKeys.has(item.pageKey)).slice(0, 3),
    [navPageKeys],
  );

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const displayPath = location.pathname || "/";

  return (
    <Layout>
      <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.18) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-xl"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="px-6 pb-7 pt-8 sm:px-9 sm:pb-8 sm:pt-9">
                <div className="text-center">
                  <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f8f9fb] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <span className="font-mono text-[10px] text-slate-500">404</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                    Page not found
                  </p>

                  <PathIllustration path={displayPath} />

                  <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    We couldn&apos;t find that page
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500 sm:text-sm">
                    The link may be broken, the page may have moved, or you might not have the
                    correct URL. Head back to your workspace to keep working.
                  </p>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-[#f8f9fb] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Requested path
                  </p>
                  <p className="mt-1 truncate font-mono text-[13px] font-medium text-slate-700">
                    {displayPath}
                  </p>
                </div>

                {shortcuts.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Quick shortcuts
                    </p>
                    <div
                      className={cn(
                        "grid gap-2",
                        shortcuts.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3",
                      )}
                    >
                      {shortcuts.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.pageKey}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left transition-all hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition-transform group-hover:scale-[1.03]">
                              <Icon className="h-4 w-4" strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold text-slate-900">
                                {item.label}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {item.path === "/" ? "Home" : item.path}
                              </span>
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button
                    type="button"
                    onClick={() => navigate(homePath, { replace: true })}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to workspace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="h-9 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                  >
                    Go back
                  </Button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] font-medium text-slate-400">
              CRM · workspace navigation
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
