import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, CalendarDays, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { leavesApi, type LeaveTypeDto } from "@/lib/api";
import { z } from "zod";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be under 200 characters"),
});

export function LeaveTypeSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    leavesApi.getAllTypes()
      .then((types) => {
        // Sort by createdAt descending (newest first)
        const sorted = [...types].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setLeaveTypes(sorted);
      })
      .catch(() => toast.error("Failed to load leave types"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({ name: "", isActive: true });
    setErrors({});
    setEditingId(null);
  };

  const handleSave = async () => {
    const result = nameSchema.safeParse({ name: form.name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      if (editingId) {
        await leavesApi.updateType(editingId, { name: result.data.name, isActive: form.isActive });
        toast.success("Leave type updated");
      } else {
        await leavesApi.createType({ name: result.data.name });
        toast.success("Leave type added");
      }
      fetchData();
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (type: LeaveTypeDto) => {
    setForm({ name: type.name, isActive: type.isActive ?? true });
    setEditingId(type.id);
    setErrors({});
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    setDeletingId(typeToDelete);
    try {
      await leavesApi.deleteType(typeToDelete);
      toast.success("Leave type deleted");
      fetchData();
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setTypeToDelete(id);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return <Loader message="Loading..." size="lg" className="py-16" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Leave Types</span>
          <Badge variant="outline" className="text-xs">{leaveTypes.length}</Badge>
        </div>
        <Button 
          onClick={() => { resetForm(); setOpen(true); }} 
          size="sm"
          variant="outline"
          className="h-7"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add
        </Button>
      </div>
      {leaveTypes.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border rounded-lg">
          <EmptyState icon={CalendarDays} title="No leave types" description="Add your first leave type" />
        </div>
      ) : (
        <ScrollArea className="h-[320px] border border-border rounded-lg">
          <div className="divide-y">
            {leaveTypes.map((type) => (
              <div 
                key={type.id} 
                onClick={() => openEdit(type)}
                className="px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="text-sm truncate">{type.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={type.isActive ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                    {type.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Leave Type Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Leave Type" : "New Leave Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter leave type name"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            {editingId && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            )}
            {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            <div className="flex justify-between items-center">
              {editingId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setOpen(false);
                    openDeleteDialog(editingId);
                  }}
                  disabled={saving || deletingId === editingId}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <div className="flex justify-end gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Leave Type Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? This action cannot be undone. You cannot delete a leave type that is used by existing leave requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
