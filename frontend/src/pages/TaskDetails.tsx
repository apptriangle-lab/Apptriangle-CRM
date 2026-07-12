import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { Task, TaskStatus } from "@/data/mockData";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { tasksApi } from "@/lib/api";
import { companiesApi, usersApi } from "@/lib/api";
import { TaskDetailsSkeleton } from "@/components/tasks/TaskDetailsSkeleton";
import { Button } from "@/components/ui/button";
import { CheckSquare, ChevronLeft } from "lucide-react";
import { readTasksListSearch, tasksListPathFromSearch } from "@/utils/crmTasksListFilters";
import { TaskDetailsHeader } from "@/components/tasks/TaskDetailsHeader";
import { TaskDetailsStatusCard } from "@/components/tasks/TaskDetailsStatusCard";
import { TaskDetailsNoteCard } from "@/components/tasks/TaskDetailsNoteCard";
import { TaskDetailsActivityTimeline } from "@/components/tasks/TaskDetailsActivityTimeline";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskDeleteConfirmModal } from "@/components/tasks/TaskDeleteConfirmModal";
import { toast } from "sonner";
import { TaskActivityLog } from "@/data/mockData";

function toTask(d: {
  id: string;
  title: string;
  note: string | null;
  companyId: string;
  dueDatetime: string;
  assignByUserId: string;
  assignToUserId: string;
  status: string;
  createdAt: string;
}): Task {
  return {
    id: d.id,
    title: d.title,
    note: d.note,
    companyId: d.companyId,
    dueDatetime: d.dueDatetime,
    assignByUserId: d.assignByUserId ?? "",
    assignToUserId: d.assignToUserId ?? "",
    status: d.status as Task["status"],
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
  };
}

function toLog(d: {
  id: string;
  taskId: string;
  actionType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  actorUserId: string;
  createdAt: string;
}): TaskActivityLog {
  return {
    id: d.id,
    taskId: d.taskId,
    actionType: d.actionType as TaskActivityLog["actionType"],
    oldValue: d.oldValue,
    newValue: d.newValue,
    note: d.note,
    actorUserId: d.actorUserId,
    createdAt: d.createdAt,
  };
}

export default function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const goBackToTasks = () => {
    const from =
      (location.state as { fromTasksSearch?: string } | null)?.fromTasksSearch ??
      readTasksListSearch();
    navigate(tasksListPathFromSearch(from));
  };

  const { isPageScopeAdmin } = useRbac();
  const tasksScopeAdmin = isPageScopeAdmin("tasks");
  const { getTask, changeStatus, deleteTask } = useTaskStore();
  const { taskStatuses } = useStatusConfig();

  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<TaskActivityLog[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reloadTask = useCallback(async (taskId: string) => {
    const [taskRes, logsRes] = await Promise.all([tasksApi.get(taskId), tasksApi.logs(taskId)]);
    setTask(toTask(taskRes));
    setLogs(
      logsRes.map(toLog).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const fromStore = getTask(id);
    if (fromStore) {
      setTask(fromStore);
      setLoading(false);
    }
    Promise.all([tasksApi.get(id), tasksApi.logs(id), companiesApi.list(), usersApi.list()])
      .then(([taskRes, logsRes, companiesRes, usersRes]) => {
        setTask(toTask(taskRes));
        setLogs(
          logsRes.map(toLog).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        );
        setCompanies(companiesRes.map((c) => ({ id: c.id, name: c.name })));
        setUsers(usersRes.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => setTask(null))
      .finally(() => setLoading(false));
  }, [id, getTask]);

  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name ?? "—";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";

  if (loading && !task) {
    return (
      <Layout>
        <TaskDetailsSkeleton />
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <div className="-m-6 flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-[#f8f9fb] px-6 text-center">
          <CheckSquare className="mb-4 h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-900">Task not found</h2>
          <p className="mt-1 text-[13px] text-slate-500">This task may have been removed or you lack access.</p>
          <Button
            type="button"
            variant="outline"
            onClick={goBackToTasks}
            className="mt-6 h-9 gap-2 rounded-lg border-slate-200 text-[13px]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to tasks
          </Button>
        </div>
      </Layout>
    );
  }

  const canEdit =
    tasksScopeAdmin ||
    (task.status !== "completed" &&
      (task.assignByUserId === user?.id || task.assignToUserId === user?.id));
  const canChangeStatus =
    tasksScopeAdmin || task.assignByUserId === user?.id || task.assignToUserId === user?.id;

  const createdLabel = new Date(task.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" });

  const handleStatusChange = async (newStatus: string) => {
    if (!canChangeStatus) {
      toast.error("You don't have permission to change this task's status.");
      return;
    }
    if (task.status === "completed" && !tasksScopeAdmin) {
      toast.error("Completed tasks can only be modified with Tasks admin access.");
      return;
    }
    try {
      await changeStatus(task.id, newStatus as TaskStatus, user!.id);
      await reloadTask(task.id);
      toast.success(`Status changed to ${newStatus.replace("_", " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change status");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success("Task deleted");
      setDeleteOpen(false);
      goBackToTasks();
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        <TaskDetailsHeader
          title={task.title}
          companyName={getCompanyName(task.companyId)}
          status={task.status}
          taskStatuses={taskStatuses}
          dueDatetime={task.dueDatetime}
          assignByUserId={task.assignByUserId}
          assignByName={getUserName(task.assignByUserId)}
          assignToUserId={task.assignToUserId}
          assignToName={getUserName(task.assignToUserId)}
          createdLabel={createdLabel}
          canEdit={canEdit}
          canChangeStatus={canChangeStatus}
          onBack={goBackToTasks}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onStatusChange={handleStatusChange}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="shrink-0">
                <TaskDetailsNoteCard note={task.note} />
              </div>
              <TaskDetailsActivityTimeline
                className="min-h-0 flex-1 basis-0"
                logs={logs}
                getUserName={getUserName}
              />
            </div>

            <div className="w-full shrink-0 md:w-72">
              <TaskDetailsStatusCard
                status={task.status}
                taskStatuses={taskStatuses}
                dueDatetime={task.dueDatetime}
                companyName={getCompanyName(task.companyId)}
                assignByUserId={task.assignByUserId}
                assignByName={getUserName(task.assignByUserId)}
                assignToUserId={task.assignToUserId}
                assignToName={getUserName(task.assignToUserId)}
                createdLabel={createdLabel}
                canChangeStatus={canChangeStatus}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        </div>
      </div>

      <TaskFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        editingId={task.id}
        onSuccess={() => void reloadTask(task.id)}
      />

      <TaskDeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        taskTitle={task.title}
        deleting={deleting}
        onConfirm={handleDelete}
      />
    </Layout>
  );
}
