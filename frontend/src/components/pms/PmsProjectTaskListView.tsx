import { useCallback, useEffect, useMemo, useState } from "react";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { ChevronDown, ChevronRight, Calendar, Filter, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, type UserDto } from "@/lib/api";
import { pmsApi, formatPmsTaskStatusLabel, type PmsProjectDto, type PmsTaskDto } from "@/lib/pmsApi";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsProjectOptional } from "@/contexts/PmsProjectContext";
import { usePmsTaskViewContext } from "@/contexts/PmsTaskViewContext";
import { usePmsSprintsOptional } from "@/contexts/PmsSprintContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { PmsSprintSelector } from "@/components/pms/sprints/PmsSprintSelector";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { filterTasksByDueDateRange } from "@/components/pms/pmsDueDateFilter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PmsProjectTaskListSkeleton } from "@/components/pms/PmsProjectTaskListSkeleton";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuContent,
  PmsAssigneeFilterMenuItem,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsCreateTaskModal } from "@/components/pms/PmsCreateTaskModal";
import { PmsTaskDeleteDialog } from "@/components/pms/PmsTaskDeleteDialog";
import { buildNodesForRoots, PmsTaskListTree } from "@/components/pms/PmsTaskListTree";
import type { SubtaskCreateDraft } from "@/components/pms/PmsSubtaskInlineEditor";
import type { AssigneeOption } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsTaskBulkActionBar } from "@/components/pms/PmsTaskBulkActionBar";
import { PmsPickProjectDialog } from "@/components/pms/PmsPickProjectDialog";
import { PMS_TASK_COL_GRID, PMS_TASK_COL_GRID_WITH_PROJECT, PMS_TASK_LIST_HPAD, pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { Checkbox } from "@/components/ui/checkbox";
import { applyListTaskUpdate } from "@/utils/pmsTaskCache";
import {
  usePmsTasksFilters,
  useSanitizeAssigneeFilter,
} from "@/hooks/usePmsViewFilters";
import {
  appendPersonalTaskScopeParams,
  usePmsAssigneeFilterAccess,
} from "@/hooks/usePmsAssigneeFilterAccess";

/** Slight indent so tasks sit under the status title, not flush with the header edge */
const TASKS_UNDER_GROUP = cn("mt-2.5 mb-4", PMS_TASK_LIST_HPAD);

export function PmsProjectTaskListView() {
  const { user } = useAuth();
  const { isMyTasks } = usePmsTaskViewContext();
  const projectCtx = usePmsProjectOptional();
  const projectId = projectCtx?.projectId;
  const project = projectCtx?.project ?? null;
  const { openTask, subscribeTaskUpdates, subscribeTaskDeletes, notifyTaskUpdated, notifyTaskDeleted } =
    usePmsTaskModal();
  const { perms } = usePmsPermissions();
  const { pmsTaskStatuses, loading: statusConfigLoading } = useStatusConfig();
  const sprintCtx = usePmsSprintsOptional();
  const appendSprintToParams = sprintCtx?.appendSprintToParams ?? ((params: Record<string, string | number>) => params);
  const sprintFilter = sprintCtx?.sprintFilter ?? "all";
  const {
    search,
    setSearch,
    assigneeFilter,
    setAssigneeFilter,
    dueDateRangeFilter,
    setDueDateRangeFilter,
  } = usePmsTasksFilters();

  const [items, setItems] = useState<PmsTaskDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string | undefined>();
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [creatingTitle, setCreatingTitle] = useState("");
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PmsTaskDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pickProjectOpen, setPickProjectOpen] = useState(false);
  const [createProject, setCreateProject] = useState<PmsProjectDto | null>(null);

  const colGridClass = isMyTasks ? PMS_TASK_COL_GRID_WITH_PROJECT : PMS_TASK_COL_GRID;

  const hasDueDateFilter = Boolean(dueDateRangeFilter.startDate || dueDateRangeFilter.endDate);

  const projectMembers = useMemo(() => project?.members ?? [], [project?.members]);
  const memberUserIds = useMemo(
    () => projectMembers.map((m) => m.userId),
    [projectMembers],
  );
  useSanitizeAssigneeFilter(
    assigneeFilter,
    setAssigneeFilter,
    isMyTasks ? [] : memberUserIds,
  );
  const canViewAllAssignees = usePmsAssigneeFilterAccess(
    assigneeFilter,
    setAssigneeFilter,
    isMyTasks ? "hub" : "project",
  );

  const visibleItems = useMemo(
    () => filterTasksByDueDateRange(items, dueDateRangeFilter),
    [items, dueDateRangeFilter],
  );

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    if (!isMyTasks) {
      return projectMembers.map((m) => ({
        id: m.userId,
        name: m.userName ?? m.userEmail ?? "Member",
        email: m.userEmail ?? undefined,
      }));
    }
    const seen = new Map<string, AssigneeOption>();
    items.forEach((task) => {
      task.assignees?.forEach((assignee) => {
        if (!assignee.userId || seen.has(assignee.userId)) return;
        seen.set(assignee.userId, {
          id: assignee.userId,
          name: assignee.userName ?? "Member",
        });
      });
    });
    if (user?.id && !seen.has(user.id)) {
      seen.set(user.id, {
        id: user.id,
        name: userById.get(user.id)?.name ?? user.name ?? "Me",
        email: userById.get(user.id)?.email ?? user.email,
      });
    }
    return [...seen.values()];
  }, [isMyTasks, projectMembers, items, user, userById]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    projectMembers.forEach((mem) => {
      m.set(mem.userId, mem.userName ?? mem.userEmail ?? "Member");
    });
    users.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [users, projectMembers]);

  const assigneeFilterLabel = useMemo(() => {
    if (assigneeFilter === "all") return "All assignees";
    if (assigneeFilter === "me") return "Assigned to me";
    const member = projectMembers.find((m) => m.userId === assigneeFilter);
    const profile = userById.get(assigneeFilter);
    return profile?.name ?? member?.userName ?? member?.userEmail ?? "Member";
  }, [assigneeFilter, projectMembers, userById]);

  const selectedAssigneeProfile = useMemo(() => {
    if (assigneeFilter === "all") return null;
    const userId = assigneeFilter === "me" ? user?.id : assigneeFilter;
    if (!userId) return null;
    const profile = userById.get(userId);
    const member = projectMembers.find((m) => m.userId === userId);
    return {
      userId,
      name: profile?.name ?? member?.userName ?? user?.name ?? "User",
    };
  }, [assigneeFilter, user?.id, user?.name, userById, projectMembers]);

  /** All configured statuses from Settings, plus any legacy task statuses not in config. */
  const statusOrder = useMemo(() => {
    const order: string[] = pmsTaskStatuses.length ? [...pmsTaskStatuses] : [];
    const seen = new Set(order);
    items.forEach((t) => {
      if (t.parentTaskId) return;
      if (!seen.has(t.status)) {
        order.push(t.status);
        seen.add(t.status);
      }
    });
    return order;
  }, [pmsTaskStatuses, items]);

  const load = useCallback(async () => {
    if (!isMyTasks && !projectId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: 1,
        perPage: 500,
        search,
      };
      if (isMyTasks) {
        params.mine = "true";
      } else {
        appendPersonalTaskScopeParams(params, {
          canViewAllAssignees,
          assigneeFilter,
          userId: user?.id,
        });
      }
      if (!isMyTasks && projectId) {
        Object.assign(params, appendSprintToParams({ projectId }));
      }
      const r = await pmsApi.listTasks(params);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [isMyTasks, projectId, search, assigneeFilter, user?.id, appendSprintToParams, canViewAllAssignees]);

  useEffect(() => {
    usersApi.list().then((list) => setUsers(list.filter((u) => u.isActive))).catch(() => {});
  }, []);

  useEffect(() => {
    const valid = new Set(items.map((t) => t.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);


  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribeTaskUpdates((updated) => {
      setItems((prev) => applyListTaskUpdate(prev, updated, sprintFilter));
    });
  }, [subscribeTaskUpdates, sprintFilter]);

  useEffect(() => {
    return subscribeTaskDeletes((deletedIds) => {
      const removed = new Set(deletedIds);
      setItems((prev) => prev.filter((t) => !removed.has(t.id)));
      setSelectedIds((prev) => new Set([...prev].filter((id) => !removed.has(id))));
    });
  }, [subscribeTaskDeletes]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      items.forEach((t) => {
        if (items.some((c) => c.parentTaskId === t.id) && !(t.id in next)) {
          next[t.id] = true;
        }
      });
      return next;
    });
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, PmsTaskDto[]>();
    statusOrder.forEach((s) => map.set(s, []));
    visibleItems.forEach((t) => {
      if (t.parentTaskId) return;
      if (!map.has(t.status)) map.set(t.status, []);
      map.get(t.status)!.push(t);
    });
    return statusOrder.map((status) => ({ status, tasks: map.get(status) ?? [] }));
  }, [visibleItems, statusOrder]);

  const toggleGroup = (status: string) => {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateModal = (status?: string) => {
    setCreateDefaultStatus(status ?? pmsTaskStatuses[0] ?? "to_do");
    if (isMyTasks) {
      setPickProjectOpen(true);
      return;
    }
    setCreateModalOpen(true);
  };

  const handlePickProjectForCreate = (picked: PmsProjectDto) => {
    setCreateProject(picked);
    setCreateModalOpen(true);
  };

  const handleStatusChange = async (task: PmsTaskDto, newStatus: string) => {
    if (task.status === newStatus) return;
    try {
      const updated = await pmsApi.patchTaskStatus(task.id, newStatus);
      setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const patchTask = useCallback(async (taskId: string, patch: Partial<PmsTaskDto> & { assigneeIds?: string[] }) => {
    try {
      const updated = await pmsApi.updateTask(taskId, patch);
      setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      throw e;
    }
  }, []);

  const startCreateSubtask = (parentId: string) => {
    setCreatingParentId(parentId);
    setCreatingTitle("");
  };

  const cancelCreateSubtask = () => {
    setCreatingParentId(null);
    setCreatingTitle("");
  };

  const allTaskIds = useMemo(() => visibleItems.map((t) => t.id), [visibleItems]);
  const allSelected =
    allTaskIds.length > 0 && allTaskIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(allTaskIds));
    else setSelectedIds(new Set());
  };

  const applyBulkUpdates = (updated: PmsTaskDto[]) => {
    if (updated.length === 0) return;
    const byId = new Map(updated.map((t) => [t.id, t]));
    setItems((prev) => prev.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id)! } : t)));
  };

  const countTaskDescendants = useCallback((taskId: string, all: PmsTaskDto[]) => {
    let count = 0;
    const walk = (parentId: string) => {
      all.filter((t) => t.parentTaskId === parentId).forEach((child) => {
        count += 1;
        walk(child.id);
      });
    };
    walk(taskId);
    return count;
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await pmsApi.deleteTask(deleteTarget.id);
      toast.success(`Deleted ${r.count} task${r.count === 1 ? "" : "s"}`);
      notifyTaskDeleted(r.deletedTaskIds);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const saveSubtask = async (parentId: string, draft: SubtaskCreateDraft) => {
    const parentTask = items.find((t) => t.id === parentId);
    const effectiveProjectId = isMyTasks ? parentTask?.projectId : projectId;
    if (!draft.title || !effectiveProjectId) return;

    setSavingSubtask(true);
    try {
      const created = await pmsApi.createTask({
        projectId: effectiveProjectId,
        parentTaskId: parentId,
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        assigneeIds: draft.assigneeIds.length ? draft.assigneeIds : undefined,
        startDate: draft.startDate,
        endDate: draft.endDate,
      });
      setItems((prev) => [
        ...prev.map((t) =>
          t.id === parentId ? { ...t, subTaskCount: (t.subTaskCount ?? 0) + 1 } : t,
        ),
        created,
      ]);
      notifyTaskUpdated(created);
      setExpanded((prev) => ({ ...prev, [parentId]: true }));
      cancelCreateSubtask();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create subtask");
    } finally {
      setSavingSubtask(false);
    }
  };

  if ((loading || statusConfigLoading) && items.length === 0) {
    return <PmsProjectTaskListSkeleton />;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col bg-white text-slate-900">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {!isMyTasks ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50",
                    assigneeFilter !== "all" &&
                      "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
                  )}
                >
                  <Filter className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{assigneeFilterLabel}</span>
                  {selectedAssigneeProfile ? (
                    <PmsMemberAvatar
                      name={selectedAssigneeProfile.name}
                      userId={selectedAssigneeProfile.userId}
                      size="xs"
                    />
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <PmsAssigneeFilterMenuContent>
                <PmsAssigneeFilterMenuItem
                  name="All assignees"
                  subtitle="Show everyone's tasks"
                  selected={assigneeFilter === "all"}
                  onSelect={() => setAssigneeFilter("all")}
                  icon={<PmsAssigneeFilterAllIcon />}
                />
                {user?.id && (
                  <PmsAssigneeFilterMenuItem
                    name={userById.get(user.id)?.name ?? user.name ?? "Me"}
                    email={userById.get(user.id)?.email ?? user.email}
                    userId={user.id}
                    selected={assigneeFilter === "me"}
                    onSelect={() => setAssigneeFilter("me")}
                  />
                )}
                {projectMembers
                  .filter((m) => m.userId !== user?.id)
                  .map((m) => {
                    const profile = userById.get(m.userId);
                    return (
                      <PmsAssigneeFilterMenuItem
                        key={m.userId}
                        name={profile?.name ?? m.userName ?? "Member"}
                        email={profile?.email ?? m.userEmail}
                        userId={m.userId}
                        selected={assigneeFilter === m.userId}
                        onSelect={() => setAssigneeFilter(m.userId)}
                      />
                    );
                  })}
              </PmsAssigneeFilterMenuContent>
            </DropdownMenu>
          ) : null}
          {!isMyTasks ? (
            <PmsSprintSelector manageable canManage={perms.canCreateTask} showStatus={false} />
          ) : null}
          <PmsTaskDatePicker
            value={dueDateRangeFilter}
            onChange={setDueDateRangeFilter}
            rangeSelect
            allowClear
            clearLabel="All due dates"
            open={dueDatePickerOpen}
            onOpenChange={setDueDatePickerOpen}
            modal={false}
          >
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium hover:bg-slate-50",
                hasDueDateFilter ? "text-slate-900" : "text-slate-600",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {formatDueDateRangeLabel(dueDateRangeFilter)}
              {hasDueDateFilter ? <span className="h-2 w-2 rounded-full bg-violet-500" /> : null}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </PmsTaskDatePicker>
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-8 border-slate-200 bg-white pl-8 text-sm"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {perms.canCreateTask && (
              <Button
                size="sm"
                className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                onClick={() => openCreateModal()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Task
              </Button>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          colGridClass,
          PMS_TASK_LIST_HPAD,
          "shrink-0 border-b border-slate-200 bg-slate-50/90 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
        )}
      >
        <span className="flex items-center gap-2">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(v) => toggleSelectAll(v === true)}
            className="h-4 w-4 border-slate-300 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600"
            aria-label="Select all tasks"
          />
          Name
        </span>
        {isMyTasks ? <span>Project</span> : null}
        <span>Status</span>
        <span className="min-w-0 truncate">Dates</span>
        <span className="text-center">Assignee</span>
        <span className="text-center">Created by</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-white">
        {statusOrder.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">No task statuses configured</p>
            <p className="mt-1">Add PMS task statuses in Settings → Status.</p>
          </div>
        ) : (
          grouped.map(({ status, tasks }, statusIndex) => {
            const theme = pmsStatusTheme(status, statusIndex);
            const isCollapsed = collapsed[status];
            const label = formatPmsTaskStatusLabel(status).toUpperCase();

            return (
              <section key={status} className="border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleGroup(status)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b px-4 py-2 text-left text-xs font-bold tracking-wide",
                    theme.headerBg,
                    theme.headerText,
                    theme.headerBorder,
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  )}
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm", theme.pill)}>
                    {label}
                  </span>
                  <span className="font-normal opacity-70">{tasks.length}</span>
                  {perms.canCreateTask && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-auto rounded p-0.5 hover:bg-black/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateModal(status);
                        if (isCollapsed) toggleGroup(status);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <div className={TASKS_UNDER_GROUP}>
                    <PmsTaskListTree
                      nodes={buildNodesForRoots(tasks, visibleItems)}
                      allItems={visibleItems}
                      depth={0}
                      statusOrder={statusOrder}
                      expanded={expanded}
                      onToggleExpand={toggleExpand}
                      onOpenTask={openTask}
                      onStatusChange={handleStatusChange}
                      userNameById={userNameById}
                      canCreateTask={perms.canCreateTask}
                      creatingParentId={creatingParentId}
                      creatingTitle={creatingTitle}
                      onCreatingTitleChange={setCreatingTitle}
                      onStartCreateSubtask={startCreateSubtask}
                      onCancelCreateSubtask={cancelCreateSubtask}
                      onSaveSubtask={saveSubtask}
                      savingSubtask={savingSubtask}
                      assigneeOptions={assigneeOptions}
                      canUpdateTask={perms.canUpdateTask}
                      canDeleteTask={perms.canDeleteTask || perms.canCreateTask || perms.canUpdateTask}
                      onDeleteTask={setDeleteTarget}
                      onPatchTask={patchTask}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      showProjectColumn={isMyTasks}
                      colGridClass={colGridClass}
                    />

                    {perms.canCreateTask && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 py-2.5 text-left text-sm text-slate-500 transition-colors hover:text-slate-800"
                        onClick={() => openCreateModal(status)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Task
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      <PmsTaskBulkActionBar
        selectedIds={[...selectedIds]}
        statusOrder={statusOrder}
        assigneeOptions={assigneeOptions}
        canUpdateTask={perms.canUpdateTask}
        canUpdateTaskStatus={perms.canUpdateTaskStatus}
        onClear={() => setSelectedIds(new Set())}
        onApplied={applyBulkUpdates}
      />

      <PmsPickProjectDialog
        open={pickProjectOpen}
        onOpenChange={setPickProjectOpen}
        onSelect={handlePickProjectForCreate}
      />

      <PmsCreateTaskModal
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) setCreateProject(null);
        }}
        projectId={isMyTasks ? (createProject?.id ?? "") : (projectId ?? "")}
        projectTitle={isMyTasks ? createProject?.title : project?.title}
        defaultStatus={createDefaultStatus}
        members={(isMyTasks ? createProject?.members : project?.members)?.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
        }))}
        onCreated={(t) => setItems((prev) => [...prev, t])}
      />

      <PmsTaskDeleteDialog
        task={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        subtaskCount={deleteTarget ? countTaskDescendants(deleteTarget.id, visibleItems) : 0}
      />
    </div>
  );
}
