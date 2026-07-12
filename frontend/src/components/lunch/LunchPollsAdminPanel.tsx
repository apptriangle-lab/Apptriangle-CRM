import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lunchApi, type LunchPollDto } from "@/lib/lunchApi";
import { LunchCreatePollModal } from "@/components/lunch/LunchCreatePollModal";
import { LunchEditPollModal } from "@/components/lunch/LunchEditPollModal";
import { LunchPollDeleteConfirmModal } from "@/components/lunch/LunchPollDeleteConfirmModal";
import { LunchPollsListTable } from "@/components/lunch/LunchPollsListTable";
import { LUNCH_ORDER_CARD } from "@/components/lunch/lunchOrderSummaryStyles";
import { cn } from "@/lib/utils";

export function LunchPollsAdminPanel() {
  const [polls, setPolls] = useState<LunchPollDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPollId, setEditPollId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LunchPollDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleEditClose = useCallback((open: boolean) => {
    if (!open) setEditPollId(null);
  }, []);

  const handleDeleteClose = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolls(await lunchApi.listPolls());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load polls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await lunchApi.deletePoll(deleteTarget.id);
      toast.success("Poll deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete poll");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Polls</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Create and manage daily lunch polls for your team.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-[13px] text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
        >
          <Plus className="h-4 w-4" />
          Create poll
        </Button>
      </div>

      {loading ? (
        <div className={cn(LUNCH_ORDER_CARD, "flex min-h-[160px] flex-1 items-center justify-center")}>
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : polls.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-orange-200/80 bg-gradient-to-br from-orange-50/40 to-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(251,146,60,0.06)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
            <ClipboardList className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-stone-900">No polls yet</h2>
          <p className="max-w-sm text-[13px] text-stone-500">
            Create your first lunch poll to start collecting team votes.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-1 h-9 gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-[13px] text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
          >
            <Plus className="h-4 w-4" />
            Create poll
          </Button>
        </div>
      ) : (
        <LunchPollsListTable polls={polls} onEdit={setEditPollId} onDelete={setDeleteTarget} />
      )}

      <LunchCreatePollModal open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <LunchEditPollModal
        open={Boolean(editPollId)}
        onOpenChange={handleEditClose}
        pollId={editPollId}
        onSaved={load}
      />

      <LunchPollDeleteConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={handleDeleteClose}
        poll={deleteTarget}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
