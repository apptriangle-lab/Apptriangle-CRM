import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PmsCreateTaskModal } from "@/components/pms/PmsCreateTaskModal";
import { PmsPickProjectDialog } from "@/components/pms/PmsPickProjectDialog";
import { PmsHubTasksProjectFilterDropdown } from "@/components/pms/hub-tasks/PmsHubTasksProjectFilterDropdown";
import { PmsHubTasksAssigneeFilterDropdown } from "@/components/pms/hub-tasks/PmsHubTasksAssigneeFilterDropdown";
import {
  CrmCompanyFilterDropdown,
} from "@/components/crm/CrmCompanyFilterDropdown";
import { CrmTasksStatusFilterDropdown } from "@/components/tasks/CrmTasksStatusFilterDropdown";
import { usePmsHubToolbarSlot } from "@/contexts/PmsHubToolbarContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsHubTasksFilters } from "@/contexts/PmsHubTasksFiltersContext";
import { usePmsHubTasksData } from "@/contexts/PmsHubTasksDataContext";
import { canViewAllHubTasks } from "@/lib/pmsHubTasksAccess";
import { getHubProjectFilterAllSubtitle } from "@/components/pms/hub-tasks/pmsHubTasksApiParams";
import type { PmsProjectDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

/** Registers list/kanban/calendar + search + status + add task in the hub header left slot. */
export function PmsHubTasksToolbar() {
  const { notifyTaskUpdated } = usePmsTaskModal();
  const { perms } = usePmsPermissions();
  const { pmsTaskStatuses } = useStatusConfig();
  const { search, setSearch, projectFilter, setProjectFilter, statusFilter, setStatusFilter, assigneeFilter, setAssigneeFilter, companyFilter, setCompanyFilter } =
    usePmsHubTasksFilters();
  const { projects, users, companies } = usePmsHubTasksData();

  const canViewAllUsers = canViewAllHubTasks(perms);

  const [pickProjectOpen, setPickProjectOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createProject, setCreateProject] = useState<PmsProjectDto | null>(null);
  const prevAssigneeFilterRef = useRef(assigneeFilter);
  const prevCompanyFilterRef = useRef(companyFilter);

  const handleAddTask = useCallback(() => {
    setPickProjectOpen(true);
  }, []);

  const handleProjectPicked = useCallback((project: PmsProjectDto) => {
    setCreateProject(project);
    setPickProjectOpen(false);
    setCreateModalOpen(true);
  }, []);

  useEffect(() => {
    if (prevAssigneeFilterRef.current === assigneeFilter) return;
    prevAssigneeFilterRef.current = assigneeFilter;
    setProjectFilter("all");
  }, [assigneeFilter, setProjectFilter]);

  useEffect(() => {
    if (canViewAllUsers) return;
    if (assigneeFilter !== "me") setAssigneeFilter("me");
  }, [canViewAllUsers, assigneeFilter, setAssigneeFilter]);

  useEffect(() => {
    if (canViewAllUsers) return;
    if (companyFilter !== "all") setCompanyFilter("all");
  }, [canViewAllUsers, companyFilter, setCompanyFilter]);

  useEffect(() => {
    if (prevCompanyFilterRef.current === companyFilter) return;
    prevCompanyFilterRef.current = companyFilter;
    setProjectFilter("all");
  }, [companyFilter, setProjectFilter]);

  useEffect(() => {
    if (projectFilter === "all" || projects.length === 0) return;
    if (!projects.some((project) => project.id === projectFilter)) {
      setProjectFilter("all");
    }
  }, [projectFilter, projects, setProjectFilter]);

  const userOptions = useMemo(
    () =>
      [...users]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })),
    [users],
  );

  const projectFilterSubtitle = useMemo(
    () => getHubProjectFilterAllSubtitle(assigneeFilter),
    [assigneeFilter],
  );

  const projectOptions = useMemo(
    () =>
      [...projects]
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((project) => ({
          id: project.id,
          title: project.title,
          projectCode: project.projectCode,
        })),
    [projects],
  );

  const toolbar = useMemo(
    () => (
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        <div className="relative w-72 min-w-[200px] max-w-sm shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
              search.trim() && "border-indigo-200 bg-indigo-50/40",
            )}
          />
        </div>

        {canViewAllUsers ? (
          <PmsHubTasksAssigneeFilterDropdown
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            users={userOptions}
          />
        ) : null}

        {canViewAllUsers ? (
          <CrmCompanyFilterDropdown
            value={companyFilter}
            onChange={setCompanyFilter}
            companies={companies}
            defaultLabel="Company"
            allName="All companies"
            allSubtitle="Tasks across every company"
            searchPlaceholder="Search companies…"
          />
        ) : null}

        <PmsHubTasksProjectFilterDropdown
          value={projectFilter}
          onChange={setProjectFilter}
          projects={projectOptions}
          allProjectsSubtitle={projectFilterSubtitle}
        />

        <CrmTasksStatusFilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          statuses={pmsTaskStatuses}
        />

        {perms.canCreateTask ? (
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-700"
            onClick={handleAddTask}
          >
            <Plus className="h-4 w-4" />
            Add task
          </Button>
        ) : null}
      </div>
    ),
    [
      search,
      setSearch,
      projectFilter,
      setProjectFilter,
      projectOptions,
      projectFilterSubtitle,
      canViewAllUsers,
      assigneeFilter,
      setAssigneeFilter,
      companyFilter,
      setCompanyFilter,
      companies,
      userOptions,
      statusFilter,
      setStatusFilter,
      pmsTaskStatuses,
      perms.canCreateTask,
      handleAddTask,
    ],
  );

  usePmsHubToolbarSlot(toolbar);

  return (
    <>
      <PmsPickProjectDialog
        open={pickProjectOpen}
        onOpenChange={setPickProjectOpen}
        onSelect={handleProjectPicked}
      />

      {createProject ? (
        <PmsCreateTaskModal
          open={createModalOpen}
          onOpenChange={(open) => {
            setCreateModalOpen(open);
            if (!open) setCreateProject(null);
          }}
          projectId={createProject.id}
          projectTitle={createProject.title}
          members={createProject.members?.map((m) => ({
            userId: m.userId,
            userName: m.userName,
            userEmail: m.userEmail,
          }))}
          onCreated={(task) => notifyTaskUpdated(task)}
        />
      ) : null}
    </>
  );
}
