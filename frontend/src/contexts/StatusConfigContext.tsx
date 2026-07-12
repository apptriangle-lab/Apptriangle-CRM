import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  statusConfigApi,
  type OrderConfigPatchGroup,
  type OrderStatusConfigItem,
  type StatusConfigGroup,
} from "@/lib/api";

interface StatusConfigContextType {
  taskStatuses: string[];
  pmsTaskStatuses: string[];
  salesCategories: string[];
  salesStatuses: string[];
  orderStatuses: OrderStatusConfigItem[];
  orderNextTodos: OrderStatusConfigItem[];
  addStatus: (group: StatusConfigGroup, value: string) => Promise<boolean>;
  removeStatus: (group: StatusConfigGroup, value: string) => Promise<boolean>;
  patchOrderOptionActive: (group: OrderConfigPatchGroup, value: string, isActive: boolean) => Promise<boolean>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const StatusConfigContext = createContext<StatusConfigContextType | null>(null);

export const StatusConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [taskStatuses, setTaskStatuses] = useState<string[]>([]);
  const [pmsTaskStatuses, setPmsTaskStatuses] = useState<string[]>([]);
  const [salesCategories, setSalesCategories] = useState<string[]>([]);
  const [salesStatuses, setSalesStatuses] = useState<string[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusConfigItem[]>([]);
  const [orderNextTodos, setOrderNextTodos] = useState<OrderStatusConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  const applyDto = useCallback((data: {
    taskStatuses?: string[];
    pmsTaskStatuses?: string[];
    salesCategories?: string[];
    salesStatuses?: string[];
    orderStatuses?: OrderStatusConfigItem[];
    orderNextTodos?: OrderStatusConfigItem[];
  }) => {
    setTaskStatuses(data.taskStatuses ?? []);
    setPmsTaskStatuses(data.pmsTaskStatuses ?? []);
    setSalesCategories(data.salesCategories ?? []);
    setSalesStatuses(data.salesStatuses ?? []);
    setOrderStatuses(data.orderStatuses ?? []);
    setOrderNextTodos(data.orderNextTodos ?? []);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await statusConfigApi.get();
      applyDto(data);
    } catch {
      applyDto({
        taskStatuses: ["pending", "in_progress", "completed", "cancelled"],
        pmsTaskStatuses: ["to_do", "in_progress", "completed", "on_hold", "cancelled"],
        salesCategories: ["hot", "warm", "cold"],
        salesStatuses: ["lead", "prospect", "negotiation", "closed", "disqualified"],
        orderStatuses: [],
        orderNextTodos: [],
      });
    } finally {
      setLoading(false);
    }
  }, [applyDto]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addStatus = useCallback(async (group: StatusConfigGroup, value: string): Promise<boolean> => {
    try {
      const data = await statusConfigApi.add(group, value);
      applyDto(data);
      return true;
    } catch {
      return false;
    }
  }, [applyDto]);

  const removeStatus = useCallback(async (group: StatusConfigGroup, value: string): Promise<boolean> => {
    try {
      const data = await statusConfigApi.remove(group, value);
      applyDto(data);
      return true;
    } catch {
      return false;
    }
  }, [applyDto]);

  const patchOrderOptionActive = useCallback(
    async (group: OrderConfigPatchGroup, value: string, isActive: boolean): Promise<boolean> => {
      try {
        const data = await statusConfigApi.patchOrderOptionActive(group, value, isActive);
        applyDto(data);
        return true;
      } catch {
        return false;
      }
    },
    [applyDto],
  );

  return (
    <StatusConfigContext.Provider
      value={{
        taskStatuses,
        pmsTaskStatuses,
        salesCategories,
        salesStatuses,
        orderStatuses,
        orderNextTodos,
        addStatus,
        removeStatus,
        patchOrderOptionActive,
        loading,
        refetch,
      }}
    >
      {children}
    </StatusConfigContext.Provider>
  );
};

export const useStatusConfig = () => {
  const ctx = useContext(StatusConfigContext);
  if (!ctx) throw new Error("useStatusConfig must be inside StatusConfigProvider");
  return ctx;
};
