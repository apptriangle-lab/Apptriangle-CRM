import { getApiUrl, getStoredToken } from "@/lib/api";

async function pmsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const base = getApiUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? res.statusText ?? "Request failed";
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data as T;
}

async function fetchPmsAttachmentBlob(taskId: string, attachmentId: string): Promise<Blob> {
  const token = getStoredToken();
  const base = getApiUrl();
  const url = `${base}/api/pms/tasks/${taskId}/attachments/${attachmentId}/download`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Download failed");
  }
  return res.blob();
}

async function fetchPmsProjectAttachmentBlob(projectId: string, attachmentId: string): Promise<Blob> {
  const token = getStoredToken();
  const base = getApiUrl();
  const url = `${base}/api/pms/projects/${projectId}/attachments/${attachmentId}/download`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Download failed");
  }
  return res.blob();
}

export type PmsProjectDto = {
  id: string;
  projectCode: string;
  title: string;
  description: string;
  companyId: string | null;
  companyName?: string | null;
  projectTypeId?: string | null;
  projectTypeName?: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  priority: string;
  progress: number;
  createdBy: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  memberCount?: number;
  isStarred?: boolean;
  updatedAt?: string | null;
  members?: PmsMemberDto[];
  taskStats?: {
    total: number;
    completed: number;
    cancelled?: number;
    nonCancelled?: number;
    progressPercentage?: number;
  };
};

