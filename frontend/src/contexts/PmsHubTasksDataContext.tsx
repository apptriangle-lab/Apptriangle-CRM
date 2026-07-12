import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { companiesApi, usersApi } from "@/lib/api";
import { canViewAllHubTasks } from "@/lib/pmsHubTasksAccess";
import { pmsApi, type PmsProjectDto, type PmsTaskDto } from "@/lib/pmsApi";
import { usePmsHubTasksFilters } from "@/contexts/PmsHubTasksFiltersContext";
import {
  buildHubProjectsApiParams,
  buildHubTasksApiParams,
} from "@/components/pms/hub-tasks/pmsHubTasksApiParams";
import {
  filterHubTasksForUser,
  isHubTaskOwnedByUser,
} from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import {
  hubProjectsQueryKey,
  hubTasksQueryKey,
  hubUsersQueryKey,
  HUB_PROJECTS_STALE_MS,
  HUB_TASKS_STALE_MS,
  HUB_USERS_STALE_MS,
} from "@/components/pms/hub-tasks/pmsHubTasksQuery";
import { applyListTaskUpdate } from "@/utils/pmsTaskCache";
import type { CrmCompanyFilterOption } from "@/components/crm/CrmCompanyFilterDropdown";

type HubTasksQueryData = { items: PmsTaskDto[]; total: number };

type PmsHubTasksDataContextValue = {
  tasks: PmsTaskDto[];
  projects: PmsProjectDto[];
  users: { id: string; name: string; email?: string }[];
  companies: CrmCompanyFilterOption[];
  tasksLoading: boolean;
  projectsLoading: boolean;
  isFetchingTasks: boolean;
  patchTask: (updated: PmsTaskDto) => void;
  removeTasks: (deletedIds: string[]) => void;
};

const PmsHubTasksDataContext = createContext<PmsHubTasksDataContextValue | null>(null);

