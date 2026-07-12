import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Loader } from "@/components/ui/loader";
import { PmsProjectProvider, usePmsProject } from "@/contexts/PmsProjectContext";
import { PmsSprintProvider } from "@/contexts/PmsSprintContext";
import { PmsTaskViewProvider } from "@/contexts/PmsTaskViewContext";
import { PmsProjectSidebar } from "./PmsProjectSidebar";

function PmsProjectShellInner() {
  const { projectId, project, loading, basePath } = usePmsProject();
  const location = useLocation();
  const isTasksList =
    /\/tasks$/.test(location.pathname) && !location.pathname.includes("/tasks/");
  const isKanban = /\/kanban$/.test(location.pathname);
  const isCalendar = /\/calendar$/.test(location.pathname);
  const isDocuments = /\/documents$/.test(location.pathname);
  const isFullBleed = isTasksList || isKanban || isCalendar || isDocuments;

  if (!projectId) return <Navigate to="/pms" replace />;
  if (location.pathname === basePath || location.pathname === `${basePath}/`) {
    return <Navigate to={`${basePath}/tasks`} replace />;
  }
  if (loading) {
    return (
      <Layout>
        <Loader message="Loading project…" className="py-24" />
      </Layout>
    );
  }
  if (!project) {
    return (
      <Layout>
        <p className="text-muted-foreground py-12 text-center">Project not found or access denied.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <PmsTaskViewProvider mode="project" filterScopeId={projectId}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
          <PmsProjectSidebar />
          <div
            className={
              isFullBleed
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
                : "min-h-0 min-w-0 flex-1 overflow-y-auto bg-background p-4 sm:p-6"
            }
          >
            <Outlet />
          </div>
        </div>
      </PmsTaskViewProvider>
    </Layout>
  );
}

export function PmsProjectShell() {
  return (
    <PmsProjectProvider>
      <PmsSprintProvider>
        <PmsProjectShellInner />
      </PmsSprintProvider>
    </PmsProjectProvider>
  );
}
