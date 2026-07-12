import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { usePmsProjectOptional } from "@/contexts/PmsProjectContext";
import { usePmsTaskViewContext } from "@/contexts/PmsTaskViewContext";
import { usePmsSprintsOptional } from "@/contexts/PmsSprintContext";
import { pmsApi, type PmsTaskDto } from "@/lib/pmsApi";
import { PmsSprintSelector } from "@/components/pms/sprints/PmsSprintSelector";
import { applyListTaskUpdate } from "@/utils/pmsTaskCache";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuContent,
  PmsAssigneeFilterMenuItem,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsCalendarSelectedDayPanel } from "@/components/pms/PmsCalendarSelectedDayPanel";
import { PmsProjectCalendarSkeleton } from "@/components/pms/PmsProjectCalendarSkeleton";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";
import { usersApi, type UserDto } from "@/lib/api";
import { usePmsHubTasksFiltersOptional } from "@/contexts/PmsHubTasksFiltersContext";
import { usePmsHubTasksDataOptional } from "@/contexts/PmsHubTasksDataContext";
import {
  usePmsCalendarFilters,
  usePmsKanbanFilters,
  useSanitizeAssigneeFilter,
} from "@/hooks/usePmsViewFilters";
import {
  appendPersonalTaskScopeParams,
  usePmsAssigneeFilterAccess,
} from "@/hooks/usePmsAssigneeFilterAccess";

const WEEK_STARTS_ON = 0; // Sunday
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

function isWeekendDay(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 5 || weekday === 6; // Friday & Saturday
}

function parsePmsCalendarDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00`);
    return isValid(d) ? startOfDay(d) : null;
  } catch {
    return null;
  }
}

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Days a task should appear on: span from start→end when both exist, else single anchor date. */
function getTaskCalendarDays(task: PmsTaskDto): Date[] {
  const start = parsePmsCalendarDate(task.startDate);
  const end = parsePmsCalendarDate(task.endDate);
  if (start && end) {
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    return eachDayOfInterval({ start: from, end: to });
  }
  if (end) return [end];
  if (start) return [start];
  return [];
}

function buildTasksByDay(tasks: PmsTaskDto[]): Map<string, PmsTaskDto[]> {
  const map = new Map<string, PmsTaskDto[]>();
  const seen = new Set<string>();

  for (const task of tasks) {
    const days = getTaskCalendarDays(task);
    for (const day of days) {
      const key = dateKey(day);
      const dedupeKey = `${key}:${task.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return map;
}

type CalendarTaskChipProps = {
  task: PmsTaskDto;
  onOpen: (id: string) => void;
  showProjectLabel?: boolean;
};

function CalendarTaskChip({ task, onOpen, showProjectLabel = false }: CalendarTaskChipProps) {
  const theme = pmsStatusTheme(task.status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(task.id);
      }}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md border border-zinc-200/90 bg-zinc-50 px-1.5 py-0.5 text-left",
        "text-[11px] font-medium leading-tight text-zinc-800 shadow-sm",
        "transition-colors hover:border-zinc-300 hover:bg-white",
      )}
      title={showProjectLabel && task.projectTitle ? `${task.title} · ${task.projectTitle}` : task.title}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white", theme.dot)} />
      <span className="min-w-0 truncate">
        {showProjectLabel && task.projectTitle ? (
          <>
            <span className="text-violet-600">{task.projectTitle}</span>
            <span className="text-zinc-400"> · </span>
          </>
        ) : null}
        {task.title}
      </span>
    </button>
  );
}