export type PmsMemberDto = {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  roleLabel?: string | null;
  invitedBy?: string | null;
  joinedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PmsTaskDto = {
  id: string;
  projectId: string;
  projectTitle?: string;
  parentTaskId: string | null;
  sprintId?: string | null;
  title: string;
  description: string;
  assignedTo: string | null;
  assigneeName?: string | null;
  assignees?: PmsTaskAssigneeDto[];
  status: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  completedAt: string | null;
  deletedAt?: string | null;
  parentTitle?: string | null;
  createdBy?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  subTaskCount?: number;
  attachmentCount?: number;
  comments?: { id: string; userId: string; userName?: string; comment: string; createdAt: string }[];
  subTasks?: PmsTaskDto[];
  attachments?: PmsTaskAttachmentDto[];
};

export type PmsTaskAssigneeDto = {
  id?: string;
  taskId?: string;
  userId: string;
  userName?: string | null;
  assignedBy?: string | null;
  createdAt?: string | null;
};

export type PmsTaskAttachmentDto = {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt?: string | null;
  downloadUrl?: string;
};

export type PmsProjectDocumentSource = "task" | "project";

export type PmsProjectDocumentDto = {
  id: string;
  projectId: string;
  taskId?: string | null;
  source: PmsProjectDocumentSource;
  uploadedBy: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt?: string | null;
  downloadUrl?: string;
  taskTitle?: string | null;
  uploadedByName?: string | null;
};

export type PmsProjectDashboardDto = {
  canInviteMembers: boolean;
  project: {
    id: string;
    projectCode: string;
    title: string;
    status: string;
    priority: string;
    progress: number;
    createdBy?: string;
    startDate: string | null;
    endDate: string | null;
    companyName: string | null;
    description: string;
  };
  kpis: {
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    memberCount: number;
    myAssignedTasks: number;
  };
  tasksByStatus: Record<string, number>;
  overdueTasks: PmsTaskDto[];
  upcomingTasks: PmsTaskDto[];
  recentTasks: PmsTaskDto[];
  myTasks: PmsTaskDto[];
};

export type PmsGlobalDashboardAdminDto = {
  scope: "admin";
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  overdueTasks: number;
  tasksByStatus: Record<string, number>;
};

export type PmsGlobalDashboardUserDto = {
  scope: "user";
  invitedProjects: number;
  assignedTasks: number;
  countsByStatus: Record<string, number>;
  overdue: PmsTaskDto[];
  upcoming: PmsTaskDto[];
};

export type PmsGlobalDashboardDto = PmsGlobalDashboardAdminDto | PmsGlobalDashboardUserDto;

export type PmsMyTasksSummaryDto = {
  countsByStatus: Record<string, number>;
  overdue: PmsTaskDto[];
  upcoming: PmsTaskDto[];
  recentCompleted: PmsTaskDto[];
  totalAssigned: number;
};

export type PmsPermissionsDto = {
  isSystemAdmin: boolean;
  isPmsAdmin: boolean;
  canCreateProject: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canViewResource: boolean;
  canViewHubDashboard: boolean;
  canCreateTask: boolean;
  canUpdateTask: boolean;
  canUpdateTaskStatus: boolean;
  canDeleteTask: boolean;
  canManageDeletedTasks: boolean;
  canInviteMember: boolean;
};

export type PmsTaskDeleteResult = {
  ok: boolean;
  deletedTaskIds: string[];
  count: number;
};

export type PmsTaskRestoreResult = {
  ok: boolean;
  restoredTaskIds: string[];
  count: number;
};

export type PmsDeletedTasksResult = {
  items: PmsTaskDto[];
  total: number;
};

export type PmsBulkUpdateTasksResult = {
  updated: number;
  failed: number;
  results: { taskId: string; ok: boolean; error?: string }[];
  tasks: PmsTaskDto[];
};

export type PmsSprintDto = {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  sortOrder: number;
  taskCount?: number;
  createdBy?: string;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PmsSprintFilter = "all" | "backlog" | string;

export type PmsResourceDaySummary = {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
};

export type PmsResourceTaskDto = PmsTaskDto & {
  sprintName?: string | null;
};

export type PmsResourceProjectDto = {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  status: string;
  taskCount: number;
  tasks: PmsResourceTaskDto[];
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  tasksByDateSummary?: Record<string, PmsResourceDaySummary>;
};

export type PmsResourceUserProjectPreview = {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  status: string;
  priority?: string;
  companyName?: string | null;
  taskCount: number;
};

export type PmsResourceUserDto = {
  userId: string;
  userName: string | null;
  userEmail?: string | null;
  taskCount: number;
  projectCount: number;
  projects?: PmsResourceUserProjectPreview[];
  tasks: PmsResourceTaskDto[];
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  tasksByDateSummary?: Record<string, PmsResourceDaySummary>;
};

export type PmsResourceOverviewDto = {
  from: string;
  to: string;
  users: PmsResourceUserDto[];
  summary: {
    userCount: number;
    taskCount: number;
  };
};

export type PmsResourceActivityDto = {
  userId: string;
  userName: string | null;
  from: string;
  to: string;
  projects: PmsResourceProjectDto[];
  summary: {
    projectCount: number;
    taskCount: number;
  };
};

export const pmsApi = {
  getPermissions: () => pmsRequest<PmsPermissionsDto>("/api/pms/permissions"),
  getDashboard: () => pmsRequest<PmsGlobalDashboardDto>("/api/pms/dashboard"),
  listProjects: (params?: Record<string, string | number | string[]>) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === "" || v == null) return;
        if (Array.isArray(v)) {
          if (v.length) q.set(k, v.join(","));
          return;
        }
        q.set(k, String(v));
      });
    }
    const qs = q.toString();
    return pmsRequest<{ items: PmsProjectDto[]; total: number; page: number; perPage: number }>(
      `/api/pms/projects${qs ? `?${qs}` : ""}`,
    );
  },
  getProject: (id: string) => pmsRequest<PmsProjectDto>(`/api/pms/projects/${id}`),
  getProjectDashboard: (id: string) =>
    pmsRequest<PmsProjectDashboardDto>(`/api/pms/projects/${id}/dashboard`),
  listProjectDocuments: (projectId: string, params?: { search?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return pmsRequest<{ items: PmsProjectDocumentDto[]; total: number }>(
      `/api/pms/projects/${projectId}/attachments${qs ? `?${qs}` : ""}`,
    );
  },
  uploadProjectDocument: (projectId: string, file: File) =>
    pmsRequest<PmsProjectDocumentDto>(`/api/pms/projects/${projectId}/attachments`, {
      method: "POST",
      body: (() => {
        const fd = new FormData();
        fd.append("file", file);
        return fd;
      })(),
    }),
  createProject: (body: Partial<PmsProjectDto>) =>
    pmsRequest<PmsProjectDto>("/api/pms/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: Partial<PmsProjectDto>) =>
    pmsRequest<PmsProjectDto>(`/api/pms/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProject: (id: string) => pmsRequest<{ ok: boolean }>(`/api/pms/projects/${id}`, { method: "DELETE" }),
  setProjectStarred: (projectId: string, starred: boolean) =>
    pmsRequest<{ ok: boolean; isStarred: boolean }>(`/api/pms/projects/${projectId}/star`, {
      method: "PUT",
      body: JSON.stringify({ starred }),
    }),
  inviteMember: (projectId: string, userId: string, roleLabel?: string) =>
    pmsRequest<PmsMemberDto>(`/api/pms/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId, roleLabel }),
    }),
  removeMember: (projectId: string, userId: string) =>
    pmsRequest<{ ok: boolean }>(`/api/pms/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  listSprints: (projectId: string, params?: Record<string, string>) => {
    const q = new URLSearchParams(params);
    const qs = q.toString();
    return pmsRequest<{ items: PmsSprintDto[]; total: number }>(
      `/api/pms/projects/${projectId}/sprints${qs ? `?${qs}` : ""}`,
    );
  },
  getSprint: (projectId: string, sprintId: string) =>
    pmsRequest<PmsSprintDto>(`/api/pms/projects/${projectId}/sprints/${sprintId}`),
  createSprint: (projectId: string, body: Partial<PmsSprintDto>) =>
    pmsRequest<PmsSprintDto>(`/api/pms/projects/${projectId}/sprints`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSprint: (projectId: string, sprintId: string, body: Partial<PmsSprintDto>) =>
    pmsRequest<PmsSprintDto>(`/api/pms/projects/${projectId}/sprints/${sprintId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSprint: (projectId: string, sprintId: string) =>
    pmsRequest<{ ok: boolean }>(`/api/pms/projects/${projectId}/sprints/${sprintId}`, { method: "DELETE" }),
  assignTasksToSprint: (projectId: string, sprintId: string, taskIds: string[]) =>
    pmsRequest<{ updated: number; sprint: PmsSprintDto }>(
      `/api/pms/projects/${projectId}/sprints/${sprintId}/tasks`,
      { method: "PATCH", body: JSON.stringify({ taskIds }) },
    ),
  listTasks: (params?: Record<string, string | number>) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== "" && v != null) q.set(k, String(v));
      });
    }
    const qs = q.toString();
    return pmsRequest<{ items: PmsTaskDto[]; total: number; page: number; perPage: number }>(
      `/api/pms/tasks${qs ? `?${qs}` : ""}`,
    );
  },
  getTask: (id: string) => pmsRequest<PmsTaskDto>(`/api/pms/tasks/${id}`),
  createTask: (
    body: Partial<PmsTaskDto> & { assigneeIds?: string[] },
  ) => pmsRequest<PmsTaskDto>("/api/pms/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<PmsTaskDto>) =>
    pmsRequest<PmsTaskDto>(`/api/pms/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTask: (id: string) =>
    pmsRequest<PmsTaskDeleteResult>(`/api/pms/tasks/${id}`, { method: "DELETE" }),
  listDeletedTasks: (projectId: string) =>
    pmsRequest<PmsDeletedTasksResult>(`/api/pms/tasks/deleted?projectId=${encodeURIComponent(projectId)}`),
  restoreTask: (id: string) =>
    pmsRequest<PmsTaskRestoreResult>(`/api/pms/tasks/${id}/restore`, { method: "POST" }),
  permanentDeleteTask: (id: string) =>
    pmsRequest<PmsTaskDeleteResult>(`/api/pms/tasks/${id}/permanent`, { method: "DELETE" }),
  patchTaskStatus: (id: string, status: string) =>
    pmsRequest<PmsTaskDto>(`/api/pms/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  bulkUpdateTasks: (body: {
    taskIds: string[];
    status?: string;
    priority?: string;
    assigneeIds?: string[];
  }) =>
    pmsRequest<PmsBulkUpdateTasksResult>("/api/pms/tasks/bulk-update", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  addComment: (taskId: string, comment: string) =>
    pmsRequest<{ id: string; comment: string }>(`/api/pms/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  getKanban: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params);
    const qs = q.toString();
    return pmsRequest<{ columns: Record<string, PmsTaskDto[]> }>(`/api/pms/kanban${qs ? `?${qs}` : ""}`);
  },
  getMyTasks: () => pmsRequest<PmsMyTasksSummaryDto>("/api/pms/my-tasks"),
  getResourceOverview: (params: { from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return pmsRequest<PmsResourceOverviewDto>(`/api/pms/resources?${q.toString()}`);
  },
  getResourceActivity: (params: { userId: string; from: string; to: string }) => {
    const q = new URLSearchParams({
      userId: params.userId,
      from: params.from,
      to: params.to,
    });
    return pmsRequest<PmsResourceActivityDto>(`/api/pms/resources?${q.toString()}`);
  },
  uploadAttachment: (taskId: string, file: File) =>
    pmsRequest<PmsTaskAttachmentDto>(`/api/pms/tasks/${taskId}/attachments`, {
      method: "POST",
      body: (() => {
        const fd = new FormData();
        fd.append("file", file);
        return fd;
      })(),
    }),

  downloadAttachment: async (taskId: string, attachmentId: string, fileName: string) => {
    const blob = await fetchPmsAttachmentBlob(taskId, attachmentId);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },

  openAttachment: async (taskId: string, attachmentId: string) => {
    const blob = await fetchPmsAttachmentBlob(taskId, attachmentId);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },

  downloadProjectDocument: async (projectId: string, attachmentId: string, fileName: string) => {
    const blob = await fetchPmsProjectAttachmentBlob(projectId, attachmentId);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },

  openProjectDocument: async (projectId: string, attachmentId: string) => {
    const blob = await fetchPmsProjectAttachmentBlob(projectId, attachmentId);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },
};

export const PMS_PROJECT_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const PMS_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const PMS_SPRINT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** Append sprintId query param when filtering by sprint or backlog. */
export function appendSprintFilterParams(
  params: Record<string, string | number>,
  sprintFilter: PmsSprintFilter,
): Record<string, string | number> {
  if (sprintFilter === "all") return params;
  return { ...params, sprintId: sprintFilter };
}

/** Human-readable label for a PMS task status value from Settings. */
export function formatPmsTaskStatusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
