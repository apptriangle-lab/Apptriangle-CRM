import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Flag,
  Inbox,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { pmsApi, type PmsSprintDto } from "@/lib/pmsApi";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { usePmsSprints } from "@/contexts/PmsSprintContext";
import { PmsSprintFormDialog } from "@/components/pms/sprints/PmsSprintFormDialog";
import {
  comparePmsSprints,
  formatPmsSprintStatusLabel,
  formatSprintDateRangeShort,
  resolveSprintFilter,
  sprintStatusAccent,
  sprintStatusStyles,
} from "@/components/pms/sprints/pmsSprintUtils";

type Props = {
  className?: string;
  compact?: boolean;
  /** Show create/edit/delete on the Tasks page */
  manageable?: boolean;
  canManage?: boolean;
  /** Show status badges and status-based styling (default true) */
  showStatus?: boolean;
};

function SprintStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
        sprintStatusStyles[status] ?? sprintStatusStyles.planned,
      )}
    >
      {formatPmsSprintStatusLabel(status)}
    </span>
  );
}

function SprintRow({
  sprint,
  selected,
  manageable,
  canManage,
  showStatus = true,
  onSelect,
  onEdit,
  onDelete,
}: {
  sprint: PmsSprintDto;
  selected: boolean;
  manageable?: boolean;
  canManage?: boolean;
  showStatus?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const showActions = manageable && canManage;

  return (
    <CommandItem
      value={`${sprint.name} ${sprint.goal ?? ""} ${formatPmsSprintStatusLabel(sprint.status)}`}
      onSelect={onSelect}
      className={cn(
        "group relative flex cursor-pointer items-start gap-2 rounded-md px-2 py-2.5",
        selected
          ? "bg-indigo-50 data-[selected=true]:bg-indigo-50"
          : "data-[selected=true]:bg-slate-100",
      )}
    >
      <span
        className={cn(
          "mt-1 h-8 w-1 shrink-0 rounded-full",
          showStatus
            ? (sprintStatusAccent[sprint.status] ?? sprintStatusAccent.planned)
            : "bg-slate-300",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-slate-900">{sprint.name}</span>
          {showStatus ? <SprintStatusBadge status={sprint.status} /> : null}
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-slate-600">
          {formatSprintDateRangeShort(sprint.startDate, sprint.endDate)}
          {sprint.taskCount != null ? ` · ${sprint.taskCount} tasks` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 self-center">
        {showActions ? (
          <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-aria-selected:opacity-100">
            <button
              type="button"
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              title="Edit sprint"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-slate-600 hover:bg-rose-100 hover:text-rose-700"
              title="Delete sprint"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <Check className={cn("h-4 w-4 text-indigo-700", selected ? "opacity-100" : "opacity-0")} />
      </div>
    </CommandItem>
  );
}

export function PmsSprintSelector({
  className,
  compact,
  manageable,
  canManage,
  showStatus = true,
}: Props) {
  const { projectId } = usePmsProject();
  const {
    sprints,
    sprintFilter,
    setSprintFilter,
    loading,
    getSprintById,
    refreshSprints,
  } = usePmsSprints();

  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<PmsSprintDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PmsSprintDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedSprints = useMemo(() => [...sprints].sort(comparePmsSprints), [sprints]);

  const selectedSprint = sprintFilter !== "backlog" ? getSprintById(sprintFilter) : null;

  const label =
    sprintFilter === "backlog"
      ? "Backlog"
      : (selectedSprint?.name ?? "Sprint");

  const triggerHint =
    showStatus && selectedSprint?.status === "active"
      ? "Active sprint"
      : sprintFilter === "backlog"
        ? "Tasks without a sprint"
        : undefined;

  const pickFilter = (filter: typeof sprintFilter) => {
    setSprintFilter(filter);
    setOpen(false);
  };

  const openCreate = () => {
    setEditingSprint(null);
    setFormOpen(true);
    setOpen(false);
  };

  const openEdit = (sprint: PmsSprintDto) => {
    setEditingSprint(sprint);
    setFormOpen(true);
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !projectId) return;
    setDeleting(true);
    try {
      await pmsApi.deleteSprint(projectId, deleteTarget.id);
      toast.success("Sprint deleted");
      if (sprintFilter === deleteTarget.id) {
        setSprintFilter(resolveSprintFilter("backlog", sprints.filter((s) => s.id !== deleteTarget.id)));
      }
      await refreshSprints();
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete sprint");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={loading && sprints.length === 0}
            title={triggerHint}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-50",
              showStatus && selectedSprint?.status === "active"
                ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                : sprintFilter === "backlog"
                  ? "border-slate-300 text-slate-800"
                  : "border-slate-300 text-slate-900",
              className,
            )}
          >
            <Flag
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                showStatus && selectedSprint?.status === "active" ? "text-emerald-700" : "text-indigo-700",
              )}
            />
            <span className="truncate">
              {!compact ? label : label.length > 14 ? `${label.slice(0, 12)}…` : label}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(340px,calc(100vw-2rem))] border-slate-300 p-0 shadow-lg"
        >
          <Command
            shouldFilter
            className="[&_[cmdk-group-heading]]:text-slate-700 [&_[cmdk-input-wrapper]_svg]:text-slate-600 [&_[cmdk-input-wrapper]_svg]:opacity-100"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Sprints</p>
            </div>
            <CommandInput
              placeholder="Search sprints…"
              className="h-10 border-0 text-slate-900 placeholder:text-slate-500"
            />
            <CommandList className="max-h-[min(360px,55vh)]">
              <CommandEmpty className="text-slate-600">No sprints found.</CommandEmpty>
              <CommandGroup className="px-1 pt-1">
                <CommandItem
                  value="backlog no sprint"
                  onSelect={() => pickFilter("backlog")}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2",
                    sprintFilter === "backlog"
                      ? "bg-indigo-50 data-[selected=true]:bg-indigo-50"
                      : "data-[selected=true]:bg-slate-100",
                  )}
                >
                  <Inbox className="h-4 w-4 text-slate-700" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-slate-900">Backlog</span>
                    <p className="text-[11px] font-medium text-slate-600">Tasks without a sprint</p>
                  </div>
                  <Check
                    className={cn("h-4 w-4 text-indigo-700", sprintFilter === "backlog" ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              </CommandGroup>
              {sortedSprints.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Sprint list" className="px-1 pb-1 [&_[cmdk-group-heading]]:font-semibold">
                    {sortedSprints.map((s) => (
                      <SprintRow
                        key={s.id}
                        sprint={s}
                        selected={sprintFilter === s.id}
                        manageable={manageable}
                        canManage={canManage}
                        showStatus={showStatus}
                        onSelect={() => pickFilter(s.id)}
                        onEdit={() => openEdit(s)}
                        onDelete={() => setDeleteTarget(s)}
                      />
                    ))}
                  </CommandGroup>
                </>
              ) : (
                <div className="px-4 py-6 text-center text-[13px] font-medium text-slate-600">
                  No sprints yet. Create one to group work by iteration.
                </div>
              )}
            </CommandList>
            {manageable && canManage ? (
              <div className="border-t border-slate-200 bg-slate-50 p-2">
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-2 text-[13px] font-bold text-indigo-800 transition-colors hover:bg-indigo-50"
                >
                  <Plus className="h-4 w-4" />
                  New sprint
                </button>
              </div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>

      {manageable && projectId ? (
        <PmsSprintFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={projectId}
          sprint={editingSprint}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be removed. Tasks in this sprint move to the backlog.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
