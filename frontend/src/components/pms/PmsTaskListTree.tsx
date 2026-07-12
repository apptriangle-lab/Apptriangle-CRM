import { Fragment, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  GitBranch,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { formatPmsTaskStatusLabel, type PmsTaskDto } from "@/lib/pmsApi";
import { normalizeTaskDateRange, validateTaskDateRange } from "@/lib/pmsTaskDates";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { PmsTaskStatusDropdown } from "@/components/pms/PmsTaskStatusDropdown";
import {
  formatPmsDateForApi,
  parsePmsDate,
  PmsTaskDatePicker,
} from "@/components/pms/PmsTaskDatePicker";
import {
  PmsTaskAssigneeAvatars,
  PmsTaskAssigneesPicker,
} from "@/components/pms/PmsTaskAssigneesPicker";
import {
  PmsSubtaskInlineEditor,
  type SubtaskCreateDraft,
} from "@/components/pms/PmsSubtaskInlineEditor";
import type { AssigneeOption } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsAddSubtaskRow, PmsTaskSubtree } from "@/components/pms/PmsTaskSubtree";
import {
  avatarBgClass,
  formatPmsTaskDateRange,
  memberInitials,
  pmsTaskDateTextClass,
  PMS_TASK_COL_GRID,
  PMS_TASK_COL_GRID_WITH_PROJECT,
  pmsStatusTheme,
  pmsTreeLevelStyle,
  type PmsStatusTheme,
} from "@/components/pms/pmsTaskListStyles";
import {
  buildTaskChildNodes,
  taskHasSubtasks,
  type PmsTaskTreeNode,
} from "@/utils/pmsTaskTree";

export type TaskListPatch = Partial<PmsTaskDto> & { assigneeIds?: string[] };

const ASSIGNEE_CELL =
  "flex min-h-8 w-full cursor-pointer flex-wrap items-center justify-center gap-0.5 rounded-md px-1 transition-colors hover:bg-slate-100";

const DUE_DATE_CELL =
  "flex min-h-8 w-full cursor-pointer items-center justify-center rounded-md px-1 transition-colors hover:bg-slate-100";

const DUE_DATE_CELL_READONLY =
  "flex min-h-8 w-full items-center justify-center";

