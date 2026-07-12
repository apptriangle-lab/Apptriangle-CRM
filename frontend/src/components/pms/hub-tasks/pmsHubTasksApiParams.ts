import type { AssigneeFilter } from "@/lib/pmsViewFiltersStorage";

export function resolveHubProjectMemberUserId(
  assigneeFilter: AssigneeFilter,
  currentUserId?: string,
): string | undefined {
  if (assigneeFilter === "all") return undefined;
  if (assigneeFilter === "me") return currentUserId;
  return assigneeFilter;
}

export function buildHubProjectsApiParams(opts: {
  assigneeFilter: AssigneeFilter;
  currentUserId?: string;
  companyFilter?: string;
  page?: number;
  perPage?: number;
  forFilter?: boolean;
}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: opts.page ?? 1,
    perPage: opts.perPage ?? 500,
  };
  const userId = resolveHubProjectMemberUserId(opts.assigneeFilter, opts.currentUserId);
  if (userId) params.userId = userId;
  if (opts.companyFilter && opts.companyFilter !== "all") {
    params.companyId = opts.companyFilter;
  }
  if (opts.forFilter) params.forFilter = "true";
  return params;
}

export function getHubProjectFilterAllSubtitle(assigneeFilter: AssigneeFilter): string {
  if (assigneeFilter === "me") return "Your projects with tasks";
  if (assigneeFilter === "all") return "Tasks across every project";
  return "Projects this user belongs to";
}

export function buildHubTasksApiParams(opts: {
  search?: string;
  projectFilter: string;
  assigneeFilter: AssigneeFilter;
  companyFilter?: string;
  page?: number;
  perPage?: number;
  forceMine?: boolean;
}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: opts.page ?? 1,
    perPage: opts.perPage ?? 500,
  };

  const search = opts.search?.trim();
  if (search) params.search = search;

  if (opts.projectFilter !== "all") {
    params.projectId = opts.projectFilter;
  }

  if (opts.companyFilter && opts.companyFilter !== "all") {
    params.companyId = opts.companyFilter;
  }

  if (opts.forceMine || opts.assigneeFilter === "me") {
    params.mine = "true";
  } else if (opts.assigneeFilter !== "all") {
    params.assignedTo = opts.assigneeFilter;
  }

  return params;
}