export function PmsProjectCalendarView() {
  const { user } = useAuth();
  const { isMyTasks } = usePmsTaskViewContext();
  const projectCtx = usePmsProjectOptional();
  const projectId = projectCtx?.projectId;
  const project = projectCtx?.project ?? null;
  const { openTask, subscribeTaskUpdates } = usePmsTaskModal();
  const {
    assigneeFilter,
    setAssigneeFilter,
    month,
    setMonth,
    selectedDay,
    setSelectedDay,
  } = usePmsCalendarFilters();
  const hubFilters = usePmsHubTasksFiltersOptional();
  const hubData = usePmsHubTasksDataOptional();
  const { statusFilter: localStatusFilter } = usePmsKanbanFilters();
  const activeStatusFilter =
    isMyTasks && hubFilters ? hubFilters.statusFilter : localStatusFilter;

  const [projectItems, setProjectItems] = useState<PmsTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDto[]>([]);

  const sprintCtx = usePmsSprintsOptional();
  const appendSprintToParams = sprintCtx?.appendSprintToParams ?? ((params: Record<string, string | number>) => params);
  const sprintFilter = sprintCtx?.sprintFilter ?? "all";
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

  useEffect(() => {
    usersApi
      .list()
      .then((list) => setUsers(list.filter((u) => u.isActive)))
      .catch(() => {});
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (isMyTasks || !projectId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: 1,
        perPage: 500,
      };
      Object.assign(params, appendSprintToParams({ projectId }));
      appendPersonalTaskScopeParams(params, {
        canViewAllAssignees,
        assigneeFilter,
        userId: user?.id,
      });
      const r = await pmsApi.listTasks(params);
      setProjectItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [isMyTasks, projectId, assigneeFilter, user?.id, appendSprintToParams, canViewAllAssignees]);

  useEffect(() => {
    if (!isMyTasks) void load();
  }, [isMyTasks, load]);

  useEffect(() => {
    return subscribeTaskUpdates((updated) => {
      if (isMyTasks) return;
      if (projectId && updated.projectId !== projectId) return;
      setProjectItems((prev) => applyListTaskUpdate(prev, updated, sprintFilter));
    });
  }, [subscribeTaskUpdates, isMyTasks, projectId, sprintFilter]);

  const items = isMyTasks && hubData ? hubData.tasks : projectItems;
  const calendarLoading = isMyTasks && hubData ? hubData.tasksLoading : loading;

  const visibleItems = useMemo(() => {
    if (!isMyTasks) return items;
    let list = items;
    const q = hubFilters?.search.trim().toLowerCase() ?? "";
    if (q) {
      list = list.filter((task) => task.title.toLowerCase().includes(q));
    }
    if (activeStatusFilter !== "all") {
      list = list.filter((task) => task.status === activeStatusFilter);
    }
    return list;
  }, [isMyTasks, items, hubFilters?.search, activeStatusFilter]);

  const tasksByDay = useMemo(() => buildTasksByDay(visibleItems), [visibleItems]);

  const unscheduled = useMemo(
    () => visibleItems.filter((t) => getTaskCalendarDays(t).length === 0),
    [visibleItems],
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const selectedDayTasks = useMemo(() => {
    return tasksByDay.get(dateKey(selectedDay)) ?? [];
  }, [tasksByDay, selectedDay]);

  const todayTaskCount = useMemo(() => {
    const todayKey = dateKey(startOfDay(new Date()));
    return (tasksByDay.get(todayKey) ?? []).length;
  }, [tasksByDay]);

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

  const assigneeFilterLabel = useMemo(() => {
    if (assigneeFilter === "all") return null;
    if (assigneeFilter === "me") return "you";
    const member = projectMembers.find((m) => m.userId === assigneeFilter);
    return member?.userName ?? member?.userEmail ?? "member";
  }, [assigneeFilter, projectMembers]);

  if (calendarLoading && items.length === 0) {
    return <PmsProjectCalendarSkeleton />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50">
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6",
          isMyTasks ? "justify-end py-2.5" : "justify-between",
        )}
      >
        {!isMyTasks ? (
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Calendar</h2>
          <p className="text-xs text-zinc-600">
            Tasks by start and end dates
            {assigneeFilter !== "all" && (
              <span className="ml-2 font-medium text-indigo-700">
                · Filtered for {assigneeFilterLabel}
              </span>
            )}
            {todayTaskCount > 0 && (
              <span className="ml-2 font-medium text-blue-700">
                · {todayTaskCount} task{todayTaskCount === 1 ? "" : "s"} today
              </span>
            )}
          </p>
        </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={() => {
              const today = startOfDay(new Date());
              setMonth(startOfMonth(today));
              setSelectedDay(today);
            }}
          >
            Today
          </Button>

          {!isMyTasks ? <PmsSprintSelector /> : null}

          {!isMyTasks ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-lg border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950",
                  assigneeFilter !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
                )}
              >
                <User className="h-3.5 w-3.5" />
                {assigneeFilter === "all" ? "Assignee" : "Filtered"}
                {selectedAssigneeProfile ? (
                  <PmsMemberAvatar
                    name={selectedAssigneeProfile.name}
                    userId={selectedAssigneeProfile.userId}
                    size="xs"
                  />
                ) : null}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </Button>
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-zinc-950">
            {format(month, "MMMM yyyy")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-zinc-100/50 p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-100/80">
              {WEEKDAY_LABELS.map((label) => {
                const isWeekend = label === "Fri" || label === "Sat";
                return (
                  <div
                    key={label}
                    className={cn(
                      "border-r border-zinc-200 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide last:border-r-0",
                      isWeekend
                        ? "bg-zinc-200/60 text-zinc-400"
                        : "bg-zinc-100/80 text-zinc-600",
                    )}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, month);
                const selected = isSameDay(day, selectedDay);
                const today = isToday(day);
                const overflow = dayTasks.length - MAX_CHIPS_PER_DAY;
                const weekend = isWeekendDay(day);

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDay(day);
                      }
                    }}
                    className={cn(
                      "flex min-h-[100px] cursor-pointer flex-col border-b border-r border-zinc-200/70 p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[120px] sm:p-2",
                      weekend && inMonth && !selected && "bg-zinc-200/45",
                      weekend && !inMonth && "bg-zinc-200/65",
                      !weekend && !inMonth && "bg-zinc-100/70",
                      selected && "bg-blue-50/90 ring-1 ring-inset ring-blue-300/70",
                      !selected && weekend && "hover:bg-zinc-200/70",
                      !selected && !weekend && "hover:bg-zinc-50",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        !inMonth && "text-zinc-400",
                        inMonth && weekend && !today && !selected && "text-zinc-500",
                        inMonth && !weekend && !today && !selected && "text-zinc-800",
                        today && "bg-zinc-950 text-white shadow-sm",
                        selected && !today && "bg-blue-600 text-white",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                      {dayTasks.slice(0, MAX_CHIPS_PER_DAY).map((task) => (
                        <CalendarTaskChip
                          key={task.id}
                          task={task}
                          onOpen={openTask}
                          showProjectLabel={isMyTasks}
                        />
                      ))}
                      {overflow > 0 && (
                        <span className="px-1 text-[10px] font-semibold text-blue-700">
                          +{overflow} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <PmsCalendarSelectedDayPanel
          selectedDay={selectedDay}
          tasks={selectedDayTasks}
          unscheduled={unscheduled}
          onOpenTask={openTask}
          className="hidden w-[320px] shrink-0 xl:w-[340px] lg:flex"
        />
      </div>

      <div className="shrink-0 border-t border-slate-200/90 lg:hidden">
        <PmsCalendarSelectedDayPanel
          selectedDay={selectedDay}
          tasks={selectedDayTasks}
          unscheduled={[]}
          onOpenTask={openTask}
          className="max-h-[min(50vh,420px)] border-l-0"
        />
      </div>
    </div>
  );
}
