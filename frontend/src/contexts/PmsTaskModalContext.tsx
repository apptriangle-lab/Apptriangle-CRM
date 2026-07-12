import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PmsResourceOverviewDto, PmsTaskDto } from "@/lib/pmsApi";
import { PmsTaskDetailModal } from "@/components/pms/PmsTaskDetailModal";
import { applyResourceOverviewUpdate } from "@/utils/pmsResourceCache";

type TaskUpdateListener = (task: PmsTaskDto) => void;
type TaskDeleteListener = (deletedIds: string[]) => void;

type PmsTaskModalContextValue = {
  taskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  subscribeTaskUpdates: (listener: TaskUpdateListener) => () => void;
  subscribeTaskDeletes: (listener: TaskDeleteListener) => () => void;
  notifyTaskUpdated: (task: PmsTaskDto) => void;
  notifyTaskDeleted: (deletedIds: string[]) => void;
};

const PmsTaskModalContext = createContext<PmsTaskModalContextValue | null>(null);

export function PmsTaskModalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);
  const listenersRef = useRef(new Set<TaskUpdateListener>());
  const deleteListenersRef = useRef(new Set<TaskDeleteListener>());

  const subscribeTaskUpdates = useCallback((listener: TaskUpdateListener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const subscribeTaskDeletes = useCallback((listener: TaskDeleteListener) => {
    deleteListenersRef.current.add(listener);
    return () => deleteListenersRef.current.delete(listener);
  }, []);

  const notifyTaskUpdated = useCallback(
    (task: PmsTaskDto) => {
      listenersRef.current.forEach((listener) => listener(task));

      const cachedQueries = queryClient.getQueriesData<PmsResourceOverviewDto>({
        queryKey: ["pms-resources-overview"],
      });
      const hasCached = cachedQueries.some(([, data]) => Boolean(data));

      let needsRefetch = false;
      queryClient.setQueriesData<PmsResourceOverviewDto>(
        { queryKey: ["pms-resources-overview"] },
        (old) => {
          if (!old) return old;
          const next = applyResourceOverviewUpdate(old, task);
          if (!next) {
            needsRefetch = true;
            return old;
          }
          return next;
        },
      );

      if (needsRefetch) {
        void queryClient.invalidateQueries({
          queryKey: ["pms-resources-overview"],
          refetchType: "active",
        });
      } else if (!hasCached) {
        void queryClient.invalidateQueries({
          queryKey: ["pms-resources-overview"],
          refetchType: "none",
        });
      }
    },
    [queryClient],
  );

  const notifyTaskDeleted = useCallback((deletedIds: string[]) => {
    deleteListenersRef.current.forEach((listener) => listener(deletedIds));
    void queryClient.invalidateQueries({
      queryKey: ["pms-resources-overview"],
      refetchType: "active",
    });
  }, [queryClient]);

  const openTask = useCallback((id: string) => setTaskId(id), []);
  const closeTask = useCallback(() => setTaskId(null), []);

  const value = useMemo(
    () => ({
      taskId,
      openTask,
      closeTask,
      subscribeTaskUpdates,
      subscribeTaskDeletes,
      notifyTaskUpdated,
      notifyTaskDeleted,
    }),
    [taskId, openTask, closeTask, subscribeTaskUpdates, subscribeTaskDeletes, notifyTaskUpdated, notifyTaskDeleted],
  );

  return (
    <PmsTaskModalContext.Provider value={value}>
      {children}
      <PmsTaskDetailModal
        taskId={taskId}
        open={!!taskId}
        onClose={closeTask}
        onTaskUpdated={notifyTaskUpdated}
        onTaskDeleted={notifyTaskDeleted}
      />
    </PmsTaskModalContext.Provider>
  );
}

export function usePmsTaskModal() {
  const ctx = useContext(PmsTaskModalContext);
  if (!ctx) throw new Error("usePmsTaskModal must be used within PmsTaskModalProvider");
  return ctx;
}

export function usePmsTaskModalOptional() {
  return useContext(PmsTaskModalContext);
}
