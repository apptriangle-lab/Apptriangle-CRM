import { format, parseISO } from "date-fns";
import type {
  PmsResourceDaySummary,
  PmsResourceOverviewDto,
  PmsResourceTaskDto,
  PmsResourceUserDto,
  PmsResourceUserProjectPreview,
  PmsTaskDto,
} from "@/lib/pmsApi";
import { summarizeDayTasks } from "@/components/pms/resource/calendar/resourceCalendarDayStatus";
import { getTaskSpanDays, parseResourceDate } from "@/utils/pmsResourceDates";

export function taskOverlapsResourceRange(
  task: Pick<PmsTaskDto, "startDate" | "endDate">,
  from: string,
  to: string,
): boolean {
  const rangeFrom = parseResourceDate(from);
  const rangeTo = parseResourceDate(to);
  if (!rangeFrom || !rangeTo) return false;

  if (!task.startDate && !task.endDate) return true;

  const start = parseResourceDate(task.startDate);
  const end = parseResourceDate(task.endDate);

  if (start && end) return start <= rangeTo && end >= rangeFrom;
  if (end) return end >= rangeFrom && end <= rangeTo;
  return start! >= rangeFrom && start! <= rangeTo;
}

function collectAssigneeIds(task: PmsTaskDto): string[] {
  const ids = new Set<string>();
  if (task.assignedTo) ids.add(task.assignedTo);
  for (const assignee of task.assignees ?? []) {
    if (assignee.userId) ids.add(assignee.userId);
  }
  return [...ids];
}

function findCachedTask(
  data: PmsResourceOverviewDto,
  taskId: string,
): PmsResourceTaskDto | undefined {
  for (const user of data.users) {
    const hit = user.tasks.find((task) => task.id === taskId);
    if (hit) return hit;
  }
  return undefined;
}

function toResourceTask(task: PmsTaskDto, cached?: PmsResourceTaskDto): PmsResourceTaskDto {
  return {
    ...cached,
    ...task,
    sprintName: cached?.sprintName ?? (task as PmsResourceTaskDto).sprintName ?? null,
    projectTitle: task.projectTitle ?? cached?.projectTitle,
  };
}

function rebuildTasksByDate(
  tasks: PmsResourceTaskDto[],
  from: string,
  to: string,
): Record<string, PmsResourceTaskDto[]> {
  const rangeFrom = parseResourceDate(from);
  const rangeTo = parseResourceDate(to);
  if (!rangeFrom || !rangeTo) return {};

  const tasksByDate: Record<string, PmsResourceTaskDto[]> = {};
  const seenPerDate: Record<string, Set<string>> = {};
  const unscheduled: PmsResourceTaskDto[] = [];

  for (const task of tasks) {
    const spanDays = getTaskSpanDays(task, rangeFrom, rangeTo);
    if (!spanDays.length) {
      unscheduled.push(task);
      continue;
    }
    for (const day of spanDays) {
      const key = format(day, "yyyy-MM-dd");
      if (!seenPerDate[key]) seenPerDate[key] = new Set();
      if (seenPerDate[key].has(task.id)) continue;
      seenPerDate[key].add(task.id);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(task);
    }
  }

  if (unscheduled.length) tasksByDate.unscheduled = unscheduled;
  return tasksByDate;
}

function rebuildTasksByDateSummary(
  tasksByDate: Record<string, PmsResourceTaskDto[]>,
): Record<string, PmsResourceDaySummary> {
  const summaries: Record<string, PmsResourceDaySummary> = {};
  for (const [key, dayTasks] of Object.entries(tasksByDate)) {
    if (key === "unscheduled" || !dayTasks.length) continue;
    summaries[key] = summarizeDayTasks(dayTasks, parseISO(key));
  }
  return summaries;
}

function finalizeUserRow(
  user: PmsResourceUserDto,
  tasks: PmsResourceTaskDto[],
  from: string,
  to: string,
): PmsResourceUserDto {
  const tasksByDate = rebuildTasksByDate(tasks, from, to);
  const projects = rebuildProjectsFromTasks(user.projects, tasks);
  return {
    ...user,
    tasks,
    taskCount: tasks.length,
    projectCount: projects.length > 0 ? projects.length : user.projectCount,
    projects,
    tasksByDate,
    tasksByDateSummary: rebuildTasksByDateSummary(tasksByDate),
  };
}

function rebuildProjectsFromTasks(
  existing: PmsResourceUserProjectPreview[] | undefined,
  tasks: PmsResourceTaskDto[],
): PmsResourceUserProjectPreview[] {
  const apiById = new Map((existing ?? []).map((project) => [project.projectId, project]));
  const byProject = new Map<string, PmsResourceUserProjectPreview>();

  for (const task of tasks) {
    if (!task.projectId) continue;
    const current = byProject.get(task.projectId);
    if (current) {
      current.taskCount += 1;
      continue;
    }
    const meta = apiById.get(task.projectId);
    byProject.set(
      task.projectId,
      meta
        ? { ...meta, taskCount: 1 }
        : {
            projectId: task.projectId,
            projectCode: "",
            projectTitle: task.projectTitle?.trim() || "Project",
            status: "",
            taskCount: 1,
          },
    );
  }

  for (const project of existing ?? []) {
    if (!project.projectId || byProject.has(project.projectId)) continue;
    byProject.set(project.projectId, { ...project, taskCount: project.taskCount ?? 0 });
  }

  return [...byProject.values()].sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
}

function removeTaskFromUser(
  user: PmsResourceUserDto,
  taskId: string,
  from: string,
  to: string,
): PmsResourceUserDto {
  const tasks = user.tasks.filter((task) => task.id !== taskId);
  return finalizeUserRow(user, tasks, from, to);
}

function upsertTaskOnUser(
  user: PmsResourceUserDto,
  task: PmsResourceTaskDto,
  from: string,
  to: string,
): PmsResourceUserDto {
  const exists = user.tasks.some((t) => t.id === task.id);
  const tasks = exists
    ? user.tasks.map((t) => (t.id === task.id ? task : t))
    : [...user.tasks, task];
  return finalizeUserRow(user, tasks, from, to);
}

/** Patch resource overview cache after task create/update. Return null when refetch needed. */
export function applyResourceOverviewUpdate(
  data: PmsResourceOverviewDto,
  updated: PmsTaskDto,
): PmsResourceOverviewDto | null {
  const overlaps = taskOverlapsResourceRange(updated, data.from, data.to);
  const assigneeIds = collectAssigneeIds(updated);
  const cached = findCachedTask(data, updated.id);
  const resourceTask = toResourceTask(updated, cached);

  if (overlaps && assigneeIds.some((id) => !data.users.some((user) => user.userId === id))) {
    return null;
  }

  let users = data.users.map((user) =>
    user.tasks.some((task) => task.id === updated.id)
      ? removeTaskFromUser(user, updated.id, data.from, data.to)
      : user,
  );

  if (overlaps) {
    for (const userId of assigneeIds) {
      const idx = users.findIndex((user) => user.userId === userId);
      if (idx < 0) return null;
      users[idx] = upsertTaskOnUser(users[idx], resourceTask, data.from, data.to);
    }
  }

  return {
    ...data,
    users,
    summary: {
      userCount: users.length,
      taskCount: users.reduce((sum, user) => sum + user.taskCount, 0),
    },
  };
}
