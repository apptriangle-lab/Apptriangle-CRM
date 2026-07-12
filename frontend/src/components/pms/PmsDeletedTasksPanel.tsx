import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PmsSectionCard } from "@/components/pms/PmsSectionCard";
import { PmsTaskRestoreDialog } from "@/components/pms/PmsTaskRestoreDialog";
import { pmsApi, type PmsTaskDto } from "@/lib/pmsApi";
import { cn, formatTableDate } from "@/lib/utils";
import { ArchiveRestore, ChevronDown, ChevronRight, GitBranch, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  projectId: string;
  /** When true, omits outer section card (for tabbed settings layout). */
  embedded?: boolean;
};

type TreeNode = {
  task: PmsTaskDto;
  children: TreeNode[];
};

function buildDeletedTree(items: PmsTaskDto[]): TreeNode[] {
  const byParent = new Map<string | null, PmsTaskDto[]>();
  items.forEach((task) => {
    const key = task.parentTaskId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(task);
    byParent.set(key, list);
  });

  const deletedIds = new Set(items.map((t) => t.id));
  const roots = items.filter((t) => !t.parentTaskId || !deletedIds.has(t.parentTaskId));

  const buildChildren = (parentId: string): TreeNode[] =>
    (byParent.get(parentId) ?? []).map((task) => ({
      task,
      children: buildChildren(task.id),
    }));

  return roots.map((task) => ({
    task,
    children: buildChildren(task.id),
  }));
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function DeletedTaskRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  onRestore,
  onPermanentDelete,
  busyId,
}: {
  node: TreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onRestore: (task: PmsTaskDto) => void;
  onPermanentDelete: (task: PmsTaskDto) => void;
  busyId: string | null;
}) {
  const { task, children } = node;
  const hasKids = children.length > 0;
  const isExpanded = expanded[task.id] !== false;
  const isBusy = busyId === task.id;

  return (
    <Fragment>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-dashed border-muted-foreground/20 bg-muted/20 px-4 py-3 text-sm",
          depth > 0 && "border-l-2 border-l-muted-foreground/25",
        )}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasKids ? (
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              onClick={() => onToggleExpand(task.id)}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="min-w-0 truncate font-medium text-muted-foreground line-through">{task.title}</span>
          {hasKids && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {children.length}
            </span>
          )}
          {depth > 0 && task.parentTitle && (
            <span className="hidden truncate text-xs text-muted-foreground/80 sm:inline">
              under {task.parentTitle}
            </span>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 rounded-lg text-[10px] capitalize">
          {task.status.replace(/_/g, " ")}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          Deleted {formatTableDate(task.deletedAt)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg border-slate-200 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            disabled={isBusy}
            onClick={() => onRestore(task)}
          >
            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 rounded-lg"
            disabled={isBusy}
            onClick={() => onPermanentDelete(task)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete forever
          </Button>
        </div>
      </div>
      {hasKids && isExpanded &&
        children.map((child) => (
          <DeletedTaskRow
            key={child.task.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            busyId={busyId}
          />
        ))}
    </Fragment>
  );
}

function DeletedTasksListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-muted-foreground/20">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-3 border-b border-dashed border-muted-foreground/20 bg-muted/20 px-4 py-3"
        >
          <Skeleton className="h-4 w-[45%] bg-slate-100" />
          <Skeleton className="h-5 w-16 rounded-lg bg-slate-100" />
          <Skeleton className="h-3 w-24 bg-slate-100" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg bg-slate-100" />
            <Skeleton className="h-8 w-24 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PmsDeletedTasksPanel({ projectId, embedded = false }: Props) {
  const [items, setItems] = useState<PmsTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PmsTaskDto | null>(null);
  const [restoreDescendants, setRestoreDescendants] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [permanentTarget, setPermanentTarget] = useState<PmsTaskDto | null>(null);
  const [permanentDescendants, setPermanentDescendants] = useState(0);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await pmsApi.listDeletedTasks(projectId);
      setItems(r.items);
      setExpanded((prev) => {
        const next = { ...prev };
        r.items.forEach((t) => {
          if (r.items.some((c) => c.parentTaskId === t.id) && !(t.id in next)) {
            next[t.id] = true;
          }
        });
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load deleted tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildDeletedTree(items), [items]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openRestoreDialog = (task: PmsTaskDto) => {
    const node = findNode(tree, task.id) ?? { task, children: [] };
    setRestoreDescendants(countDescendants(node));
    setRestoreTarget(task);
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setBusyId(restoreTarget.id);
    try {
      const r = await pmsApi.restoreTask(restoreTarget.id);
      toast.success(`Restored ${r.count} task${r.count === 1 ? "" : "s"}`);
      setRestoreTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
      setBusyId(null);
    }
  };

  const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.task.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const openPermanentDialog = (task: PmsTaskDto) => {
    const node = findNode(tree, task.id) ?? { task, children: [] };
    setPermanentDescendants(countDescendants(node));
    setPermanentTarget(task);
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return;
    setBusyId(permanentTarget.id);
    try {
      const r = await pmsApi.permanentDeleteTask(permanentTarget.id);
      toast.success(`Permanently removed ${r.count} task${r.count === 1 ? "" : "s"}`);
      setPermanentTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Permanent delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const panelBody = loading ? (
    <DeletedTasksListSkeleton />
  ) : items.length === 0 ? (
    <div className="rounded-xl border border-dashed border-muted-foreground/25 px-4 py-10 text-center text-sm text-muted-foreground">
      No deleted tasks for this project.
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-muted-foreground/20">
      {tree.map((node) => (
        <DeletedTaskRow
          key={node.task.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onRestore={openRestoreDialog}
          onPermanentDelete={openPermanentDialog}
          busyId={busyId}
        />
      ))}
    </div>
  );

  return (
    <>
      {embedded ? (
        panelBody
      ) : (
        <PmsSectionCard
          title="Deleted tasks"
          description="Soft-deleted tasks can be restored with their subtasks. Permanent deletion cannot be undone."
        >
          {panelBody}
        </PmsSectionCard>
      )}

      <PmsTaskRestoreDialog
        task={restoreTarget}
        open={!!restoreTarget}
        onOpenChange={(open) => !open && !restoring && setRestoreTarget(null)}
        onConfirm={handleRestore}
        loading={restoring}
        subtaskCount={restoreDescendants}
      />

      <AlertDialog open={!!permanentTarget} onOpenChange={(open) => !open && setPermanentTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this task?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{permanentTarget?.title}</strong> and all deleted
                  subtasks will be removed from the database. This cannot be undone.
                </p>
                {permanentDescendants > 0 && (
                  <p>
                    {permanentDescendants} subtask{permanentDescendants === 1 ? "" : "s"} will also be
                    permanently deleted.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handlePermanentDelete();
              }}
            >
              {busyId ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
