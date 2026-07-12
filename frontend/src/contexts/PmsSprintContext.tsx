import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  appendSprintFilterParams,
  pmsApi,
  type PmsSprintDto,
  type PmsSprintFilter,
} from "@/lib/pmsApi";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { resolveSprintFilter } from "@/components/pms/sprints/pmsSprintUtils";

const STORAGE_PREFIX = "pms_sprint_filter_";

type PmsSprintContextValue = {
  sprints: PmsSprintDto[];
  loading: boolean;
  sprintFilter: PmsSprintFilter;
  setSprintFilter: (filter: PmsSprintFilter) => void;
  activeSprint: PmsSprintDto | null;
  refreshSprints: () => Promise<void>;
  appendSprintToParams: (params: Record<string, string | number>) => Record<string, string | number>;
  getSprintById: (id: string) => PmsSprintDto | undefined;
};

const PmsSprintContext = createContext<PmsSprintContextValue | null>(null);

function readStoredFilter(projectId: string): PmsSprintFilter {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    return raw ? (raw as PmsSprintFilter) : "backlog";
  } catch {
    return "backlog";
  }
}

export function PmsSprintProvider({ children }: { children: ReactNode }) {
  const { projectId } = usePmsProject();
  const [sprints, setSprints] = useState<PmsSprintDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [sprintFilter, setSprintFilterState] = useState<PmsSprintFilter>("backlog");

  useEffect(() => {
    if (!projectId) return;
    setSprintFilterState(readStoredFilter(projectId));
  }, [projectId]);

  const setSprintFilter = useCallback(
    (filter: PmsSprintFilter) => {
      setSprintFilterState(filter);
      if (projectId) {
        try {
          sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, filter);
        } catch {
          /* ignore */
        }
      }
    },
    [projectId],
  );

  const refreshSprints = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await pmsApi.listSprints(projectId);
      setSprints(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sprints");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshSprints();
  }, [refreshSprints]);

  useEffect(() => {
    if (!projectId || loading) return;
    const needsResolve =
      sprintFilter === "all" ||
      (sprintFilter !== "backlog" && !sprints.some((s) => s.id === sprintFilter));
    if (!needsResolve) return;
    const resolved = resolveSprintFilter(sprintFilter, sprints);
    if (resolved === sprintFilter) return;
    setSprintFilterState(resolved);
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, resolved);
    } catch {
      /* ignore */
    }
  }, [projectId, sprints, sprintFilter, loading]);

  const activeSprint = useMemo(
    () => sprints.find((s) => s.status === "active") ?? null,
    [sprints],
  );

  const appendSprintToParams = useCallback(
    (params: Record<string, string | number>) => appendSprintFilterParams(params, sprintFilter),
    [sprintFilter],
  );

  const getSprintById = useCallback((id: string) => sprints.find((s) => s.id === id), [sprints]);

  const value = useMemo(
    () => ({
      sprints,
      loading,
      sprintFilter,
      setSprintFilter,
      activeSprint,
      refreshSprints,
      appendSprintToParams,
      getSprintById,
    }),
    [
      sprints,
      loading,
      sprintFilter,
      setSprintFilter,
      activeSprint,
      refreshSprints,
      appendSprintToParams,
      getSprintById,
    ],
  );

  return <PmsSprintContext.Provider value={value}>{children}</PmsSprintContext.Provider>;
}

export function usePmsSprints() {
  const ctx = useContext(PmsSprintContext);
  if (!ctx) {
    throw new Error("usePmsSprints must be used within PmsSprintProvider");
  }
  return ctx;
}

/** Safe outside project shell (e.g. PMS hub Resource tab). */
export function usePmsSprintsOptional() {
  return useContext(PmsSprintContext);
}
