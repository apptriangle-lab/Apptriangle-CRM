import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Flag,
  Send,
  Target,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { usersApi, type UserDto } from "@/lib/api";
import {
  pmsApi,
  formatPmsTaskStatusLabel,
  PMS_PRIORITIES,
  type PmsMemberDto,
  type PmsSprintDto,
  type PmsTaskDto,
} from "@/lib/pmsApi";
import { PmsProjectContext } from "@/contexts/PmsProjectContext";
import { usePmsSprintsOptional } from "@/contexts/PmsSprintContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PmsTaskStatusDropdown } from "@/components/pms/PmsTaskStatusDropdown";
import { PmsCommentBody } from "@/components/pms/PmsCommentBody";
import { PmsCommentEditor, type PmsCommentEditorHandle } from "@/components/pms/PmsCommentEditor";
import { PmsCommentEmojiPicker } from "@/components/pms/PmsCommentEmojiPicker";
import { PmsCommentMentionPicker } from "@/components/pms/PmsCommentMentionPicker";
import { PmsTaskDetailModalSkeleton } from "@/components/pms/PmsTaskDetailModalSkeleton";
import {
  PmsTaskDatePicker,
  formatPmsDateForApi,
  formatTaskDateLabel,
  parsePmsDate,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import { pmsTaskDateTextClass } from "@/components/pms/pmsTaskListStyles";
import { normalizeTaskDateRange, validateTaskDateRange } from "@/lib/pmsTaskDates";
import { PmsTaskAttachmentsSection } from "@/components/pms/PmsTaskAttachmentsSection";
import { PmsTaskAssigneesPicker } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  PmsTaskDetailSubtasksTab,
  type SubtaskTabStats,
} from "@/components/pms/PmsTaskDetailSubtasksTab";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { PmsTaskDeleteDialog } from "@/components/pms/PmsTaskDeleteDialog";
import { isPmsParentTask } from "@/utils/pmsTaskSprint";
import type { PmsTaskAttachmentDto } from "@/lib/pmsApi";

type Props = {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onTaskUpdated?: (task: PmsTaskDto) => void;
  onTaskDeleted?: (deletedIds: string[]) => void;
};

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

const AVATAR_BG = ["bg-slate-800", "bg-teal-600", "bg-sky-600", "bg-orange-500", "bg-violet-600", "bg-rose-500"];

function UserAvatar({ name, userId, size = "md" }: { name: string; userId?: string; size?: "sm" | "md" }) {
  const idx = userId ? [...userId].reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        dim,
        AVATAR_BG[idx % AVATAR_BG.length],
      )}
      title={name}
    >
      {memberInitials(name)}
    </span>
  );
}

function formatActivityDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return "";
    return format(d, "MMM d 'at' h:mm a");
  } catch {
    return "";
  }
}

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[48px] items-center border-b border-slate-100 py-2.5">
      <div className="flex w-[132px] shrink-0 items-center gap-2.5 text-[14px] text-slate-600">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
        <span className="font-normal">{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function EditableTaskDateField({
  task,
  field,
  disabled,
  open,
  onOpenChange,
  onSave,
}: {
  task: Pick<PmsTaskDto, "startDate" | "endDate" | "status">;
  field: "startDate" | "endDate";
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { startDate: string | null; endDate: string | null }) => void;
}) {
  const currentDate = parsePmsDate(field === "startDate" ? task.startDate : task.endDate);
  const otherDate = parsePmsDate(field === "startDate" ? task.endDate : task.startDate);
  const placeholder = field === "startDate" ? "Set start date" : "Set end date";
  const textClass =
    field === "endDate"
      ? pmsTaskDateTextClass(task)
      : currentDate
        ? "text-slate-800"
        : "text-slate-400";

  return (
    <PmsTaskDatePicker
      endOnly
      modal={false}
      open={open}
      onOpenChange={onOpenChange}
      value={{ startDate: null, endDate: currentDate }}
      onChange={(next) => {
        const nextRange: PmsDateRange =
          field === "startDate"
            ? { startDate: next.endDate, endDate: otherDate }
            : { startDate: otherDate, endDate: next.endDate };
        const err = validateTaskDateRange(nextRange);
        if (err) {
          toast.error(err);
          return;
        }
        const normalized = normalizeTaskDateRange(nextRange);
        onSave({
          startDate: formatPmsDateForApi(normalized.startDate),
          endDate: formatPmsDateForApi(normalized.endDate),
        });
        onOpenChange(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[14px] transition-colors hover:bg-slate-50 disabled:opacity-50",
          textClass,
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {currentDate ? formatTaskDateLabel(currentDate) : placeholder}
      </button>
    </PmsTaskDatePicker>
  );
}

export function PmsTaskDetailModal({ taskId, open, onClose, onTaskUpdated, onTaskDeleted }: Props) {
  const { pmsTaskStatuses } = useStatusConfig();
  const sprintCtx = usePmsSprintsOptional();
  const { openTask } = usePmsTaskModal();
  const { perms } = usePmsPermissions();
  const projectCtx = useContext(PmsProjectContext);
  const [taskSprints, setTaskSprints] = useState<PmsSprintDto[]>([]);
  const [task, setTask] = useState<PmsTaskDto | null>(null);
  const [subtaskStats, setSubtaskStats] = useState<SubtaskTabStats>({
    total: 0,
    completed: 0,
    closedHidden: 0,
  });
  const [projectMembers, setProjectMembers] = useState<PmsMemberDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const commentEditorRef = useRef<PmsCommentEditorHandle>(null);

  const sprints = useMemo(() => {
    if (sprintCtx && task?.projectId && projectCtx?.projectId === task.projectId) {
      return sprintCtx.sprints;
    }
    return taskSprints;
  }, [sprintCtx, task?.projectId, projectCtx?.projectId, taskSprints, sprintCtx?.sprints]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [users]);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const t = await pmsApi.getTask(taskId);
      setTask(t);
    } catch {
      toast.error("Task not found");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, onClose]);

  useEffect(() => {
    if (open && taskId) load();
    if (!open) {
      setTask(null);
      setComment("");
      setAssigneeOpen(false);
      setStartDateOpen(false);
      setEndDateOpen(false);
      setSubtaskStats({ total: 0, completed: 0, closedHidden: 0 });
    }
  }, [open, taskId, load]);

  useEffect(() => {
    usersApi.list().then((list) => setUsers(list.filter((u) => u.isActive))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!task?.projectId) {
      setProjectMembers([]);
      return;
    }
    if (projectCtx?.projectId === task.projectId && projectCtx.project?.members) {
      setProjectMembers(projectCtx.project.members);
      return;
    }
    pmsApi
      .getProject(task.projectId)
      .then((p) => setProjectMembers(p.members ?? []))
      .catch(() => setProjectMembers([]));
  }, [task?.projectId, projectCtx?.projectId, projectCtx?.project?.members]);

  useEffect(() => {
    if (!task?.projectId) {
      setTaskSprints([]);
      return;
    }
    if (sprintCtx && projectCtx?.projectId === task.projectId) {
      return;
    }
    pmsApi
      .listSprints(task.projectId)
      .then((r) => setTaskSprints(r.items))
      .catch(() => setTaskSprints([]));
  }, [task?.projectId, sprintCtx, projectCtx?.projectId]);

  const applyTask = (t: PmsTaskDto) => {
    setTask((prev) => {
      if (!prev || prev.id !== t.id) return t;
      const merged = { ...prev, ...t };
      if (!prev.parentTaskId && t.sprintId !== undefined && prev.subTasks?.length) {
        merged.subTasks = prev.subTasks.map((subtask) => ({
          ...subtask,
          sprintId: t.sprintId ?? null,
        }));
      }
      return merged;
    });
    onTaskUpdated?.(t);
  };

  const onSubtaskCreated = (created: PmsTaskDto) => {
    setTask((prev) =>
      prev
        ? {
            ...prev,
            subTaskCount: (prev.subTaskCount ?? (prev.subTasks?.length ?? 0)) + 1,
            subTasks: [...(prev.subTasks ?? []), created],
          }
        : prev,
    );
    onTaskUpdated?.(created);
  };

  const saveField = async (patch: Partial<PmsTaskDto> & { assigneeIds?: string[] }) => {
    if (!taskId || !task) return;
    setSaving(true);
    try {
      const updated = await pmsApi.updateTask(taskId, patch);
      applyTask({ ...task, ...updated });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (status: string) => {
    if (!taskId || !task) return;
    try {
      const updated = await pmsApi.patchTaskStatus(taskId, status);
      applyTask({ ...task, ...updated });
      toast.success("Status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const insertIntoComment = useCallback((snippet: string) => {
    commentEditorRef.current?.insertSnippet(snippet);
  }, []);

  const insertCommentEmoji = useCallback((emoji: string) => {
    insertIntoComment(emoji);
  }, [insertIntoComment]);

  const insertCommentMention = useCallback((mention: string) => {
    insertIntoComment(mention);
  }, [insertIntoComment]);

  const submitComment = async () => {
    if (!taskId || !comment.trim()) return;
    setPosting(true);
    try {
      await pmsApi.addComment(taskId, comment.trim());
      setComment("");
      await load();
      toast.success("Comment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setPosting(false);
    }
  };

  const assigneeOptions = useMemo(
    () =>
      projectMembers
        .filter((m) => m.userId)
        .map((m) => ({
          id: m.userId,
          name: m.userName ?? m.userId,
          email: m.userEmail,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projectMembers],
  );

  const mentionMembers = useMemo(
    () =>
      assigneeOptions.map((member) => ({
        userId: member.id,
        name: member.name,
        email: member.email,
      })),
    [assigneeOptions],
  );

  const taskAssigneeIds = useMemo(
    () => (task?.assignees ?? []).map((a) => a.userId),
    [task?.assignees],
  );

  const creatorName = task?.createdBy ? userNameById.get(task.createdBy) ?? "Someone" : "Someone";

  const activityItems = useMemo(() => {
    if (!task) return [];
    const items: { id: string; who: string; action: string; at: string }[] = [];
    if (task.createdAt) {
      items.push({
        id: "created",
        who: creatorName,
        action: "created this task",
        at: task.createdAt,
      });
    }
    if (task.completedAt) {
      items.push({
        id: "completed",
        who: creatorName,
        action: `changed status to ${formatPmsTaskStatusLabel(task.status)}`,
        at: task.completedAt,
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [task, creatorName]);

  const subtaskDeleteCount = task?.subTaskCount ?? subtaskStats.total;

  const handleDelete = async () => {
    if (!taskId) return;
    setDeleting(true);
    try {
      const r = await pmsApi.deleteTask(taskId);
      toast.success(`Deleted ${r.count} task${r.count === 1 ? "" : "s"}`);
      onTaskDeleted?.(r.deletedTaskIds);
      setDeleteOpen(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // All PMS users with task access can soft-delete; backend enforces authorization.
  const canDelete = Boolean(task);

  const shortId = taskId ? taskId.replace(/-/g, "").slice(0, 9) : "";

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showClose={false}
        className="flex h-[min(92vh,900px)] max-h-[92vh] w-[min(1180px,96vw)] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-xl border-slate-200 p-0 shadow-2xl"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (
            assigneeOpen ||
            startDateOpen ||
            endDateOpen ||
            target.closest("[data-radix-popper-content-wrapper]") ||
            target.closest("[cmdk-root]")
          ) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (
            assigneeOpen ||
            startDateOpen ||
            endDateOpen ||
            target.closest("[data-radix-popper-content-wrapper]") ||
            target.closest("[cmdk-root]")
          ) {
            e.preventDefault();
          }
        }}
      >
        {loading || !task ? (
          <PmsTaskDetailModalSkeleton shortId={shortId} onClose={onClose} />
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Left — task details */}
            <div className="flex min-w-0 flex-[1.65] flex-col border-r border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-8 py-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckSquare className="h-4 w-4" />
                  <span className="font-medium text-slate-700">Task</span>
                  <span className="font-mono text-xs text-slate-400">{shortId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-8 pb-8">
                <Input
                  className="mt-2 border-0 px-0 text-2xl font-bold text-slate-900 shadow-none focus-visible:ring-0"
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                  onBlur={() => {
                    if (task.title.trim()) saveField({ title: task.title.trim() });
                  }}
                  disabled={saving}
                />

                <div className="mt-6 grid grid-cols-2 gap-x-14">
                  <div>
                    <PropertyRow icon={Target} label="Status">
                      <PmsTaskStatusDropdown
                        value={task.status}
                        onChange={patchStatus}
                        statusOrder={pmsTaskStatuses}
                        disabled={saving}
                      />
                    </PropertyRow>
                    <PropertyRow icon={Calendar} label="Start date">
                      <EditableTaskDateField
                        task={task}
                        field="startDate"
                        disabled={saving}
                        open={startDateOpen}
                        onOpenChange={setStartDateOpen}
                        onSave={(patch) => saveField(patch)}
                      />
                    </PropertyRow>
                    <PropertyRow icon={Calendar} label="End date">
                      <EditableTaskDateField
                        task={task}
                        field="endDate"
                        disabled={saving}
                        open={endDateOpen}
                        onOpenChange={setEndDateOpen}
                        onSave={(patch) => saveField(patch)}
                      />
                    </PropertyRow>
                    <PropertyRow icon={User} label="Assignees">
                      <PmsTaskAssigneesPicker
                        value={taskAssigneeIds}
                        onChange={(ids) => saveField({ assigneeIds: ids })}
                        options={assigneeOptions}
                        disabled={saving}
                        open={assigneeOpen}
                        onOpenChange={setAssigneeOpen}
                        modal={false}
                      />
                    </PropertyRow>
                  </div>
                  <div>
                    <PropertyRow icon={Flag} label="Priority">
                      <Select
                        value={task.priority}
                        onValueChange={(v) => saveField({ priority: v })}
                      >
                        <SelectTrigger className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[14px] font-normal text-slate-800 shadow-none focus:ring-0 [&>svg]:opacity-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PMS_PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>
                    {isPmsParentTask(task) ? (
                      <PropertyRow icon={Target} label="Sprint">
                        <Select
                          value={task.sprintId ?? "__none__"}
                          onValueChange={(v) =>
                            saveField({ sprintId: v === "__none__" ? null : v })
                          }
                          disabled={saving}
                        >
                          <SelectTrigger className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[14px] font-normal text-slate-800 shadow-none focus:ring-0 [&>svg]:opacity-40">
                            <SelectValue placeholder="Backlog" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Backlog</SelectItem>
                            {sprints.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </PropertyRow>
                    ) : null}
                  </div>
                </div>

                <Tabs defaultValue="details" className="mt-8">
                  <TabsList className="h-auto gap-6 rounded-none border-b border-slate-200 bg-transparent p-0">
                    <TabsTrigger
                      value="details"
                      className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 text-sm font-semibold text-slate-500 shadow-none data-[state=active]:border-slate-900 data-[state=active]:text-slate-900"
                    >
                      Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="subtasks"
                      className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 text-sm font-semibold text-slate-500 shadow-none data-[state=active]:border-slate-900 data-[state=active]:text-slate-900"
                    >
                      Subtasks
                      {subtaskStats.total > 0 && (
                        <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500">
                          {subtaskStats.total}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-6 space-y-6">
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-800">Description</h4>
                      <Textarea
                        className="min-h-[100px] resize-y border-slate-200 text-sm"
                        placeholder="Add a description…"
                        value={task.description ?? ""}
                        onChange={(e) => setTask({ ...task, description: e.target.value })}
                        onBlur={() => saveField({ description: task.description ?? "" })}
                      />
                    </div>
                    <PmsTaskAttachmentsSection
                      taskId={taskId}
                      attachments={task.attachments ?? []}
                      disabled={saving}
                      onAttachmentsChange={(attachments: PmsTaskAttachmentDto[]) =>
                        setTask((prev) => {
                          if (!prev) return prev;
                          const next = {
                            ...prev,
                            attachments,
                            attachmentCount: attachments.length,
                          };
                          onTaskUpdated?.(next);
                          return next;
                        })
                      }
                    />
                  </TabsContent>

                  <TabsContent value="subtasks" className="mt-4">
                    <PmsTaskDetailSubtasksTab
                      parentTask={task}
                      projectMembers={projectMembers}
                      canCreate={perms.canCreateTask}
                      canUpdate={perms.canUpdateTask || perms.canCreateTask}
                      onOpenTask={openTask}
                      onTaskCreated={onSubtaskCreated}
                      onStats={setSubtaskStats}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {canDelete && (
                <div className="shrink-0 border-t border-slate-100 bg-white px-8 py-3">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete task
                  </button>
                </div>
              )}
            </div>

            {/* Right — activity */}
            <div className="flex min-w-0 flex-1 flex-col bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-semibold text-slate-900">Activity</h3>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
                {activityItems.map((item) => (
                  <div key={item.id} className="mb-5 flex gap-3">
                    <UserAvatar name={item.who} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold">{item.who}</span> {item.action}
                      </p>
                      <p className="mt-0.5 text-right text-xs text-slate-400">
                        {formatActivityDate(item.at)}
                      </p>
                    </div>
                  </div>
                ))}
                {(task.comments ?? []).map((c) => (
                  <div key={`c-${c.id}`} className="mb-5 rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-600">{c.userName}</p>
                    <PmsCommentBody text={c.comment} className="mt-1 text-sm text-slate-800" />
                    <p className="mt-1 text-right text-xs text-slate-400">
                      {formatActivityDate(c.createdAt)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 p-4">
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <PmsCommentEditor
                    ref={commentEditorRef}
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={setComment}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                    }}
                    disabled={posting}
                  />
                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                    <div className="flex items-center gap-0.5 text-slate-400">
                      <span className="px-1 text-xs font-medium text-slate-600">Comment</span>
                      <PmsCommentMentionPicker
                        members={mentionMembers}
                        onInsert={insertCommentMention}
                        disabled={posting}
                      />
                      <PmsCommentEmojiPicker
                        onInsert={insertCommentEmoji}
                        disabled={posting}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-500"
                      disabled={posting || !comment.trim()}
                      onClick={submitComment}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <PmsTaskDeleteDialog
      task={task}
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      onConfirm={handleDelete}
      loading={deleting}
      subtaskCount={subtaskDeleteCount}
    />
    </>
  );
}
