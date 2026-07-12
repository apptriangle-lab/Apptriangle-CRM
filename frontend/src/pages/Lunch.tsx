import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { LunchRealtimeProvider } from "@/contexts/LunchRealtimeProvider";
import { LunchAdminSidebar } from "@/components/lunch/LunchAdminSidebar";
import {
  resolveLunchMainTab,
  type LunchMainTab,
} from "@/components/lunch/LunchMainTabs";
import { LunchUserHomePanel } from "@/components/lunch/LunchUserHomePanel";
import { LunchPollsAdminPanel } from "@/components/lunch/LunchPollsAdminPanel";
import { LunchOrderSummaryPanel } from "@/components/lunch/LunchOrderSummaryPanel";
import { LunchEmployeesAdminPanel } from "@/components/lunch/LunchEmployeesAdminPanel";
import { LunchSettingsPanel } from "@/components/lunch/LunchSettingsPanel";
import { LUNCH_USER_PAGE_BG } from "@/components/lunch/lunchConstants";
import { cn } from "@/lib/utils";

export default function Lunch() {
  const { isPageScopeAdmin } = useRbac();
  const isAdmin = isPageScopeAdmin("lunch");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveLunchMainTab(searchParams.get("tab"));
  const isOrderSummary = tab === "order-summary";
  const isEmployees = tab === "employees";
  const isFixedHeightTab = isOrderSummary || isEmployees;

  const setTab = (value: LunchMainTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <Layout>
      <LunchRealtimeProvider>
      <div
        className={cn(
          "-m-6 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-[Inter,system-ui,sans-serif]",
          LUNCH_USER_PAGE_BG,
        )}
      >
        {isAdmin ? (
          <div className="flex min-h-0 w-full flex-1 overflow-hidden">
            <LunchAdminSidebar value={tab} onChange={setTab} />
            <div
              className={cn(
                "min-w-0 flex-1 min-h-0",
                isFixedHeightTab
                  ? "flex flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
                  : "overflow-y-auto overscroll-contain px-4 py-6 scrollbar-thinner sm:px-6 sm:py-8 lg:px-8",
              )}
            >
              {tab === "my-lunch" && <LunchUserHomePanel adminLayout />}
              {tab === "polls" && <LunchPollsAdminPanel />}
              {tab === "order-summary" && <LunchOrderSummaryPanel />}
              {tab === "employees" && <LunchEmployeesAdminPanel />}
              {tab === "settings" && <LunchSettingsPanel />}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 scrollbar-thinner sm:px-6 sm:py-8 lg:px-8">
            <LunchUserHomePanel />
          </div>
        )}
      </div>
      </LunchRealtimeProvider>
    </Layout>
  );
}