export function PmsHubTasksDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { perms } = usePmsPermissions();
  const { projectFilter, assigneeFilter, companyFilter } = usePmsHubTasksFilters();
  const { subscribeTaskUpdates, subscribeTaskDeletes } = usePmsTaskModal();
  const queryClient = useQueryClient();

  const canViewAllUsers = canViewAllHubTasks(perms);
  const effectiveAssigneeFilter = canViewAllUsers ? assigneeFilter : "me";
  const effectiveCompanyFilter = canViewAllUsers ? companyFilter : "all";

  const tasksQueryKey = hubTasksQueryKey(effectiveAssigneeFilter, projectFilter, effectiveCompanyFilter);
  const projectsQueryKey = hubProjectsQueryKey(
    effectiveAssigneeFilter,
    user?.id,
    effectiveCompanyFilter,
  );

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: async () => {
      const params = buildHubTasksApiParams({
        projectFilter,
        assigneeFilter: effectiveAssigneeFilter,
        companyFilter: effectiveCompanyFilter,
        forceMine: !canViewAllUsers,
      });
      return pmsApi.listTasks(params);
    },
    staleTime: HUB_TASKS_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const projectsQuery = useQuery({
    queryKey: projectsQueryKey,
    queryFn: async () => {
      const params = buildHubProjectsApiParams({
        assigneeFilter: effectiveAssigneeFilter,
        currentUserId: user?.id,
        companyFilter: effectiveCompanyFilter,
        forFilter: true,
      });
      return pmsApi.listProjects(params);
    },
    staleTime: HUB_PROJECTS_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const usersQuery = useQuery({
    queryKey: [...hubUsersQueryKey, canViewAllUsers ? "all" : user?.id ?? "none"],
    queryFn: async () => {
      if (!canViewAllUsers) {
        if (!user) return [];
        return [{ id: user.id, name: user.name, email: user.email }];
      }
      const list = await usersApi.list();
      return list
        .filter((u) => u.isActive)
        .map((u) => ({ id: u.id, name: u.name, email: u.email }));
    },
    staleTime: HUB_USERS_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const companiesQuery = useQuery({
    queryKey: [...hubUsersQueryKey, "companies"],
    queryFn: async () => {
      const list = await companiesApi.list();
      return list.map((c) => ({
        id: c.id,
        name: c.name,
        location: c.location,
        country: c.country,
      }));
    },
    enabled: canViewAllUsers,
    staleTime: HUB_USERS_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const projectById = useMemo(
    () => new Map((projectsQuery.data?.items ?? []).map((project) => [project.id, project])),
    [projectsQuery.data?.items],
  );

  const scopedTasks = useMemo(() => {
    const items = tasksQuery.data?.items ?? [];
    if (canViewAllUsers || !user?.id) return items;
    return filterHubTasksForUser(items, user.id);
  }, [tasksQuery.data?.items, canViewAllUsers, user?.id]);

  useEffect(() => {
    if (tasksQuery.isError) {
      toast.error(
        tasksQuery.error instanceof Error ? tasksQuery.error.message : "Failed to load tasks",
      );
    }
  }, [tasksQuery.isError, tasksQuery.error]);

  const removeTasksFromCache = useCallback(
    (deletedIds: string[]) => {
      const removed = new Set(deletedIds);
      queryClient.setQueryData<HubTasksQueryData>(tasksQueryKey, (old) => {
        if (!old) return old;
        return { ...old, items: old.items.filter((task) => !removed.has(task.id)) };
      });
    },
    [queryClient, tasksQueryKey],
  );

  const patchTask = useCallback(
    (updated: PmsTaskDto) => {
      if (!canViewAllUsers && user?.id && !isHubTaskOwnedByUser(updated, user.id)) {
        removeTasksFromCache([updated.id]);
        return;
      }
      if (projectFilter !== "all" && updated.projectId !== projectFilter) {
        removeTasksFromCache([updated.id]);
        return;
      }
      if (effectiveCompanyFilter !== "all") {
        const project = projectById.get(updated.projectId);
        if (project?.companyId !== effectiveCompanyFilter) {
          removeTasksFromCache([updated.id]);
          return;
        }
      }
      queryClient.setQueryData<HubTasksQueryData>(tasksQueryKey, (old) => {
        if (!old) return old;
        const nextItems = applyListTaskUpdate(old.items, updated, "all");
        const scoped = canViewAllUsers || !user?.id ? nextItems : filterHubTasksForUser(nextItems, user.id);
        return { ...old, items: scoped };
      });
    },
    [
      queryClient,
      tasksQueryKey,
      projectFilter,
      effectiveCompanyFilter,
      projectById,
      canViewAllUsers,
      user?.id,
      removeTasksFromCache,
    ],
  );

  useEffect(() => subscribeTaskUpdates(patchTask), [subscribeTaskUpdates, patchTask]);

  useEffect(() => subscribeTaskDeletes(removeTasksFromCache), [subscribeTaskDeletes, removeTasksFromCache]);

  const value = useMemo<PmsHubTasksDataContextValue>(
    () => ({
      tasks: scopedTasks,
      projects: projectsQuery.data?.items ?? [],
      users: usersQuery.data ?? [],
      companies: companiesQuery.data ?? [],
      tasksLoading: tasksQuery.isLoading,
      projectsLoading: projectsQuery.isLoading,
      isFetchingTasks: tasksQuery.isFetching,
      patchTask,
      removeTasks: removeTasksFromCache,
    }),
    [
      scopedTasks,
      projectsQuery.data?.items,
      usersQuery.data,
      companiesQuery.data,
      tasksQuery.isLoading,
      projectsQuery.isLoading,
      tasksQuery.isFetching,
      patchTask,
      removeTasksFromCache,
    ],
  );

  return (
    <PmsHubTasksDataContext.Provider value={value}>{children}</PmsHubTasksDataContext.Provider>
  );
}

export function usePmsHubTasksData(): PmsHubTasksDataContextValue {
  const ctx = useContext(PmsHubTasksDataContext);
  if (!ctx) {
    throw new Error("usePmsHubTasksData must be used within PmsHubTasksDataProvider");
  }
  return ctx;
}

export function usePmsHubTasksDataOptional(): PmsHubTasksDataContextValue | null {
  return useContext(PmsHubTasksDataContext);
}
