import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  GitBranch,
  Maximize2,
  Plus,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { pmsApi, type PmsTaskDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import {
  PmsSubtaskInlineEditor,
  type SubtaskCreateDraft,
} from "@/components/pms/PmsSubtaskInlineEditor";
import {
  PmsTaskAssigneeAvatars,
  PmsTaskAssigneesPicker,
  type AssigneeOption,
} from "@/components/pms/PmsTaskAssigneesPicker";
import {
  formatPmsDateForApi,
  parsePmsDate,
  PmsTaskDatePicker,
} from "@/components/pms/PmsTaskDatePicker";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import type { PmsMemberDto } from "@/lib/pmsApi";
import { PmsAddSubtaskRow, PmsTaskSubtree } from "@/components/pms/PmsTaskSubtree";
import {
  formatPmsTaskDateRange,
  pmsTaskDateTextClass,
  pmsStatusTheme,
  pmsTreeLevelStyle,
  type PmsStatusTheme,
} from "@/components/pms/pmsTaskListStyles";
import { normalizeTaskDateRange, validateTaskDateRange } from "@/lib/pmsTaskDates";
import {
  buildTaskChildNodes,
  collectDescendants,
  isTaskCompleted,
  taskHasSubtasks,
  type PmsTaskTreeNode,
} from "@/utils/pmsTaskTree";

export const PMS_SUBTASK_MODAL_COL_GRID =
  "grid grid-cols-[minmax(0,1fr)_72px_92px] items-center gap-1";

const SUBTASK_EDITABLE_CELL =
  "flex min-h-8 w-full cursor-pointer items-center justify-center rounded-md px-1 transition-colors hover:bg-slate-100";

export type SubtaskPatch = Partial<PmsTaskDto> & { assigneeIds?: string[] };

export type SubtaskTabStats = { total: number; completed: number; closedHidden: number };

type Props = {
  parentTask: PmsTaskDto;
  projectMembers?: PmsMemberDto[];
  canCreate: boolean;
  canUpdate: boolean;
  onOpenTask: (id: string) => void;
  onTaskCreated?: (task: PmsTaskDto) => void;
  onSubtaskUpdated?: (task: PmsTaskDto) => void;
  onStats?: (stats: SubtaskTabStats) => void;
};

function TaskStatusIcon({ task, theme }: { task: PmsTaskDto; theme: PmsStatusTheme }) {
  const isCompleted = isTaskCompleted(task);
  const isNotStarted =
    task.status.toLowerCase().includes("not") && task.status.toLowerCase().includes("start");

  if (isCompleted) {
    return (
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-2.5 w-2.5 stroke-[3]" />
      </span>
    );
  }
  if (isNotStarted) {
    return (
      <Circle
        className="h-[18px] w-[18px] shrink-0 text-rose-500"
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
    );
  }
  return <Circle className={cn("h-[18px] w-[18px] shrink-0", theme.rowIcon)} strokeWidth={1.5} />;
}

type RowProps = {
  node: PmsTaskTreeNode;
  allItems: PmsTaskDto[];
  depth: number;
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onOpenTask: (id: string) => void;
  canCreate: boolean;
  creatingParentId: string | null;
  creatingTitle: string;
  onCreatingTitleChange: (v: string) => void;
  onStartCreate: (parentId: string) => void;
  onCancelCreate: () => void;
  onSaveCreate: (parentId: string, draft: SubtaskCreateDraft) => void;
  savingSubtask: boolean;
  statusOrder: string[];
  assigneeOptions: AssigneeOption[];
  canUpdate: boolean;
  onPatchTask: (taskId: string, patch: SubtaskPatch) => Promise<void>;
};

function SubtaskAssigneeCell({
  task,
  assigneeOptions,
  canUpdate,
  onPatchTask,
}: {
  task: PmsTaskDto;
  assigneeOptions: AssigneeOption[];
  canUpdate: boolean;
  onPatchTask: (taskId: string, patch: SubtaskPatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const assigneeIds = useMemo(
    () => (task.assignees ?? []).map((a) => a.userId),
    [task.assignees],
  );

  if (!canUpdate) {
    return (
      <PmsTaskAssigneeAvatars
        assignees={task.assignees}
        fallbackName={task.assigneeName}
        fallbackUserId={task.assignedTo}
        emptyIcon={<User className="h-4 w-4 text-slate-300" strokeWidth={1.5} />}
      />
    );
  }

  return (
    <div className={SUBTASK_EDITABLE_CELL} onClick={(e) => e.stopPropagation()}>
      <PmsTaskAssigneesPicker
        value={assigneeIds}
        onChange={(ids) => {
          setSaving(true);
          void onPatchTask(task.id, { assigneeIds: ids })
            .catch(() => {})
            .finally(() => setSaving(false));
        }}
        options={assigneeOptions}
        disabled={saving}
        open={open}
        onOpenChange={setOpen}
        iconOnly
        modal={false}
      />
    </div>
  );
}

function SubtaskDateCell({
  task,
  canUpdate,
  onPatchTask,
}: {
  task: PmsTaskDto;
  canUpdate: boolean;
  onPatchTask: (taskId: string, patch: SubtaskPatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!canUpdate) {
    return task.startDate || task.endDate ? (
      <span className={cn("text-xs", pmsTaskDateTextClass(task))}>
        {formatPmsTaskDateRange(task)}
      </span>
    ) : (
      <Calendar className="h-4 w-4 text-slate-300" strokeWidth={1.5} />
    );
  }

  return (
    <div className={SUBTASK_EDITABLE_CELL} onClick={(e) => e.stopPropagation()}>
      <PmsTaskDatePicker
        rangeSelect
        modal={false}
        open={open}
        onOpenChange={setOpen}
        value={{
          startDate: parsePmsDate(task.startDate),
          endDate: parsePmsDate(task.endDate),
        }}
        onChange={(next) => {
          const err = validateTaskDateRange(next);
          if (err) {
            toast.error(err);
            return;
          }
          const normalized = normalizeTaskDateRange(next);
          setSaving(true);
          void onPatchTask(task.id, {
            startDate: formatPmsDateForApi(normalized.startDate),
            endDate: formatPmsDateForApi(normalized.endDate),
          })
            .then(() => setOpen(false))
            .catch(() => {})
            .finally(() => setSaving(false));
        }}
      >
        <button
          type="button"
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-1 disabled:opacity-50",
            pmsTaskDateTextClass(task),
          )}
          title={task.startDate || task.endDate ? formatPmsTaskDateRange(task) : "Set dates"}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          {task.startDate || task.endDate ? (
            <span className="text-xs">{formatPmsTaskDateRange(task)}</span>
          ) : null}
        </button>
      </PmsTaskDatePicker>
    </div>
  );
}

function SubtaskRow({
  node,
  allItems,
  depth,
  expanded,
  onToggleExpand,
  onOpenTask,
  canCreate,
  creatingParentId,
  creatingTitle,
  onCreatingTitleChange,
  onStartCreate,
  onCancelCreate,
  onSaveCreate,
  savingSubtask,
  statusOrder,
  assigneeOptions,
  canUpdate,
  onPatchTask,
}: RowProps) {
  const { task, children } = node;
  const theme = pmsStatusTheme(task.status);
  const hasKids = taskHasSubtasks(task, allItems) || children.length > 0;
  const isExpanded = expanded[task.id] !== false;
  const subCount = task.subTaskCount ?? children.length;
  const isCreatingHere = creatingParentId === task.id;
  const completed = isTaskCompleted(task);
  const showSubtree = isExpanded && (hasKids || canCreate || isCreatingHere);

  return (
    <Fragment>
      <div
        className={cn(
          PMS_SUBTASK_MODAL_COL_GRID,
          "group border-b border-slate-100 py-2.5 text-[13px] transition-colors hover:bg-slate-50/80",
          isCreatingHere && pmsTreeLevelStyle(depth + 1).bg,
        )}
      >
        <div className="flex min-w-0 items-center gap-1 pl-1">
          {hasKids ? (
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(task.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <TaskStatusIcon task={task} theme={theme} />
          <button
            type="button"
            className={cn(
              "min-w-0 truncate text-left font-medium text-slate-800 hover:text-sky-700",
              completed && "text-slate-500 line-through",
            )}
            onClick={() => onOpenTask(task.id)}
          >
            {task.title}
          </button>
          {subCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] text-slate-400">
              <GitBranch className="h-3 w-3" />
              {subCount}
            </span>
          )}
        </div>
        <div className="flex min-w-0 justify-center">
          <SubtaskAssigneeCell
            task={task}
            assigneeOptions={assigneeOptions}
            canUpdate={canUpdate}
            onPatchTask={onPatchTask}
          />
        </div>
        <div className="flex min-w-0 justify-center">
          <SubtaskDateCell task={task} canUpdate={canUpdate} onPatchTask={onPatchTask} />
        </div>
      </div>

      {showSubtree && (
        <PmsTaskSubtree level={depth + 1} active={isCreatingHere} className="ml-6 sm:ml-9">
          {children.map((child) => (
            <SubtaskRow
              key={child.task.id}
              node={child}
              allItems={allItems}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onOpenTask={onOpenTask}
              canCreate={canCreate}
              creatingParentId={creatingParentId}
              creatingTitle={creatingTitle}
              onCreatingTitleChange={onCreatingTitleChange}
              onStartCreate={onStartCreate}
              onCancelCreate={onCancelCreate}
              onSaveCreate={onSaveCreate}
              savingSubtask={savingSubtask}
              statusOrder={statusOrder}
              assigneeOptions={assigneeOptions}
              canUpdate={canUpdate}
              onPatchTask={onPatchTask}
            />
          ))}
          {isCreatingHere && (
            <PmsSubtaskInlineEditor
              variant="modal"
              level={depth + 1}
              defaultStatus={task.status}
              defaultPriority={task.priority}
              statusOrder={statusOrder}
              assigneeOptions={assigneeOptions}
              value={creatingTitle}
              onChange={onCreatingTitleChange}
              onSave={(draft) => onSaveCreate(task.id, draft)}
              onCancel={onCancelCreate}
              saving={savingSubtask}
            />
          )}
          {canCreate && !isCreatingHere && (
            <PmsAddSubtaskRow
              level={depth + 1}
              parentTitle={task.title}
              onClick={() => onStartCreate(task.id)}
            />
          )}
        </PmsTaskSubtree>
      )}
    </Fragment>
  );
}

export function PmsTaskDetailSubtasksTab({
  parentTask,
  projectMembers = [],
  canCreate,
  canUpdate,
  onOpenTask,
  onTaskCreated,
  onSubtaskUpdated,
  onStats,
}: Props) {
  const { pmsTaskStatuses } = useStatusConfig();
  const statusOrder = useMemo(
    () => (pmsTaskStatuses.length ? [...pmsTaskStatuses] : ["to_do", "in_progress", "completed"]),
    [pmsTaskStatuses],
  );
  const assigneeOptions = useMemo<AssigneeOption[]>(
    () =>
      projectMembers.map((m) => ({
        id: m.userId,
        name: m.userName ?? m.userEmail ?? "Member",
        email: m.userEmail ?? undefined,
      })),
    [projectMembers],
  );
  const [allTasks, setAllTasks] = useState<PmsTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showClosed, setShowClosed] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [creatingTitle, setCreatingTitle] = useState("");
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [rootCreating, setRootCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!parentTask.projectId) return;
    setLoading(true);
    try {
      const res = await pmsApi.listTasks({ projectId: parentTask.projectId, perPage: 500 });
      setAllTasks(res.items);
    } catch {
      toast.error("Failed to load subtasks");
    } finally {
      setLoading(false);
    }
  }, [parentTask.projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, parentTask.id]);

  const descendants = useMemo(
    () => collectDescendants(parentTask.id, allTasks),
    [parentTask.id, allTasks],
  );

  const visibleItems = useMemo(() => {
    if (showClosed) return descendants;
    return descendants.filter((t) => !isTaskCompleted(t));
  }, [descendants, showClosed]);

  const closedCount = useMemo(
    () => descendants.filter((t) => isTaskCompleted(t)).length,
    [descendants],
  );

  const stats = useMemo(() => {
    const total = descendants.length;
    const completed = descendants.filter((t) => isTaskCompleted(t)).length;
    return { total, completed, closedHidden: closedCount };
  }, [descendants, closedCount]);

  useEffect(() => {
    onStats?.(stats);
  }, [stats, onStats]);

  const treeNodes = useMemo(
    () => buildTaskChildNodes(parentTask.id, visibleItems),
    [parentTask.id, visibleItems],
  );

  const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    descendants.forEach((t) => {
      next[t.id] = false;
    });
    setExpanded(next);
  };

  const expandAll = () => {
    setExpanded({});
  };

  const saveSubtask = async (parentId: string, draft: SubtaskCreateDraft) => {
    if (!draft.title) return;
    setSavingSubtask(true);
    try {
      const created = await pmsApi.createTask({
        projectId: parentTask.projectId,
        parentTaskId: parentId,
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        assigneeIds: draft.assigneeIds.length ? draft.assigneeIds : undefined,
        startDate: draft.startDate,
        endDate: draft.endDate,
      });
      setAllTasks((prev) => [...prev, created]);
      setCreatingTitle("");
      setCreatingParentId(null);
      setRootCreating(false);
      setExpanded((prev) => ({ ...prev, [parentId]: true }));
      onTaskCreated?.(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create subtask");
    } finally {
      setSavingSubtask(false);
    }
  };

  const startCreate = (parentId: string) => {
    setCreatingParentId(parentId);
    setCreatingTitle("");
    setRootCreating(false);
    setExpanded((prev) => ({ ...prev, [parentId]: true }));
  };

  const patchSubtask = useCallback(
    async (taskId: string, patch: SubtaskPatch) => {
      try {
        const updated = await pmsApi.updateTask(taskId, patch);
        setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
        onSubtaskUpdated?.(updated);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
        throw e;
      }
    },
    [onSubtaskUpdated],
  );

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading subtasks…</p>;
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <h4 className="text-[15px] font-semibold text-slate-900">Subtasks</h4>
          {stats.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {stats.completed}/{stats.total}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <button type="button" className="inline-flex items-center gap-1 hover:text-slate-800">
            Sort
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="hover:text-slate-800" onClick={collapseAll}>
            Collapse all
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-slate-800"
            onClick={expandAll}
            title="Expand all"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          PMS_SUBTASK_MODAL_COL_GRID,
          "border-b border-slate-100 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400",
        )}
      >
        <span className="pl-2">Name</span>
        <span className="text-center">Assignee</span>
        <span className="text-center">Due date</span>
      </div>

      {treeNodes.length === 0 && !rootCreating ? (
        <p className="py-6 text-center text-sm text-slate-500">No subtasks yet.</p>
      ) : (
        treeNodes.map((node) => (
          <SubtaskRow
            key={node.task.id}
            node={node}
            allItems={allTasks}
            depth={0}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onOpenTask={onOpenTask}
            canCreate={canCreate}
            creatingParentId={creatingParentId}
            creatingTitle={creatingTitle}
            onCreatingTitleChange={setCreatingTitle}
            onStartCreate={startCreate}
            onCancelCreate={() => {
              setCreatingParentId(null);
              setCreatingTitle("");
              setRootCreating(false);
            }}
            onSaveCreate={saveSubtask}
            savingSubtask={savingSubtask}
            statusOrder={statusOrder}
            assigneeOptions={assigneeOptions}
            canUpdate={canUpdate}
            onPatchTask={patchSubtask}
          />
        ))
      )}

      {rootCreating && creatingParentId === parentTask.id && (
        <PmsSubtaskInlineEditor
          variant="modal"
          level={1}
          defaultStatus={parentTask.status}
          defaultPriority={parentTask.priority}
          statusOrder={statusOrder}
          assigneeOptions={assigneeOptions}
          value={creatingTitle}
          onChange={setCreatingTitle}
          onSave={(draft) => saveSubtask(parentTask.id, draft)}
          onCancel={() => {
            setRootCreating(false);
            setCreatingParentId(null);
            setCreatingTitle("");
          }}
          saving={savingSubtask}
        />
      )}

      {canCreate && !rootCreating && creatingParentId !== parentTask.id && (
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1.5 px-1 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800"
          onClick={() => {
            setRootCreating(true);
            setCreatingParentId(parentTask.id);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      )}

      {!showClosed && closedCount > 0 && (
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
          onClick={() => setShowClosed(true)}
        >
          Show {closedCount} closed
        </button>
      )}
      {showClosed && closedCount > 0 && (
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
          onClick={() => setShowClosed(false)}
        >
          Hide closed
        </button>
      )}
    </div>
  );
}
