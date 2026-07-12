import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { accountParticularsApi, type AccountParticularDto } from "@/lib/api";
import { z } from "zod";
import { cn } from "@/lib/utils";

const particularSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be under 200 characters"),
  type: z.enum(["received", "expense"]),
});

export function AccountParticularSettings({ hideHeader = false }: { hideHeader?: boolean }) {
  const [received, setReceived] = useState<AccountParticularDto[]>([]);
  const [expense, setExpense] = useState<AccountParticularDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "received" as "received" | "expense" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      accountParticularsApi.list({ type: "received" }),
      accountParticularsApi.list({ type: "expense" }),
    ])
      .then(([r, e]) => {
        setReceived(r);
        setExpense(e);
      })
      .catch(() => toast.error("Failed to load particulars"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setForm({ name: "", type: "received" });
    setErrors({});
    setEditingId(null);
  };

  const handleSave = async () => {
    const result = particularSchema.safeParse({ name: form.name.trim(), type: form.type });
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
        await accountParticularsApi.update(editingId, { name: result.data.name, type: result.data.type });
        toast.success("Particular updated");
      } else {
        await accountParticularsApi.create({ name: result.data.name, type: result.data.type });
        toast.success("Particular added");
      }
      fetchAll();
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: AccountParticularDto) => {
    setForm({ name: p.name, type: (p.type === "expense" ? "expense" : "received") as "received" | "expense" });
    setEditingId(p.id);
    setErrors({});
    setOpen(true);
  };

  const openCreate = (type: "received" | "expense") => {
    resetForm();
    setForm({ name: "", type });
    setOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
              <Settings2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Account Particulars</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure the dropdown options for your financial entries.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Loader message="Synchronizing particulars…" size="lg" className="py-20" />
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Received Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-700" />
                </div>
                <h3 className="font-bold text-emerald-900">Received Types</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 font-semibold"
                onClick={() => openCreate("received")}
              >
                <Plus className="h-4 w-4 mr-1" /> Add New
              </Button>
            </div>
            
            <div className="rounded-xl border border-border shadow-sm bg-card overflow-hidden">
              {received.length > 7 ? (
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="font-semibold py-3">Particular Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {received.map((p) => (
                        <TableRow
                          key={p.id}
                          className="group hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openEdit(p)}
                        >
                          <TableCell className="font-medium text-foreground py-3">
                            {p.name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold py-3">Particular Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {received.length === 0 ? (
                      <TableRow>
                        <TableCell className="h-24 text-center text-muted-foreground italic">
                          No received particulars configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      received.map((p) => (
                        <TableRow
                          key={p.id}
                          className="group hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openEdit(p)}
                        >
                          <TableCell className="font-medium text-foreground py-3">
                            {p.name}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Expense Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-orange-50/50 p-3 rounded-xl border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <ArrowUpRight className="h-4 w-4 text-orange-700" />
                </div>
                <h3 className="font-bold text-orange-900">Expense Types</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-orange-700 hover:bg-orange-100 hover:text-orange-800 font-semibold"
                onClick={() => openCreate("expense")}
              >
                <Plus className="h-4 w-4 mr-1" /> Add New
              </Button>
            </div>

            <div className="rounded-xl border border-border shadow-sm bg-card overflow-hidden">
              {expense.length > 7 ? (
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="font-semibold py-3">Particular Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expense.map((p) => (
                        <TableRow
                          key={p.id}
                          className="group hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openEdit(p)}
                        >
                          <TableCell className="font-medium text-foreground py-3">
                            {p.name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold py-3">Particular Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expense.length === 0 ? (
                      <TableRow>
                        <TableCell className="h-24 text-center text-muted-foreground italic">
                          No expense particulars configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expense.map((p) => (
                        <TableRow
                          key={p.id}
                          className="group hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openEdit(p)}
                        >
                          <TableCell className="font-medium text-foreground py-3">
                            {p.name}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modernized Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-2">
               <div className={cn(
                  "p-2 rounded-lg",
                  form.type === "received" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                )}>
                  <Wallet className="h-5 w-5" />
                </div>
              <DialogTitle className="text-xl">
                {editingId ? "Edit Particular" : "New Particular"}
              </DialogTitle>
            </div>
            <DialogDescription>
              Provide a name to categorize your {form.type} transactions.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Category Name *
              </Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} 
                placeholder="e.g. Office Supplies, Client Payment" 
                className="focus-visible:ring-primary h-10"
              />
              {errors.name && <p className="text-xs text-destructive font-medium">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Transaction Nature
              </Label>
              <Select 
                value={form.type} 
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "received" | "expense" }))}
              >
                <SelectTrigger className={cn(
                  "h-10 font-medium",
                  form.type === "received" ? "border-emerald-200 bg-emerald-50/50" : "border-orange-200 bg-orange-50/50"
                )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received (Income)</SelectItem>
                  <SelectItem value="expense">Expense (Spending)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {errors.submit && <p className="text-xs text-destructive font-medium">{errors.submit}</p>}
          </div>

          <div className="bg-muted/30 p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className={cn(
                "px-8 transition-all font-semibold",
                form.type === "received" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"
              )}
            >
              {saving ? "Processing..." : editingId ? "Update Category" : "Add Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}