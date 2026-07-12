import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Building2, Briefcase, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { departmentsApi, designationsApi, type DepartmentDto, type DesignationDto } from "@/lib/api";
import { z } from "zod";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be under 200 characters"),
});

export function VariablesSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [designations, setDesignations] = useState<DesignationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptOpen, setDeptOpen] = useState(false);
  const [desigOpen, setDesigOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDesigId, setEditingDesigId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", isActive: true });
  const [desigForm, setDesigForm] = useState({ name: "", isActive: true });
  const [deptErrors, setDeptErrors] = useState<Record<string, string>>({});
  const [desigErrors, setDesigErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
  const [deletingDesigId, setDeletingDesigId] = useState<string | null>(null);
  const [deleteDeptDialogOpen, setDeleteDeptDialogOpen] = useState(false);
  const [deleteDesigDialogOpen, setDeleteDesigDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<string | null>(null);
  const [desigToDelete, setDesigToDelete] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([departmentsApi.list(), designationsApi.list()])
      .then(([depts, desigs]) => {
        // Sort by createdAt descending (newest first)
        const sortedDepts = [...depts].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        const sortedDesigs = [...desigs].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setDepartments(sortedDepts);
        setDesignations(sortedDesigs);
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetDeptForm = () => {
    setDeptForm({ name: "", isActive: true });
    setDeptErrors({});
    setEditingDeptId(null);
  };

  const resetDesigForm = () => {
    setDesigForm({ name: "", isActive: true });
    setDesigErrors({});
    setEditingDesigId(null);
  };

  const handleSaveDept = async () => {
    const result = nameSchema.safeParse({ name: deptForm.name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setDeptErrors(fieldErrors);
      return;
    }

    setSaving(true);
    setDeptErrors({});
    try {
      if (editingDeptId) {
        await departmentsApi.update(editingDeptId, { name: result.data.name, isActive: deptForm.isActive });
        toast.success("Department updated");
      } else {
        await departmentsApi.create({ name: result.data.name });
        toast.success("Department added");
      }
      fetchData();
      resetDeptForm();
      setDeptOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setDeptErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDesig = async () => {
    const result = nameSchema.safeParse({ name: desigForm.name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setDesigErrors(fieldErrors);
      return;
    }

    setSaving(true);
    setDesigErrors({});
    try {
      if (editingDesigId) {
        await designationsApi.update(editingDesigId, { name: result.data.name, isActive: desigForm.isActive });
        toast.success("Designation updated");
      } else {
        await designationsApi.create({ name: result.data.name });
        toast.success("Designation added");
      }
      fetchData();
      resetDesigForm();
      setDesigOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setDesigErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const openEditDept = (d: DepartmentDto) => {
    setDeptForm({ name: d.name, isActive: d.isActive ?? true });
    setEditingDeptId(d.id);
    setDeptErrors({});
    setDeptOpen(true);
  };

  const openEditDesig = (d: DesignationDto) => {
    setDesigForm({ name: d.name, isActive: d.isActive ?? true });
    setEditingDesigId(d.id);
    setDesigErrors({});
    setDesigOpen(true);
  };

  const handleDeleteDept = async () => {
    if (!deptToDelete) return;
    setDeletingDeptId(deptToDelete);
    try {
      await departmentsApi.delete(deptToDelete);
      toast.success("Department deleted");
      fetchData();
      setDeleteDeptDialogOpen(false);
      setDeptToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingDeptId(null);
    }
  };

  const handleDeleteDesig = async () => {
    if (!desigToDelete) return;
    setDeletingDesigId(desigToDelete);
    try {
      await designationsApi.delete(desigToDelete);
      toast.success("Designation deleted");
      fetchData();
      setDeleteDesigDialogOpen(false);
      setDesigToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingDesigId(null);
    }
  };

  const openDeleteDeptDialog = (id: string) => {
    setDeptToDelete(id);
    setDeleteDeptDialogOpen(true);
  };

  const openDeleteDesigDialog = (id: string) => {
    setDesigToDelete(id);
    setDeleteDesigDialogOpen(true);
  };

  if (loading) {
    return <Loader message="Loading..." size="lg" className="py-16" />;
  }

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Variables</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage departments and designations for HR records</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Departments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Departments</span>
              <Badge variant="outline" className="text-xs">{departments.length}</Badge>
            </div>
            <Button 
              onClick={() => { resetDeptForm(); setDeptOpen(true); }} 
              size="sm"
              variant="outline"
              className="h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </div>
          {departments.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-lg">
              <EmptyState icon={Building2} title="No departments" description="Add your first department" />
            </div>
          ) : (
            <ScrollArea className="h-[320px] border border-border rounded-lg">
              <div className="divide-y">
                {departments.map((d) => (
                  <div 
                    key={d.id} 
                    onClick={() => openEditDept(d)}
                    className="px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-sm truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={d.isActive ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Designations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Designations</span>
              <Badge variant="outline" className="text-xs">{designations.length}</Badge>
            </div>
            <Button 
              onClick={() => { resetDesigForm(); setDesigOpen(true); }} 
              size="sm"
              variant="outline"
              className="h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </div>
          {designations.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-lg">
              <EmptyState icon={Briefcase} title="No designations" description="Add your first designation" />
            </div>
          ) : (
            <ScrollArea className="h-[320px] border border-border rounded-lg">
              <div className="divide-y">
                {designations.map((d) => (
                  <div 
                    key={d.id} 
                    onClick={() => openEditDesig(d)}
                    className="px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="text-sm truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={d.isActive ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Department Dialog */}
      <Dialog open={deptOpen} onOpenChange={(v) => { setDeptOpen(v); if (!v) resetDeptForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDeptId ? "Edit Department" : "New Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="Enter department name"
              />
              {deptErrors.name && <p className="text-sm text-destructive">{deptErrors.name}</p>}
            </div>
            {editingDeptId && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={deptForm.isActive} onCheckedChange={(v) => setDeptForm({ ...deptForm, isActive: v })} />
              </div>
            )}
            {deptErrors.submit && <p className="text-sm text-destructive">{deptErrors.submit}</p>}
            <div className="flex justify-between items-center">
              {editingDeptId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeptOpen(false);
                    openDeleteDeptDialog(editingDeptId);
                  }}
                  disabled={saving || deletingDeptId === editingDeptId}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <div className="flex justify-end gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setDeptOpen(false); resetDeptForm(); }} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDept} disabled={saving}>
                  {saving ? "Saving..." : editingDeptId ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Designation Dialog */}
      <Dialog open={desigOpen} onOpenChange={(v) => { setDesigOpen(v); if (!v) resetDesigForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDesigId ? "Edit Designation" : "New Designation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={desigForm.name}
                onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                placeholder="Enter designation name"
              />
              {desigErrors.name && <p className="text-sm text-destructive">{desigErrors.name}</p>}
            </div>
            {editingDesigId && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={desigForm.isActive} onCheckedChange={(v) => setDesigForm({ ...desigForm, isActive: v })} />
              </div>
            )}
            {desigErrors.submit && <p className="text-sm text-destructive">{desigErrors.submit}</p>}
            <div className="flex justify-between items-center">
              {editingDesigId && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDesigOpen(false);
                    openDeleteDesigDialog(editingDesigId);
                  }}
                  disabled={saving || deletingDesigId === editingDesigId}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <div className="flex justify-end gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setDesigOpen(false); resetDesigForm(); }} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDesig} disabled={saving}>
                  {saving ? "Saving..." : editingDesigId ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirmation Dialog */}
      <AlertDialog open={deleteDeptDialogOpen} onOpenChange={setDeleteDeptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDeptId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDept}
              disabled={deletingDeptId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDeptId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Designation Confirmation Dialog */}
      <AlertDialog open={deleteDesigDialogOpen} onOpenChange={setDeleteDesigDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Designation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this designation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDesigId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDesig}
              disabled={deletingDesigId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDesigId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
