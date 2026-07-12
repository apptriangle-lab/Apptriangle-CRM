import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Coins, Globe2, Hash, Trash2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { currenciesApi, type CurrencyDto } from "@/lib/api";
import { z } from "zod";
import { cn } from "@/lib/utils";

const currencySchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(10, "Code must be under 10 characters"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  symbol: z.string().trim().max(10, "Symbol must be under 10 characters").optional(),
});

export interface CurrencySettingsRef {
  openCreate: () => void;
}

export const CurrencySettings = forwardRef<CurrencySettingsRef, { hideHeader?: boolean }>(({ hideHeader = false }, ref) => {
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", symbol: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const fetchCurrencies = () => {
    setLoading(true);
    currenciesApi
      .list()
      .then(setCurrencies)
      .catch(() => toast.error("Failed to load currencies"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const resetForm = () => {
    setForm({ code: "", name: "", symbol: "" });
    setErrors({});
    setEditingId(null);
  };

  const handleSave = async () => {
    const result = currencySchema.safeParse({
      code: form.code.trim(),
      name: form.name.trim(),
      symbol: form.symbol.trim() || undefined,
    });
    
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
      const payload = {
        code: result.data.code.toUpperCase(),
        name: result.data.name,
        symbol: result.data.symbol ?? "",
      };
      if (editingId) {
        await currenciesApi.update(editingId, payload);
        toast.success("Currency updated successfully");
      } else {
        await currenciesApi.create(payload);
        toast.success("New currency added");
      }
      fetchCurrencies();
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!editingId) return;

    setDeleting(true);
    try {
      await currenciesApi.delete(editingId);
      toast.success("Currency removed");
      fetchCurrencies();
      setOpen(false);
      setDeleteConfirmOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (c: CurrencyDto) => {
    setForm({ code: c.code, name: c.name, symbol: c.symbol ?? "" });
    setEditingId(c.id);
    setErrors({});
    setOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCreate,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
              <Globe2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Currencies</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure currency codes and symbols used across the platform.
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Currency
          </Button>
        </div>
      )}

      {loading ? (
        <Loader message="Syncing currencies…" size="lg" className="py-20" />
      ) : currencies.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No currencies yet"
          description="Click the button above to add your first currency."
          actionLabel="Add Currency"
          onAction={openCreate}
        />
      ) : (
        <div className="rounded-xl border border-border shadow-sm bg-card overflow-hidden max-w-4xl">
          {currencies.length > 7 ? (
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="px-6 py-4 w-[180px]">ISO Code</TableHead>
                    <TableHead>Currency Name</TableHead>
                    <TableHead className="w-[120px] text-center">Symbol</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((c) => (
                    <TableRow 
                      key={c.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => openEdit(c)}
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <span className="font-bold font-mono text-primary tracking-widest bg-primary/5 px-2 py-1 rounded border border-primary/10">
                            {c.code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg font-bold border shadow-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {c.symbol || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
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
                  <TableHead className="px-6 py-4 w-[180px]">ISO Code</TableHead>
                  <TableHead>Currency Name</TableHead>
                  <TableHead className="w-[120px] text-center">Symbol</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((c) => (
                  <TableRow 
                    key={c.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <span className="font-bold font-mono text-primary tracking-widest bg-primary/5 px-2 py-1 rounded border border-primary/10">
                          {c.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg font-bold border shadow-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {c.symbol || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Action Dialog (Edit/Add/Delete) */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetForm(); setDeleteConfirmOpen(false); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary rounded-lg text-primary-foreground shadow-sm">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {editingId ? "Update Currency" : "New Currency"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId ? "Modify currency details or remove this record." : "Enter details for the new currency."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">ISO Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                  className="h-10 font-mono font-bold uppercase tracking-widest focus:ring-primary"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="US Dollar"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Currency Symbol</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex items-center justify-center border-r pr-2">
                  <Hash className="h-3 w-3" />
                </span>
                <Input
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="e.g. $, £, ৳"
                  className="pl-10 h-10 font-medium"
                  maxLength={10}
                />
              </div>
            </div>

            {(errors.code || errors.name) && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive font-medium space-y-1">
                  {errors.code && <p>{errors.code}</p>}
                  {errors.name && <p>{errors.name}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/30 p-4 border-t flex items-center justify-between gap-3">
            {editingId ? (
              <Button
                variant="destructive"
                type="button"
                onClick={openDeleteConfirm}
                disabled={deleting || saving}
                className="shadow-sm bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-destructive/20"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || deleting}
                className="px-8 font-semibold shadow-sm"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add Currency"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Delete Currency?</DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  You are about to permanently remove{" "}
                  <span className="font-bold text-foreground">
                    {form.code || "—"} ({form.name || "—"})
                  </span>
                  . This might affect historical data if this currency was used in existing accounts.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="bg-muted/30 px-6 py-4 flex flex-col gap-2">
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting} className="w-full font-bold">
              {deleting ? "Deleting..." : "Confirm Deletion"}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} className="w-full">
              Nevermind, keep it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});