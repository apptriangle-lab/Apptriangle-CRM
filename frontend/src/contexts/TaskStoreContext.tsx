import React, { createContext, useContext, useState, useCallback } from "react";
import { Task, TaskStatus } from "@/data/mockData";
import { tasksApi, TaskDto } from "@/lib/api";

function toTask(d: TaskDto): Task {
  return {
    id: d.id,
    title: d.title,
    note: d.note,
    companyId: d.companyId,
    dueDatetime: d.dueDatetime,
    assignByUserId: d.assignByUserId ?? "",
    assignToUserId: d.assignToUserId ?? "",
    status: d.status as TaskStatus,
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
  };
}

export type TaskListParams = {
  status?: string;
  companyId?: string;
  assignToUserId?: string;
  assignByUserId?: string;
  search?: string;
};

interface TaskStoreContextType {
  tasks: Task[];
  fetchTasks: (params?: TaskListParams) => Promise<void>;
  addTask: (task: Omit<Task, "id" | "createdAt" | "status">, actorUserId: string) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Pick<Task, "title" | "note" | "companyId" | "dueDatetime" | "assignByUserId" | "assignToUserId">>, actorUserId: string) => Promise<void>;
  changeStatus: (id: string, newStatus: TaskStatus, actorUserId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Task | undefined;
}

const TaskStoreContext = createContext<TaskStoreContextType | null>(null);

export const TaskStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = useCallback(async (params?: TaskListParams) => {
    const list = await tasksApi.list(params);
    setTasks(list.map(toTask));
  }, []);

  const addTask = useCallback(async (taskData: Omit<Task, "id" | "createdAt" | "status">, actorUserId: string) => {
    const created = await tasksApi.create({
      title: taskData.title,
      note: taskData.note ?? undefined,
      companyId: taskData.companyId,
      dueDatetime: taskData.dueDatetime,
      assignByUserId: taskData.assignByUserId || undefined,
      assignToUserId: taskData.assignToUserId || undefined,
    });
    const newTask = toTask(created);
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Pick<Task, "title" | "note" | "companyId" | "dueDatetime" | "assignByUserId" | "assignToUserId">>, actorUserId: string) => {
    const updated = await tasksApi.update(id, {
      ...updates,
      actorUserId,
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? toTask(updated) : t)));
  }, []);

  const changeStatus = useCallback(async (id: string, newStatus: TaskStatus, actorUserId: string) => {
    const updated = await tasksApi.patchStatus(id, { status: newStatus, actorUserId });
    setTasks((prev) => prev.map((t) => (t.id === id ? toTask(updated) : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await tasksApi.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getTask = useCallback((taskId: string) => tasks.find((t) => t.id === taskId), [tasks]);

  return (
    <TaskStoreContext.Provider value={{ tasks, fetchTasks, addTask, updateTask, changeStatus, deleteTask, getTask }}>
      {children}
    </TaskStoreContext.Provider>
  );
};

export const useTaskStore = () => {
  const ctx = useContext(TaskStoreContext);
  if (!ctx) throw new Error("useTaskStore must be inside TaskStoreProvider");
  return ctx;
};
