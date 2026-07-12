import { getApiUrl, getStoredToken } from "@/lib/api";

export type ProjectTypeDto = {
  id: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

async function settingsRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const base = getApiUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? res.statusText ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

/** Settings + PMS APIs for project type lookup values. */
export const settingsService = {
  listProjectTypes: () =>
    settingsRequest<ProjectTypeDto[]>("/api/pms/project-types"),

  listAllProjectTypes: () =>
    settingsRequest<ProjectTypeDto[]>("/api/pms/project-types/all"),

  createProjectType: (body: { name: string }) =>
    settingsRequest<ProjectTypeDto>("/api/pms/project-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateProjectType: (id: string, body: { name?: string; isActive?: boolean }) =>
    settingsRequest<ProjectTypeDto>(`/api/pms/project-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteProjectType: (id: string) =>
    settingsRequest<{ ok: boolean }>(`/api/pms/project-types/${id}`, { method: "DELETE" }),
};
