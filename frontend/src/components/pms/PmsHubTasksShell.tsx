import { Outlet } from "react-router-dom";
import { PmsTaskViewProvider } from "@/contexts/PmsTaskViewContext";
import { PmsHubTasksFiltersProvider } from "@/contexts/PmsHubTasksFiltersContext";
import { PmsHubTasksDataProvider } from "@/contexts/PmsHubTasksDataContext";
import { PmsHubTasksToolbar } from "@/components/pms/hub-tasks/PmsHubTasksToolbar";

export function PmsHubTasksShell() {
  return (
    <PmsTaskViewProvider mode="my-tasks">
      <PmsHubTasksFiltersProvider>
        <PmsHubTasksDataProvider>
          <PmsHubTasksToolbar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </PmsHubTasksDataProvider>
      </PmsHubTasksFiltersProvider>
    </PmsTaskViewProvider>
  );
}
