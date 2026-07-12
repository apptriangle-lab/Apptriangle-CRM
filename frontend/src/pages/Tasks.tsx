import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { TaskStatus } from "@/data/mockData";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  readFiltersFromSearchParams,
  saveTasksListSearch,
  tasksListPathFromSearch,
  writeFiltersToSearchParams,
  type CrmTasksTab,
} from "@/utils/crmTasksListFilters";
import { companiesApi, usersApi } from "@/lib/api";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { CrmTasksListToolbar } from "@/components/tasks/CrmTasksListToolbar";
import { CrmTasksListTable } from "@/components/tasks/CrmTasksListTable";
import { CrmTasksListSkeleton } from "@/components/tasks/CrmTasksListSkeleton";
import { canChangeCrmTaskStatus } from "@/components/tasks/CrmTaskStatusCell";
import { type PmsDateRange } from "@/components/pms/PmsTaskDatePicker";

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = readFiltersFromSearchParams(searchParams);
  const { user } = useAuth();
  const { isPageScopeAdmin } = useRbac();
  const tasksScopeAdmin = isPageScopeAdmin("tasks");
  const { tasks, fetchTasks, changeStatus } = useTaskStore();
  const { taskStatuses } = useStatusConfig();

  const [companies, setCompanies] = useState<{ id: string; name: string; location: string; country: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<CrmTasksTab>(initialFilters.tab);
  const [search, setSearch] = useState(initialFilters.search);
  const [filterAssignTo, setFilterAssignTo] = useState(initialFilters.filterAssignTo);
  const [filterAssignBy, setFilterAssignBy] = useState(initialFilters.filterAssignBy);
  const [filterStatus, setFilterStatus] = useState(initialFilters.filterStatus);
  const [dateRange, setDateRange] = useState(initialFilters.dateRange);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    companiesApi
      .list()
      .then((list) =>
        setCompanies(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location ?? "",
            country: c.country ?? "",
          })),
        ),
      )
      .catch(() => toast.error("Failed to load companies"));
    usersApi
      .list()
      .then((list) =>
        setUsers(
          list
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tasksScopeAdmin) {
      setFilterAssignTo("all");
      setFilterAssignBy("all");
    }
  }, [tasksScopeAdmin]);

  const urlFilterKey = searchParams.toString();

  useEffect(() => {
    const fromUrl = readFiltersFromSearchParams(searchParams);
    setTab(fromUrl.tab);
    setSearch(fromUrl.search);
    setFilterAssignTo(fromUrl.filterAssignTo);
    setFilterAssignBy(fromUrl.filterAssignBy);
    setFilterStatus(fromUrl.filterStatus);
    setDateRange(fromUrl.dateRange);
  }, [urlFilterKey, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = writeFiltersToSearchParams(searchParams, {
        tab,
        search,
        filterAssignTo,
        filterAssignBy,
        filterStatus,
        dateRange,
      });
      const qs = next.toString();
      if (qs !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
      saveTasksListSearch(qs);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tab, search, filterAssignTo, filterAssignBy, filterStatus, dateRange, searchParams, setSearchParams]);

  useEffect(() => {
    setLoading(true);
    const params: {
      status?: string;
      companyId?: string;
      assignToUserId?: string;
      assignByUserId?: string;
      search?: string;
    } = {};
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterAssignTo !== "all") params.assignToUserId = filterAssignTo;
    if (filterAssignBy !== "all") params.assignByUserId = filterAssignBy;
    if (search.trim()) params.search = search.trim();
    fetchTasks(params)
      .catch(() => toast.error("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, [filterAssignTo, filterAssignBy, filterStatus, search, fetchTasks]);

  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name ?? "—";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";

  const now = useMemo(() => new Date(), [tasks, tab, dateRange]);

  const dateFilteredTasks = useMemo(() => {
    let list = tasks;
    if (dateRange.from) {
      list = list.filter((t) => new Date(t.endDatetime) >= dateRange.from!);
    }
    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.endDatetime) <= endOfDay);
    }
    return list;
  }, [tasks, dateRange]);

  const filtered = useMemo(() => {
    let list = dateFilteredTasks;
    if (tab === "pending") {
      list = list.filter((t) => t.status !== "completed" && t.status !== "cancelled");
    } else if (tab === "completed") {
      list = list.filter((t) => t.status === "completed");
    }
    return list;
  }, [dateFilteredTasks, tab]);

  const tabCounts = useMemo(
    () => ({
      pending: dateFilteredTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length,
      completed: dateFilteredTasks.filter((t) => t.status === "completed").length,
      all: dateFilteredTasks.length,
    }),
    [dateFilteredTasks],
  );

  const openCreate = () => {
    setEditingId(null);
    setOpen(true);
  };

  const navigateToTask = (taskId: string) => {
    const listSearch = writeFiltersToSearchParams(searchParams, {
      tab,
      search,
      filterAssignTo,
      filterAssignBy,
      filterStatus,
      dateRange,
    }).toString();
    saveTasksListSearch(listSearch);
    const listPath = tasksListPathFromSearch(listSearch);
    window.history.replaceState(window.history.state, "", listPath);
    navigate(`/tasks/${taskId}`, { state: { fromTasksSearch: listSearch } });
  };

  const hasActiveFilters =
    Boolean(search) ||
    filterAssignTo !== "all" ||
    filterAssignBy !== "all" ||
    filterStatus !== "all" ||
    Boolean(dateRange.from) ||
    Boolean(dateRange.to);

  const dueDateRangeFilter = useMemo<PmsDateRange>(
    () => ({
      startDate: dateRange.from ?? null,
      endDate: dateRange.to ?? null,
    }),
    [dateRange.from, dateRange.to],
  );

  const hasDueDateFilter = Boolean(dueDateRangeFilter.startDate || dueDateRangeFilter.endDate);

  const handleDueDateRangeChange = (next: PmsDateRange) => {
    setDateRange({
      from: next.startDate ?? undefined,
      to: next.endDate ?? undefined,
    });
  };

  const canChangeStatusForTask = useCallback(
    (task: { status: string; assignByUserId: string; assignToUserId: string }) =>
      canChangeCrmTaskStatus(task, user?.id, tasksScopeAdmin),
    [user?.id, tasksScopeAdmin],
  );

  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (!canChangeStatusForTask(task)) {
        toast.error("You don't have permission to change this task's status.");
        return;
      }
      try {
        await changeStatus(taskId, newStatus as TaskStatus, user!.id);
        toast.success(`Status changed to ${newStatus.replace("_", " ")}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to change status");
      }
    },
    [tasks, canChangeStatusForTask, changeStatus, user],
  );

  return (
    <Layout>
      <div className="-m-6 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        <CrmTasksListToolbar
          tab={tab}
          onTabChange={setTab}
          tabCounts={tabCounts}
          search={search}
          onSearchChange={setSearch}
          filterAssignTo={filterAssignTo}
          onFilterAssignToChange={setFilterAssignTo}
          filterAssignBy={filterAssignBy}
          onFilterAssignByChange={setFilterAssignBy}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          dueDateRange={dueDateRangeFilter}
          onDueDateRangeChange={handleDueDateRangeChange}
          dueDatePickerOpen={datePickerOpen}
          onDueDatePickerOpenChange={setDatePickerOpen}
          hasDueDateFilter={hasDueDateFilter}
          tasksScopeAdmin={tasksScopeAdmin}
          users={users}
          statuses={taskStatuses}
          onAddTask={openCreate}
        />

        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          {loading ? (
            <CrmTasksListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <EmptyState
                icon={CheckSquare}
                title={hasActiveFilters ? "No tasks match your filters" : "No tasks yet"}
                description={
                  hasActiveFilters
                    ? "Try adjusting your search or filter criteria."
                    : "Create your first task to get started."
                }
                actionLabel={!hasActiveFilters ? "Add Task" : undefined}
                onAction={!hasActiveFilters ? openCreate : undefined}
              />
            </div>
          ) : (
            <CrmTasksListTable
              tasks={filtered}
              taskCount={filtered.length}
              getCompanyName={getCompanyName}
              getUserName={getUserName}
              statusOrder={taskStatuses}
              canChangeStatus={canChangeStatusForTask}
              onStatusChange={handleStatusChange}
              onRowClick={navigateToTask}
              now={now}
            />
          )}
        </div>
      </div>

      <TaskFormModal open={open} onOpenChange={setOpen} editingId={editingId} />
    </Layout>
  );
}
