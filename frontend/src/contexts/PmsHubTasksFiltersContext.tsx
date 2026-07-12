import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  usePmsKanbanFilters,
  usePmsTasksFilters,
} from "@/hooks/usePmsViewFilters";

type PmsHubTasksFiltersContextValue = ReturnType<typeof usePmsTasksFilters> &
  Pick<ReturnType<typeof usePmsKanbanFilters>, "statusFilter" | "setStatusFilter">;

const PmsHubTasksFiltersContext = createContext<PmsHubTasksFiltersContextValue | null>(null);

/** Single shared filter state for hub my-tasks toolbar + list/kanban/calendar views. */
export function PmsHubTasksFiltersProvider({ children }: { children: ReactNode }) {
  const tasksFilters = usePmsTasksFilters();
  const { statusFilter, setStatusFilter } = usePmsKanbanFilters();

  const value = useMemo(
    () => ({
      ...tasksFilters,
      statusFilter,
      setStatusFilter,
    }),
    [tasksFilters, statusFilter, setStatusFilter],
  );

  return (
    <PmsHubTasksFiltersContext.Provider value={value}>{children}</PmsHubTasksFiltersContext.Provider>
  );
}

export function usePmsHubTasksFilters(): PmsHubTasksFiltersContextValue {
  const ctx = useContext(PmsHubTasksFiltersContext);
  if (!ctx) {
    throw new Error("usePmsHubTasksFilters must be used within PmsHubTasksFiltersProvider");
  }
  return ctx;
}

export function usePmsHubTasksFiltersOptional(): PmsHubTasksFiltersContextValue | null {
  return useContext(PmsHubTasksFiltersContext);
}
