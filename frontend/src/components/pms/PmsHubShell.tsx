import { Outlet } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PmsHubTabs } from "@/components/pms/PmsHubTabs";
import {
  PmsHubToolbarProvider,
  usePmsHubToolbar,
} from "@/contexts/PmsHubToolbarContext";

/** Stable height for tabs + optional toolbar so hub tab switches do not shift content. */
const PMS_HUB_HEADER_CLASS = "flex h-[52px] shrink-0 flex-nowrap items-center justify-between gap-3";

function PmsHubHeader() {
  const toolbarCtx = usePmsHubToolbar();

  return (
    <div className={PMS_HUB_HEADER_CLASS}>
      <div className="flex h-full shrink-0 items-center">
        <PmsHubTabs />
      </div>
      <div className="flex h-full min-w-0 flex-1 items-center justify-end overflow-x-auto scrollbar-thinner">
        {toolbarCtx?.toolbar}
      </div>
    </div>
  );
}

function PmsHubLayoutBody() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-4">
      <PmsHubHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

export function PmsHubShell() {
  return (
    <PmsHubToolbarProvider>
      <Layout>
        <PmsHubLayoutBody />
      </Layout>
    </PmsHubToolbarProvider>
  );
}
