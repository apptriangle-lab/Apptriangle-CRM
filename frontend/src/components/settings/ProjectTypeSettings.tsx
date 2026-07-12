import { useEffect, useMemo, useState } from "react";
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
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { settingsService, type ProjectTypeDto } from "@/services/settingsService";
import { buildProjectTypeColorIndexMap, projectTypeChipClass } from "@/components/pms/projectTypeChipStyles";
import { z } from "zod";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be under 200 characters"),
});

export function ProjectTypeSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [projectTypes, setProjectTypes] = useState<ProjectTypeDto[]>([]);
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
    settingsService
      .listAllProjectTypes()
      .then((types) => {
        const sorted = [...types].sort((a, b) => {
          const orderA = a.sortOrder ?? 0;
          const orderB = b.sortOrder ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        setProjectTypes(sorted);
      })
      .catch(() => toast.error("Failed to load project types"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const colorIndexById = useMemo(() => buildProjectTypeColorIndexMap(projectTypes), [projectTypes]);

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
        await settingsService.updateProjectType(editingId, {
          name: result.data.name,
          isActive: form.isActive,
        });
        toast.success("Project type updated");
      } else {
        await settingsService.createProjectType({ name: result.data.name });
        toast.success("Project type added");
      }
      fetchData();
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (type: ProjectTypeDto) => {
    setForm({ name: type.name, isActive: type.isActive ?? true });
    setEditingId(type.id);
    setErrors({});
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    setDeletingId(typeToDelete);
    try {
      await settingsService.deleteProjectType(typeToDelete);
      toast.success("Project type deleted");
      fetchData();
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <Loader message="Loading..." size="lg" className="py-16" />;
  }

  return (
    <div className="space-y-6">
      {!hideHeader ? (
        <div>
          <h2 className="text-xl font-semibold">Project Types</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Types shown when creating PMS projects
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {projectTypes.length} type{projectTypes.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add type
        </Button>
      </div>

      {projectTypes.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No project types"
          description="Add project types for the create project form."
          actionLabel="Add type"
          onAction={() => { resetForm(); setOpen(true); }}
        />
      ) : (
        <ScrollArea className="h-[min(420px,50vh)] rounded-lg border border-border/60">
          <ul className="divide-y divide-border/60">
            {projectTypes.map((type) => (
              <li
                key={type.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={projectTypeChipClass(type.id, colorIndexById.get(type.id))}
                    >
                      {type.name}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        type.isActive !== false
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }
                    >
                      {type.isActive !== false ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(type)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setTypeToDelete(type.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit project type" : "Add project type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-type-name">Name</Label>
              <Input
                id="project-type-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Internal, Client, R&D"
              />
              {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
            </div>
            {editingId ? (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="project-type-active">Active</Label>
                <Switch
                  id="project-type-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                />
              </div>
            ) : null}
            <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project type?</AlertDialogTitle>
            <AlertDialogDescription>
              Projects using this type must be reassigned first. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
