import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, UserRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { employeeTypesApi, type EmployeeTypeDto } from "@/lib/api";
import { z } from "zod";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be under 200 characters"),
});

export function EmployeeTypeSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeTypeDto[]>([]);
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
    employeeTypesApi
      .list()
      .then((types) => {
        const sorted = [...types].sort((a, b) => {
          const orderA = a.sortOrder ?? 0;
          const orderB = b.sortOrder ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        setEmployeeTypes(sorted);
      })
      .catch(() => toast.error("Failed to load employee types"))
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
        await employeeTypesApi.update(editingId, { name: result.data.name, isActive: form.isActive });
        toast.success("Employee type updated");
      } else {
        await employeeTypesApi.create({ name: result.data.name });
        toast.success("Employee type added");
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

  const openEdit = (type: EmployeeTypeDto) => {
    setForm({ name: type.name, isActive: type.isActive ?? true });
    setEditingId(type.id);
    setErrors({});
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    setDeletingId(typeToDelete);
    try {
      await employeeTypesApi.delete(typeToDelete);
      toast.success("Employee type deleted");
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
      {!hideHeader && (
        <div className="flex items-start gap-4 border-b pb-4 mb-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/20 to-primary/5">
            <UserRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Employee Types</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage employment types used on employee HR profiles.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Employee Types</span>
          <Badge variant="outline" className="text-xs">
            {employeeTypes.length}
          </Badge>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          size="sm"
          variant="outline"
          className="h-7"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {employeeTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <EmptyState icon={UserRound} title="No employee types" description="Add your first employee type" />
        </div>
      ) : (
        <ScrollArea className="h-[320px] rounded-lg border border-border">
          <div className="divide-y">
            {employeeTypes.map((type) => (
              <div
                key={type.id}
                onClick={() => openEdit(type)}
                className="flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{type.name}</span>
                <Badge variant={type.isActive ? "default" : "secondary"} className="h-5 shrink-0 px-1.5 text-[10px]">
                  {type.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Employee Type" : "New Employee Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Full Time, Contract"
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
            <div className="flex items-center justify-between">
              {editingId ? (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setOpen(false);
                    openDeleteDialog(editingId);
                  }}
                  disabled={saving || deletingId === editingId}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              <div className="ml-auto flex justify-end gap-2">
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee type? This action cannot be undone.
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
