import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { expensePurposesApi, type ExpensePurposeDto } from "@/lib/api";
import { z } from "zod";

const purposeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
});

export function ExpensePurposeSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [purposes, setPurposes] = useState<ExpensePurposeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPurposes = () => {
    setLoading(true);
    expensePurposesApi
      .list()
      .then(setPurposes)
      .catch(() => toast.error("Failed to load expense purposes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPurposes();
  }, []);

  const resetForm = () => {
    setForm({ name: "", isActive: true });
    setErrors({});
    setEditingId(null);
  };

  const handleSave = async () => {
    const result = purposeSchema.safeParse({ name: form.name.trim() });
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
        await expensePurposesApi.update(editingId, { name: result.data.name, isActive: form.isActive });
        toast.success("Purpose updated");
      } else {
        await expensePurposesApi.create({ name: result.data.name, isActive: form.isActive });
        toast.success("Purpose added");
      }
      fetchPurposes();
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: ExpensePurposeDto) => {
    setForm({ name: p.name, isActive: p.isActive ?? true });
    setEditingId(p.id);
    setErrors({});
    setOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Expense purposes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add, edit, or remove purposes shown in the expense add form (e.g. Travel, Meals).
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add purpose
        </Button>
      </div>

      {loading ? (
        <Loader message="Loading purposes…" size="lg" className="py-20" />
      ) : purposes.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expense purposes yet"
          description="Add purposes to show in the expense form dropdown."
          actionLabel="Add purpose"
          onAction={openCreate}
        />
      ) : (
        <div className="data-table rounded-xl border border-border overflow-hidden">
          {purposes.length > 7 ? (
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purposes.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.isActive !== false ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                          {p.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purposes.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.isActive !== false ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {p.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit purpose" : "Add purpose"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Travel, Meals"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            {editingId && (
              <div className="flex items-center gap-3">
                <Switch id="purpose-active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
                <Label htmlFor="purpose-active" className="cursor-pointer font-normal">Active</Label>
              </div>
            )}
            {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving…" : editingId ? "Save changes" : "Add purpose"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
