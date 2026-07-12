import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { pmsApi, type PmsProjectDto } from "@/lib/pmsApi";

type PmsProjectContextValue = {
  projectId: string;
  project: PmsProjectDto | null;
  loading: boolean;
  basePath: string;
  refreshProject: () => Promise<void>;
};

export const PmsProjectContext = createContext<PmsProjectContextValue | null>(null);

export function PmsProjectProvider({ children }: { children: React.ReactNode }) {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<PmsProjectDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProject = useCallback(async () => {
    if (!projectId) return;
    const data = await pmsApi.getProject(projectId);
    setProject(data);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshProject()
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId, refreshProject]);

  const value = useMemo(
    () => ({
      projectId,
      project,
      loading,
      basePath: `/pms/projects/${projectId}`,
      refreshProject,
    }),
    [projectId, project, loading, refreshProject],
  );

  return <PmsProjectContext.Provider value={value}>{children}</PmsProjectContext.Provider>;
}

export function usePmsProject() {
  const ctx = useContext(PmsProjectContext);
  if (!ctx) throw new Error("usePmsProject must be used within PmsProjectProvider");
  return ctx;
}

export function usePmsProjectOptional() {
  return useContext(PmsProjectContext);
}
