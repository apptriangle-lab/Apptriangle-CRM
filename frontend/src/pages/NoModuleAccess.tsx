import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { firstAllowedPath } from "@/lib/rbacPaths";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  LogOut,
  RefreshCw,
  ShieldOff,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  {
    step: "1",
    title: "Contact your administrator",
    detail: "Ask them to assign you at least one module in RBAC.",
  },
  {
    step: "2",
    title: "Refresh or sign in again",
    detail: "Once assigned, reload this page to enter your workspace.",
  },
] as const;

export default function NoModuleAccess() {
  const { user, logout } = useAuth();
  const { refresh } = useRbac();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const keys = await refresh({ silent: true });
      if (keys.size > 0) {
        toast.success("Access granted — welcome to your workspace.");
        navigate(firstAllowedPath(keys), { replace: true });
        return;
      }
      toast.message("Still no module access", {
        description: "Your administrator may not have finished assigning permissions yet.",
      });
    } catch {
      toast.error("Could not refresh access. Try signing in again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout>
      <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-lg"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
                <div className="flex flex-col items-center text-center">
                  <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-sm">
                    <ShieldOff className="h-7 w-7 text-white" strokeWidth={1.75} />
                  </span>

                  <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f8f9fb] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <Sparkles className="h-3 w-3" />
                    Workspace access
                  </p>

                  <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    No module access yet
                  </h1>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500 sm:text-sm">
                    Your account is signed in, but no application modules are assigned. An
                    administrator needs to enable access before you can use CRM.
                  </p>
                </div>

                {user ? (
                  <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f9fb] px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                      Pending
                    </span>
                  </div>
                ) : null}

                <div className="mt-6 space-y-2.5">
                  {STEPS.map((item) => (
                    <div
                      key={item.step}
                      className="flex gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                        {item.step}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className={cn(
                      "h-9 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800",
                      refreshing && "opacity-80",
                    )}
                  >
                    <RefreshCw
                      className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")}
                    />
                    {refreshing ? "Checking access…" : "Refresh access"}
                    {!refreshing ? <ArrowRight className="ml-1.5 h-4 w-4 opacity-80" /> : null}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={refreshing}
                    className="h-9 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] font-medium text-slate-400">
              CRM · secure workspace access
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
