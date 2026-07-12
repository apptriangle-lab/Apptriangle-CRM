import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  GitBranch,
  Layers,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsProjectOptional } from "@/contexts/PmsProjectContext";
import { usePmsTaskViewContext } from "@/contexts/PmsTaskViewContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { usersApi, type UserDto } from "@/lib/api";
import { PmsPickProjectDialog } from "@/components/pms/PmsPickProjectDialog";
import { pmsApi, formatPmsTaskStatusLabel, type PmsProjectDto, type PmsTaskDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuContent,
  PmsAssigneeFilterMenuItem,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsCreateTaskModal } from "@/components/pms/PmsCreateTaskModal";
import { PmsKanbanBoardSkeleton } from "@/components/pms/PmsKanbanBoardSkeleton";
import { KanbanStatusIcon } from "@/components/pms/PmsKanbanStatusIcon";
import { PmsKanbanTaskCardBody } from "@/components/pms/PmsKanbanTaskCard";
import { PmsSprintSelector } from "@/components/pms/sprints/PmsSprintSelector";
import { usePmsSprintsOptional } from "@/contexts/PmsSprintContext";
import { applyKanbanTaskUpdate } from "@/utils/pmsTaskCache";
import { usePmsHubTasksFiltersOptional } from "@/contexts/PmsHubTasksFiltersContext";
import { usePmsHubTasksDataOptional } from "@/contexts/PmsHubTasksDataContext";
import { buildKanbanColumnsFromTasks } from "@/components/pms/hub-tasks/pmsHubTasksQuery";
import {
  usePmsKanbanFilters,
  useSanitizeAssigneeFilter,
} from "@/hooks/usePmsViewFilters";
import {
  appendPersonalTaskScopeParams,
  usePmsAssigneeFilterAccess,
} from "@/hooks/usePmsAssigneeFilterAccess";
import {
  formatDueDateRangeLabel,
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { taskMatchesDueDateRange } from "@/components/pms/pmsDueDateFilter";
import {
  pmsStatusTheme,
  type PmsStatusTheme,
} from "@/components/pms/pmsTaskListStyles";

function KanbanSubtaskCard({
  task,
  theme,
  statusLabel,
  childCount,
  onOpen,
  onDragStart,
}: {
  task: PmsTaskDto;
  theme: PmsStatusTheme;
  statusLabel: string;
  childCount: number;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-[10px] border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md"
    >
      <PmsKanbanTaskCardBody task={task} theme={theme} statusLabel={statusLabel} />
      {childCount > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {childCount} subtask{childCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </article>
  );
}

function KanbanParentTaskCard({
  task,
  theme,
  statusLabel,
  subtasks,
  expanded,
  onToggleSubtasks,
  onOpen,
  onDragStart,
  childrenByParent,
  onOpenTask,
  getStatusLabel,
  getTheme,
  showProjectLabel = false,
}: {
  task: PmsTaskDto;
  theme: PmsStatusTheme;
  statusLabel: string;
  subtasks: PmsTaskDto[];
  expanded: boolean;
  onToggleSubtasks: () => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  childrenByParent: Record<string, PmsTaskDto[]>;
  onOpenTask: (id: string) => void;
  getStatusLabel: (status: string) => string;
  getTheme: (status: string) => PmsStatusTheme;
  showProjectLabel?: boolean;
}) {
  const subCount = subtasks.length || task.subTaskCount || 0;
  const hasSubtasks = subCount > 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "overflow-hidden rounded-[10px] border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md",
          hasSubtasks && !expanded && "rounded-b-[10px]",
        )}
      >
        <article draggable onDragStart={onDragStart} onClick={onOpen} className="cursor-pointer p-3.5">
          <PmsKanbanTaskCardBody
            task={task}
            theme={theme}
            statusLabel={statusLabel}
            showProjectLabel={showProjectLabel}
          />
        </article>

        {hasSubtasks ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubtasks();
            }}
            className="flex w-full items-center gap-1.5 border-t border-slate-200/80 bg-slate-100/90 px-3.5 py-2 text-left text-[12px] font-medium text-slate-600 hover:bg-slate-100"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2.5} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2.5} />
            )}
            {subCount} subtask{subCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      {hasSubtasks && expanded ? (
        <div className="ml-2 flex flex-col gap-1 border-l-2 border-slate-200/80 pl-2">
          {subtasks.map((sub) => {
            const subTheme = getTheme(sub.status);
            const nested = childrenByParent[sub.id] ?? [];
            const nestedCount = nested.length || sub.subTaskCount || 0;
            return (
              <KanbanSubtaskCard
                key={sub.id}
                task={sub}
                theme={subTheme}
                statusLabel={getStatusLabel(sub.status)}
                childCount={nestedCount}
                onOpen={() => onOpenTask(sub.id)}
                onDragStart={(e) => e.dataTransfer.setData("taskId", sub.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  statusKey,
  statusIndex,
  rootTasks,
  childrenByParent,
  expandedParents,
  onToggleSubtasks,
  onDrop,
  onOpenTask,
  onAddTask,
  canCreate,
  statusOrder,
  showProjectLabel = false,
}: {
  statusKey: string;
  statusIndex: number;
  rootTasks: PmsTaskDto[];
  childrenByParent: Record<string, PmsTaskDto[]>;
  expandedParents: Record<string, boolean>;
  onToggleSubtasks: (taskId: string) => void;
  onDrop: (taskId: string) => void;
  onOpenTask: (id: string) => void;
  onAddTask: () => void;
  canCreate: boolean;
  statusOrder: string[];
  showProjectLabel?: boolean;
}) {
  const theme = pmsStatusTheme(statusKey, statusIndex);
  const label = formatPmsTaskStatusLabel(statusKey).toUpperCase();

  const getStatusLabel = (status: string) => formatPmsTaskStatusLabel(status).toUpperCase();
  const getTheme = (status: string) => {
    const idx = statusOrder.indexOf(status);
    return pmsStatusTheme(status, idx >= 0 ? idx : undefined);
  };

  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-[272px] shrink-0 flex-col rounded-xl border border-slate-200/60",
        theme.kanbanColumnBg,
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) onDrop(taskId);
      }}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm",
            theme.pill,
          )}
        >
          <KanbanStatusIcon status={statusKey} className="h-3 w-3 shrink-0" />
          {label}
        </span>
        <span className={cn("ml-auto text-sm font-semibold tabular-nums", theme.kanbanAccent)}>
          {rootTasks.length}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {rootTasks.map((task) => {
          const subtasks = childrenByParent[task.id] ?? [];
          const expanded = expandedParents[task.id] ?? true;

          return (
            <KanbanParentTaskCard
              key={task.id}
              task={task}
              theme={theme}
              statusLabel={label}
              subtasks={subtasks}
              expanded={expanded}
              onToggleSubtasks={() => onToggleSubtasks(task.id)}
              onOpen={() => onOpenTask(task.id)}
              onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
              childrenByParent={childrenByParent}
              onOpenTask={onOpenTask}
              getStatusLabel={getStatusLabel}
              getTheme={getTheme}
              showProjectLabel={showProjectLabel}
            />
          );
        })}
      </div>

      {canCreate ? (
        <button
          type="button"
          onClick={onAddTask}
          className={cn(
            "mx-2 mb-3 flex items-center gap-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors hover:bg-white/60",
            theme.kanbanAccent,
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add Task
        </button>
      ) : null}
    </section>
  );
}

export function PmsKanbanBoard() {
  const { user } = useAuth();
  const { isMyTasks } = usePmsTaskViewContext();
  const projectCtx = usePmsProjectOptional();
  const projectId = projectCtx?.projectId;
  const project = projectCtx?.project ?? null;
  const { openTask, subscribeTaskUpdates, notifyTaskUpdated } = usePmsTaskModal();
  const { perms } = usePmsPermissions();
  const { pmsTaskStatuses, loading: statusConfigLoading } = useStatusConfig();
  const sprintCtx = usePmsSprintsOptional();
  const appendSprintToParams = sprintCtx?.appendSprintToParams ?? ((params: Record<string, string>) => params);
  const sprintFilter = sprintCtx?.sprintFilter ?? "all";
  const {
    assigneeFilter,
    setAssigneeFilter,
    statusFilter,
    setStatusFilter,
    dueDateRangeFilter,
    setDueDateRangeFilter,
  } = usePmsKanbanFilters();
  const hubFilters = usePmsHubTasksFiltersOptional();
  const hubData = usePmsHubTasksDataOptional();
  const activeStatusFilter =
    isMyTasks && hubFilters ? hubFilters.statusFilter : statusFilter;

  const [projectColumns, setProjectColumns] = useState<Record<string, PmsTaskDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string | undefined>();
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [pickProjectOpen, setPickProjectOpen] = useState(false);
  const [createProject, setCreateProject] = useState<PmsProjectDto | null>(null);

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
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

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

  useEffect(() => {
    usersApi.list().then((list) => setUsers(list.filter((u) => u.isActive))).catch(() => {});
  }, []);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (isMyTasks || !projectId) return;
      if (!opts?.silent) setLoading(true);
      const params = appendSprintToParams({ projectId }) as Record<string, string>;
      appendPersonalTaskScopeParams(params, {
        canViewAllAssignees,
        assigneeFilter,
        userId: user?.id,
      });
      pmsApi
        .getKanban(params)
        .then((r) => setProjectColumns(r.columns))
        .catch(() => toast.error("Failed to load board"))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [isMyTasks, projectId, assigneeFilter, user?.id, appendSprintToParams, canViewAllAssignees],
  );

  useEffect(() => {
    if (!isMyTasks) load();
  }, [isMyTasks, load]);

  useEffect(() => {
    return subscribeTaskUpdates((updated) => {
      if (isMyTasks) return;
      if (projectId && updated.projectId !== projectId) return;
      setProjectColumns((prev) => applyKanbanTaskUpdate(prev, updated, sprintFilter));
    });
  }, [subscribeTaskUpdates, isMyTasks, projectId, sprintFilter]);

  const statusOrder = useMemo(() => {
    const order: string[] = pmsTaskStatuses.length ? [...pmsTaskStatuses] : [];
    const seen = new Set(order);
    const tasks = isMyTasks && hubData ? hubData.tasks : Object.values(projectColumns).flat();
    tasks.forEach((task) => {
      if (!seen.has(task.status)) {
        order.push(task.status);
        seen.add(task.status);
      }
    });
    return order;
  }, [pmsTaskStatuses, isMyTasks, hubData?.tasks, projectColumns]);

  const columns = useMemo(() => {
    if (isMyTasks && hubData) {
      return buildKanbanColumnsFromTasks(hubData.tasks, statusOrder);
    }
    return projectColumns;
  }, [isMyTasks, hubData, hubData?.tasks, statusOrder, projectColumns]);

  const boardLoading = isMyTasks && hubData ? hubData.tasksLoading : loading;

  const { childrenByParent, rootsByColumn } = useMemo(() => {
    const allTasks = Object.values(columns).flat();
    const childMap: Record<string, PmsTaskDto[]> = {};

    for (const task of allTasks) {
      if (!task.parentTaskId) continue;
      if (!childMap[task.parentTaskId]) childMap[task.parentTaskId] = [];
      childMap[task.parentTaskId].push(task);
    }

    const roots: Record<string, PmsTaskDto[]> = {};
    for (const [status, tasks] of Object.entries(columns)) {
      roots[status] = tasks.filter((t) => !t.parentTaskId);
    }

    return { childrenByParent: childMap, rootsByColumn: roots };
  }, [columns]);

  const taskPassesFilters = useCallback(
    (task: PmsTaskDto) => {
      if (isMyTasks) {
        const q = hubFilters?.search.trim().toLowerCase() ?? "";
        if (q && !task.title.toLowerCase().includes(q)) return false;
      }
      if (activeStatusFilter !== "all" && task.status !== activeStatusFilter) return false;
      if (!taskMatchesDueDateRange(task, dueDateRangeFilter)) return false;
      return true;
    },
    [isMyTasks, hubFilters?.search, activeStatusFilter, dueDateRangeFilter],
  );

  const visibleStatusOrder = useMemo(() => {
    if (activeStatusFilter === "all") return statusOrder;
    return statusOrder.filter((s) => s === activeStatusFilter);
  }, [statusOrder, activeStatusFilter]);

  const filteredChildrenByParent = useMemo(() => {
    const out: Record<string, PmsTaskDto[]> = {};
    for (const [parentId, subs] of Object.entries(childrenByParent)) {
      const filtered = subs.filter(taskPassesFilters);
      if (filtered.length > 0) out[parentId] = filtered;
    }
    return out;
  }, [childrenByParent, taskPassesFilters]);

  const filteredRootsByColumn = useMemo(() => {
    const out: Record<string, PmsTaskDto[]> = {};
    for (const status of visibleStatusOrder) {
      out[status] = (rootsByColumn[status] ?? []).filter((task) => {
        if (taskPassesFilters(task)) return true;
        const subs = filteredChildrenByParent[task.id] ?? [];
        return subs.length > 0;
      });
    }
    return out;
  }, [visibleStatusOrder, rootsByColumn, taskPassesFilters, filteredChildrenByParent]);

  useEffect(() => {
    if (activeStatusFilter !== "all" && !statusOrder.includes(activeStatusFilter)) {
      if (isMyTasks && hubFilters) {
        hubFilters.setStatusFilter("all");
      } else {
        setStatusFilter("all");
      }
    }
  }, [activeStatusFilter, statusOrder, setStatusFilter, isMyTasks, hubFilters]);

  const onDropStatus = async (taskId: string, status: string) => {
    try {
      const updated = await pmsApi.patchTaskStatus(taskId, status);
      if (isMyTasks) {
        notifyTaskUpdated(updated);
      } else {
        setProjectColumns((prev) => applyKanbanTaskUpdate(prev, updated, sprintFilter));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedParents((prev) => ({ ...prev, [taskId]: !(prev[taskId] ?? true) }));
  };

  const openCreateModal = (status?: string) => {
    setCreateDefaultStatus(status ?? statusOrder[0] ?? "to_do");
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

  if ((boardLoading || statusConfigLoading) && Object.keys(columns).length === 0) {
    return <PmsKanbanBoardSkeleton />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {!isMyTasks ? (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 px-4 py-2.5">
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!isMyTasks ? (
            <PmsSprintSelector manageable canManage={perms.canCreateTask} showStatus={false} />
          ) : null}
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
            <PmsAssigneeFilterMenuContent align="end">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                {statusFilter === "all" ? "Status" : formatPmsTaskStatusLabel(statusFilter)}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[min(280px,50vh)] w-52 overflow-y-auto">
              <DropdownMenuItem className="flex items-center gap-2" onClick={() => setStatusFilter("all")}>
                <span className="flex-1">All statuses</span>
                {statusFilter === "all" ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
              {statusOrder.map((s) => (
                <DropdownMenuItem key={s} className="flex items-center gap-2" onClick={() => setStatusFilter(s)}>
                  <span className="flex-1">{formatPmsTaskStatusLabel(s)}</span>
                  {statusFilter === s ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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

          {perms.canCreateTask ? (
            <Button
              type="button"
              onClick={() => openCreateModal()}
              className="h-8 gap-1 rounded-lg bg-slate-900 px-3 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Add Task
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 py-4">
          <div
            className={cn(
              "flex h-full w-max flex-nowrap items-stretch gap-3 pb-2",
              !isMyTasks && "min-h-[480px]",
            )}
          >
              {visibleStatusOrder.map((colKey) => (
                <KanbanColumn
                  key={colKey}
                  statusKey={colKey}
                  statusIndex={statusOrder.indexOf(colKey)}
                  rootTasks={filteredRootsByColumn[colKey] ?? []}
                  childrenByParent={filteredChildrenByParent}
                  expandedParents={expandedParents}
                  onToggleSubtasks={toggleSubtasks}
                  onDrop={(taskId) => void onDropStatus(taskId, colKey)}
                  onOpenTask={openTask}
                  onAddTask={() => openCreateModal(colKey)}
                  canCreate={perms.canCreateTask}
                  statusOrder={statusOrder}
                  showProjectLabel={isMyTasks}
                />
              ))}
          </div>
        </div>
      </div>

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
        defaultSprintId={
          !isMyTasks && sprintFilter !== "all" && sprintFilter !== "backlog" ? sprintFilter : null
        }
        members={(isMyTasks ? createProject?.members : project?.members)?.map((m) => ({
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
        }))}
        onCreated={() => {
          setCreateModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
