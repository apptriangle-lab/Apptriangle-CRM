import { createContext, useContext, useMemo, type ReactNode } from "react";
import { PMS_MY_TASKS_FILTER_SCOPE } from "@/lib/pmsMyTasksScope";

export type PmsTaskViewMode = "project" | "my-tasks";

type PmsTaskViewContextValue = {
  mode: PmsTaskViewMode;
  filterScopeId: string;
  isMyTasks: boolean;
};

const PmsTaskViewContext = createContext<PmsTaskViewContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  mode: PmsTaskViewMode;
  filterScopeId?: string;
};

export function PmsTaskViewProvider({ children, mode, filterScopeId }: ProviderProps) {
  const value = useMemo(
    () => ({
      mode,
      filterScopeId:
        filterScopeId ?? (mode === "my-tasks" ? PMS_MY_TASKS_FILTER_SCOPE : ""),
      isMyTasks: mode === "my-tasks",
    }),
    [mode, filterScopeId],
  );

  return <PmsTaskViewContext.Provider value={value}>{children}</PmsTaskViewContext.Provider>;
}

export function usePmsTaskViewContext(): PmsTaskViewContextValue {
  const ctx = useContext(PmsTaskViewContext);
  if (!ctx) {
    return {
      mode: "project",
      filterScopeId: "",
      isMyTasks: false,
    };
  }
  return ctx;
}