function TaskAssigneeCell({
  task,
  assigneeOptions,
  canUpdate,
  onPatchTask,
}: {
  task: PmsTaskDto;
  assigneeOptions: AssigneeOption[];
  canUpdate: boolean;
  onPatchTask: (taskId: string, patch: TaskListPatch) => Promise<void>;
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
    <div className={ASSIGNEE_CELL}>
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

function TaskStatusIcon({
  task,
  theme,
}: {
  task: PmsTaskDto;
  theme: PmsStatusTheme;
}) {
  const isCompleted =
    task.status.toLowerCase() === "completed" ||
    task.status.toLowerCase().includes("done") ||
    !!task.completedAt;
  const isNotStarted =
    task.status.toLowerCase().includes("not") &&
    task.status.toLowerCase().includes("start");

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

function TaskDueDateCell({
  task,
  canUpdate,
  onPatchTask,
}: {
  task: PmsTaskDto;
  canUpdate: boolean;
  onPatchTask: (taskId: string, patch: TaskListPatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!canUpdate) {
    if (task.startDate || task.endDate) {
      return (
        <div className={DUE_DATE_CELL_READONLY}>
          <span className={cn("min-w-0 truncate text-xs", pmsTaskDateTextClass(task))}>
            {formatPmsTaskDateRange(task)}
          </span>
        </div>
      );
    }
    return (
      <div className={DUE_DATE_CELL_READONLY}>
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className={DUE_DATE_CELL} onClick={(e) => e.stopPropagation()}>
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
            "inline-flex w-full min-w-0 items-center justify-center gap-1 disabled:opacity-50",
            task.startDate || task.endDate ? pmsTaskDateTextClass(task) : "text-slate-400",
          )}
          title={task.startDate || task.endDate ? formatPmsTaskDateRange(task) : "Set dates"}
        >
          {task.startDate || task.endDate ? (
            <span className="min-w-0 truncate text-xs">{formatPmsTaskDateRange(task)}</span>
          ) : (
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          )}
        </button>
      </PmsTaskDatePicker>
    </div>
  );
}

type TreeProps = {
  nodes: PmsTaskTreeNode[];
  allItems: PmsTaskDto[];
  depth: number;
  statusOrder: string[];
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onOpenTask: (id: string) => void;
  onStatusChange: (task: PmsTaskDto, status: string) => void;
  userNameById: Map<string, string>;
  canCreateTask: boolean;
  creatingParentId: string | null;
  creatingTitle: string;
  onCreatingTitleChange: (v: string) => void;
  onStartCreateSubtask: (parentId: string) => void;
  onCancelCreateSubtask: () => void;
  onSaveSubtask: (parentId: string, draft: SubtaskCreateDraft) => void;
  savingSubtask: boolean;
  assigneeOptions: AssigneeOption[];
  canUpdateTask: boolean;
  canDeleteTask?: boolean;
  onDeleteTask?: (task: PmsTaskDto) => void;
  onPatchTask: (taskId: string, patch: TaskListPatch) => Promise<void>;
  selectedIds: Set<string>;
  onToggleSelect: (taskId: string, checked: boolean) => void;
  selectionEnabled?: boolean;
  showProjectColumn?: boolean;
  colGridClass?: string;
};

function TaskRow({
  node,
  allItems,
  depth,
  statusOrder,
  expanded,
  onToggleExpand,
  onOpenTask,
  onStatusChange,
  userNameById,
  canCreateTask,
  creatingParentId,
  creatingTitle,
  onCreatingTitleChange,
  onStartCreateSubtask,
  onCancelCreateSubtask,
  onSaveSubtask,
  savingSubtask,
  assigneeOptions,
  canUpdateTask,
  canDeleteTask = false,
  onDeleteTask,
  onPatchTask,
  selectedIds,
  onToggleSelect,
  selectionEnabled = true,
  showProjectColumn = false,
  colGridClass,
}: Omit<TreeProps, "nodes"> & { node: PmsTaskTreeNode }) {
  const { task, children } = node;
  const gridClass = colGridClass ?? (showProjectColumn ? PMS_TASK_COL_GRID_WITH_PROJECT : PMS_TASK_COL_GRID);
  const theme = pmsStatusTheme(task.status);
  const hasKids = taskHasSubtasks(task, allItems) || children.length > 0;
  const isExpanded = expanded[task.id] !== false;
  const subCount = task.subTaskCount ?? children.length;
  const isCreatingHere = creatingParentId === task.id;
  const isCompleted =
    task.status.toLowerCase() === "completed" ||
    task.status.toLowerCase().includes("done") ||
    !!task.completedAt;
  const creatorName = userNameById.get(task.createdBy ?? "") ?? "—";
  const showSubtree = isExpanded && (hasKids || canCreateTask || isCreatingHere);
  const isSelected = selectedIds.has(task.id);

  return (
    <Fragment>
      <div
        className={cn(
          gridClass,
          "group cursor-pointer border-b border-slate-100 py-2 text-[13px] transition-colors hover:bg-slate-50/90",
          isCreatingHere && pmsTreeLevelStyle(depth + 1).bg,
          isSelected && "bg-sky-50/60 hover:bg-sky-50/80",
        )}
        onClick={() => onOpenTask(task.id)}
      >
        <div className="flex min-w-0 items-center gap-1.5 pl-1">
          {selectionEnabled ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(v) => onToggleSelect(task.id, v === true)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 shrink-0 border-slate-300 data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600"
              aria-label={`Select ${task.title}`}
            />
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
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
          <span
            className={cn(
              "min-w-0 truncate font-medium text-slate-800",
              isCompleted && "text-slate-500 line-through",
            )}
          >
            {task.title}
          </span>
          {subCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] text-slate-400">
              <GitBranch className="h-3 w-3" />
              {subCount}
            </span>
          )}
          <div
            className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {canCreateTask && (
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-700"
                title={`Add subtask under "${task.title}"`}
                onClick={() => {
                  onStartCreateSubtask(task.id);
                  if (!isExpanded) onToggleExpand(task.id);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            {canDeleteTask && onDeleteTask && (
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title={`Delete "${task.title}"`}
                onClick={() => onDeleteTask(task)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {showProjectColumn ? (
          <span className="min-w-0 truncate text-xs font-medium text-slate-600" title={task.projectTitle ?? undefined}>
            {task.projectTitle ?? "—"}
          </span>
        ) : null}
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <PmsTaskStatusDropdown
            value={task.status}
            onChange={(v) => onStatusChange(task, v)}
            statusOrder={statusOrder}
            variant="compact"
          />
        </div>
        <TaskDueDateCell task={task} canUpdate={canUpdateTask} onPatchTask={onPatchTask} />
        <div onClick={(e) => e.stopPropagation()}>
          <TaskAssigneeCell
            task={task}
            assigneeOptions={assigneeOptions}
            canUpdate={canUpdateTask}
            onPatchTask={onPatchTask}
          />
        </div>
        <div className="flex items-center justify-center">
          {task.createdBy && creatorName !== "—" ? (
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white",
                avatarBgClass(task.createdBy),
              )}
              title={creatorName}
            >
              {memberInitials(creatorName)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </div>

      {showSubtree && (
        <PmsTaskSubtree level={depth + 1} active={isCreatingHere}>
          <PmsTaskListTree
            nodes={children}
            allItems={allItems}
            depth={depth + 1}
            statusOrder={statusOrder}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onOpenTask={onOpenTask}
            onStatusChange={onStatusChange}
            userNameById={userNameById}
            canCreateTask={canCreateTask}
            creatingParentId={creatingParentId}
            creatingTitle={creatingTitle}
            onCreatingTitleChange={onCreatingTitleChange}
            onStartCreateSubtask={onStartCreateSubtask}
            onCancelCreateSubtask={onCancelCreateSubtask}
            onSaveSubtask={onSaveSubtask}
            savingSubtask={savingSubtask}
            assigneeOptions={assigneeOptions}
            canUpdateTask={canUpdateTask}
            canDeleteTask={canDeleteTask}
            onDeleteTask={onDeleteTask}
            onPatchTask={onPatchTask}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            selectionEnabled={selectionEnabled}
            showProjectColumn={showProjectColumn}
            colGridClass={colGridClass}
          />
          {isCreatingHere && (
            <PmsSubtaskInlineEditor
              level={depth + 1}
              parentTitle={task.title}
              defaultStatus={task.status}
              defaultPriority={task.priority}
              statusOrder={statusOrder}
              assigneeOptions={assigneeOptions}
              value={creatingTitle}
              onChange={onCreatingTitleChange}
              onSave={(draft) => onSaveSubtask(task.id, draft)}
              onCancel={onCancelCreateSubtask}
              saving={savingSubtask}
            />
          )}
          {canCreateTask && !isCreatingHere && (
            <PmsAddSubtaskRow
              level={depth + 1}
              parentTitle={task.title}
              active={false}
              onClick={() => onStartCreateSubtask(task.id)}
            />
          )}
        </PmsTaskSubtree>
      )}
    </Fragment>
  );
}

export function PmsTaskListTree(props: TreeProps) {
  const { nodes, ...rowProps } = props;
  return (
    <>
      {nodes.map((node) => (
        <TaskRow key={node.task.id} node={node} {...rowProps} />
      ))}
    </>
  );
}

export function buildNodesForRoots(roots: PmsTaskDto[], allItems: PmsTaskDto[]): PmsTaskTreeNode[] {
  return roots.map((task) => ({
    task,
    children: buildTaskChildNodes(task.id, allItems),
  }));
}
