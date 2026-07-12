import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { Sale, SalesStatusLog, SalesActivity } from "@/data/mockData";
import {
  companiesApi,
  currenciesApi,
  ordersApi,
  rfqApi,
  salesApi,
  usersApi,
  type CurrencyDto,
  type RfqSummaryDto,
} from "@/lib/api";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { formatStatusLabel } from "@/lib/utils";
import { SalesDetailsHeader } from "@/components/sales-details/SalesDetailsHeader";
import { SalesStatusSidebar } from "@/components/sales-details/SalesStatusSidebar";
import { SalesDetailsTabs } from "@/components/sales-details/SalesDetailsTabs";
import { statusColors } from "@/components/sales-details/constants";

const activitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title must be under 100 characters"),
  note: z.string().trim().min(1, "Note is required").max(500, "Note must be under 500 characters"),
  date: z.string().min(1, "Date is required"),
});

const orderSchema = z.object({
  orderDetails: z.string().trim().min(1, "Order details are required"),
  revenue: z.string().trim().min(1, "Revenue is required").refine((v) => !Number.isNaN(Number(v)), "Revenue must be numeric"),
  orderConfirmationDate: z.string().min(1, "Order confirmation date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  assignTo: z.string().min(1, "Assign To is required"),
});

/** Matches backend: Closed Won / Close Win (any casing, spaces, underscores, hyphens). */
function normalizeDealStatusKey(value: string) {
  return value.toLowerCase().replace(/[_\s-]+/g, "");
}

function isCloseWinDealStatus(value: string) {
  const n = normalizeDealStatusKey(value);
  return n === "closedwon" || n === "closewin";
}

function isLockedClosedWonDealStatus(value: string) {
  return isCloseWinDealStatus(value);
}

function toSale(d: { id: string; companyId: string; category: string; prospect: string; expectedClosingDate: string; expectedRevenue: number; status: string; nextAction?: string; nextActionDate?: string | null; createdByUserId: string; createdAt: string }): Sale {
  return {
    id: d.id,
    companyId: d.companyId,
    category: d.category as Sale["category"],
    prospect: d.prospect,
    expectedClosingDate: d.expectedClosingDate?.split?.("T")[0] ?? d.expectedClosingDate ?? "",
    expectedRevenue: typeof d.expectedRevenue === "number" ? d.expectedRevenue : parseFloat(String(d.expectedRevenue)) || 0,
    status: d.status as Sale["status"],
    nextAction: d.nextAction ?? "",
    nextActionDate: d.nextActionDate?.split?.("T")[0] ?? d.nextActionDate ?? "",
    createdByUserId: d.createdByUserId ?? "",
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
  };
}

function toLog(d: { id: string; salesId: string; fromStatus: string; toStatus: string; note: string; changedByUserId: string; changedAt: string }): SalesStatusLog {
  return { id: d.id, salesId: d.salesId, fromStatus: d.fromStatus as SalesStatusLog["fromStatus"], toStatus: d.toStatus as SalesStatusLog["toStatus"], note: d.note, changedByUserId: d.changedByUserId, changedAt: d.changedAt };
}

function toActivity(d: { id: string; salesId: string; title: string; note: string; date: string; createdByUserId: string; createdAt: string }): SalesActivity {
  return { id: d.id, salesId: d.salesId, title: d.title, note: d.note, date: d.date?.split?.("T")[0] ?? d.date ?? "", createdByUserId: d.createdByUserId, createdAt: d.createdAt };
}

export default function SalesDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPageScopeAdmin, canAccessModule } = useRbac();
  const canAccessRfq = canAccessModule("rfq");
  const salesScopeAdmin = isPageScopeAdmin("sales");
  const { updateSale, changeStatus, deleteSale, getSale, sales, fetchSales } = useSalesStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { salesStatuses, salesCategories } = useStatusConfig();

  const [sale, setSale] = useState<Sale | null>(null);
  const [logs, setLogs] = useState<SalesStatusLog[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [companies, setCompanies] = useState<
    { id: string; name: string; location: string; country: string; currencyId: string; kamUserId: string }[]
  >([]);
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [newStatus, setNewStatus] = useState("lead");
  const [statusNote, setStatusNote] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({ title: "", note: "", date: new Date().toISOString().split("T")[0] });
  const [activityErrors, setActivityErrors] = useState<Record<string, string>>({});
  const [activitySaving, setActivitySaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ prospect: "", companyId: "", category: "", expectedClosingDate: "", expectedRevenue: "", nextAction: "", nextActionDate: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [orderAssignToOpen, setOrderAssignToOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const [orderForm, setOrderForm] = useState({
    orderDetails: "",
    revenue: "",
    orderConfirmationDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    assignTo: "",
    attachments: [] as Array<{ fileName: string; data: string }>,
  });
  /** When set, New Order submit finalizes Closed Won in one backend transaction. */
  const [pendingCloseWin, setPendingCloseWin] = useState<{ targetStatus: string; note: string } | null>(null);
  const [dealRfqs, setDealRfqs] = useState<RfqSummaryDto[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      salesApi.get(id),
      salesApi.logs(id),
      salesApi.activities.list(id),
      companiesApi.list(),
      usersApi.list(),
      currenciesApi.list(),
    ])
      .then(([saleRes, logsRes, activitiesRes, companiesRes, usersRes, currenciesRes]) => {
        setSale(toSale(saleRes));
        setLogs(logsRes.map(toLog));
        setActivities(activitiesRes.map(toActivity));
        setCompanies(
          companiesRes.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location ?? "",
            country: c.country ?? "",
            currencyId: c.currencyId ?? "",
            kamUserId: c.kamUserId ?? "",
          })),
        );
        setCurrencies(currenciesRes);
        setUsers(
          usersRes
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" })),
        );
        fetchSales({ companyId: saleRes.companyId });
        fetchTasks({ companyId: saleRes.companyId });
      })
      .catch(() => setSale(null))
      .finally(() => setLoading(false));
  }, [id, fetchSales, fetchTasks]);

  useEffect(() => {
    if (!sale?.id || !canAccessRfq) {
      setDealRfqs([]);
      return;
    }
    let cancelled = false;
    rfqApi
      .list()
      .then((rows) => {
        if (!cancelled) setDealRfqs(rows.filter((r) => r.salesId === sale.id));
      })
      .catch(() => {
        if (!cancelled) setDealRfqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sale?.id, canAccessRfq]);

  useEffect(() => {
    if (sale && isLockedClosedWonDealStatus(sale.status)) {
      setStatusOpen(false);
      setPendingCloseWin(null);
    }
  }, [sale]);

  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name ?? "—";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";
  const getKamNameByCompany = (companyId: string) => {
    const kamUserId = companies.find((c) => c.id === companyId)?.kamUserId;
    return kamUserId ? getUserName(kamUserId) : "—";
  };
  const formatRevenueWithCurrency = (companyId: string, amount: number) => {
    const company = companies.find((c) => c.id === companyId);
    const currencyId = company?.currencyId;
    const cur = currencyId ? currencies.find((c) => c.id === currencyId) : null;
    const formatted = amount.toLocaleString();
    if (cur?.symbol) return `${cur.symbol}${formatted}`;
    if (cur?.code) return `${formatted} ${cur.code}`;
    return `$${formatted}`;
  };

  const companyTasks = tasks.filter((t) => t.companyId === sale?.companyId);
  const companySales = sales.filter((s) => s.companyId === sale?.companyId && s.id !== sale?.id);

  const refetchLogs = () => {
    if (!id) return;
    salesApi.logs(id).then((list) => setLogs(list.map(toLog)));
  };

  const refetchActivities = () => {
    if (!id) return;
    salesApi.activities.list(id).then((list) => setActivities(list.map(toActivity)));
  };

  const resetActivityForm = () => {
    setActivityForm({ title: "", note: "", date: new Date().toISOString().split("T")[0] });
    setActivityErrors({});
    setEditingActivity(null);
  };

  const handleAddActivity = async () => {
    const result = activitySchema.safeParse(activityForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setActivityErrors(fieldErrors);
      return;
    }
    if (!id) return;
    setActivitySaving(true);
    try {
      if (editingActivity) {
        await salesApi.activities.update(id, editingActivity, { title: activityForm.title.trim(), note: activityForm.note.trim(), date: activityForm.date });
        toast.success("Activity updated");
      } else {
        await salesApi.activities.create(id, {
          title: activityForm.title.trim(),
          note: activityForm.note.trim(),
          date: activityForm.date,
          createdByUserId: user!.id,
        });
        toast.success("Activity added");
      }
      refetchActivities();
      resetActivityForm();
      setActivityDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setActivitySaving(false);
    }
  };

  const openEditActivity = (actId: string) => {
    const act = activities.find((a) => a.id === actId);
    if (act) {
      setActivityForm({ title: act.title, note: act.note, date: act.date });
      setEditingActivity(actId);
      setActivityDialogOpen(true);
    }
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!id) return;
    try {
      await salesApi.activities.delete(id, actId);
      toast.success("Activity deleted");
      refetchActivities();
    } catch {
      toast.error("Failed to delete activity");
    }
  };

  const handleStatusChange = async () => {
    if (!sale) return;
    if (sale.status === newStatus) {
      toast.error("Please select a different status");
      return;
    }
    if (isLockedClosedWonDealStatus(sale.status)) {
      toast.error("This deal is closed won and status cannot be changed");
      return;
    }

    if (isCloseWinDealStatus(newStatus)) {
      setPendingCloseWin({ targetStatus: newStatus, note: statusNote.trim() });
      setOrderErrors({});
      setOrderForm((prev) => ({
        ...prev,
        orderDetails: sale.prospect.trim() || prev.orderDetails,
        revenue: String(sale.expectedRevenue || ""),
        assignTo: user?.id || prev.assignTo,
      }));
      setStatusNote("");
      setNewStatus(sale.status);
      setStatusOpen(false);
      setNewOrderOpen(true);
      toast.info("Complete the order to mark this deal Closed Won");
      return;
    }

    setStatusSaving(true);
    try {
      await changeStatus(sale.id, newStatus as Sale["status"], statusNote.trim() || "", user!.id);
      const updated = await salesApi.get(sale.id);
      setSale(toSale(updated));
      refetchLogs();
      toast.success(`Status changed to ${newStatus}`);
      setStatusNote("");
      setStatusOpen(false);
      void fetchSales({ companyId: sale.companyId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setStatusSaving(false);
    }
  };

  const openStatusChange = () => {
    if (!sale || isLockedClosedWonDealStatus(sale.status)) return;
    setNewStatus(sale.status);
    setStatusNote("");
    setStatusOpen(true);
  };

  const openEditSale = () => {
    if (!sale) return;
    setEditForm({
      prospect: sale.prospect,
      companyId: sale.companyId,
      category: sale.category,
      expectedClosingDate: sale.expectedClosingDate,
      expectedRevenue: String(sale.expectedRevenue),
      nextAction: sale.nextAction ?? "",
      nextActionDate: sale.nextActionDate ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!sale || !editForm.prospect.trim() || !editForm.companyId) return;
    setEditSaving(true);
    try {
      await updateSale(sale.id, {
        prospect: editForm.prospect.trim(),
        companyId: editForm.companyId,
        category: editForm.category as Sale["category"],
        expectedClosingDate: editForm.expectedClosingDate,
        expectedRevenue: parseFloat(editForm.expectedRevenue),
        nextAction: editForm.nextAction.trim(),
        nextActionDate: editForm.nextActionDate || null,
      });
      const updated = await salesApi.get(sale.id);
      setSale(toSale(updated));
      setEditOpen(false);
      toast.success("Deal updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!sale || !confirm("Delete this deal?")) return;
    try {
      await deleteSale(sale.id);
      toast.success("Deal deleted");
      navigate("/sales");
    } catch {
      toast.error("Failed to delete deal");
    }
  };

  const handleOrderAttachmentChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const readers = Array.from(files).map(
      (file) =>
        new Promise<{ fileName: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ fileName: file.name, data: String(reader.result || "") });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        }),
    );
    try {
      const uploaded = await Promise.all(readers);
      setOrderForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
    } catch {
      toast.error("Failed to read attachment(s)");
    }
  };

  const handleRemoveOrderAttachment = (fileName: string) => {
    setOrderForm((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.fileName !== fileName) }));
  };

  const handleCreateOrder = async () => {
    if (!sale) return;
    if (!pendingCloseWin) {
      toast.error("Start by changing status to Closed Won from the deal page");
      return;
    }
    const result = orderSchema.safeParse(orderForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setOrderErrors(fieldErrors);
      return;
    }

    setOrderSaving(true);
    try {
      const data = await ordersApi.create({
        companyId: sale.companyId,
        salesId: sale.id,
        orderDetails: orderForm.orderDetails.trim(),
        revenue: Number(orderForm.revenue),
        orderConfirmationDate: orderForm.orderConfirmationDate,
        deliveryDate: orderForm.deliveryDate,
        assignTo: orderForm.assignTo,
        attachments: orderForm.attachments,
        createdByUserId: user?.id,
        finalizeCloseWon: true,
        closedWonStatus: pendingCloseWin.targetStatus,
        statusChangeNote: pendingCloseWin.note,
        changedByUserId: user?.id,
      });
      if ("sale" in data && data.sale) {
        setSale(toSale(data.sale));
        refetchLogs();
        void fetchSales({ companyId: data.sale.companyId });
        toast.success("Order created and deal marked Closed Won");
      } else {
        toast.success("Order created");
      }
      setPendingCloseWin(null);
      setNewOrderOpen(false);
      setOrderAssignToOpen(false);
      setOrderErrors({});
      setOrderForm({
        orderDetails: "",
        revenue: "",
        orderConfirmationDate: new Date().toISOString().split("T")[0],
        deliveryDate: "",
        assignTo: user?.id ?? "",
        attachments: [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setOrderSaving(false);
    }
  };

  const resetNewOrderModalState = () => {
    setPendingCloseWin(null);
    setOrderErrors({});
    setOrderAssignToOpen(false);
    setOrderForm({
      orderDetails: "",
      revenue: "",
      orderConfirmationDate: new Date().toISOString().split("T")[0],
      deliveryDate: "",
      assignTo: user?.id ?? "",
      attachments: [],
    });
  };

  if (loading && !sale) {
    return (
      <Layout>
        <Loader message="Loading deal…" size="lg" className="py-16" />
      </Layout>
    );
  }

  if (!sale) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Deal not found</h2>
          <Button variant="outline" onClick={() => navigate("/sales")}>Back to Sales</Button>
        </div>
      </Layout>
    );
  }

  const companyName = getCompanyName(sale.companyId);
  const revenueCurrency = (() => {
    const company = companies.find((c) => c.id === sale.companyId);
    const cid = company?.currencyId;
    if (!cid) return null;
    const cur = currencies.find((c) => c.id === cid);
    if (!cur) return null;
    return { symbol: (cur.symbol ?? "").trim(), code: cur.code };
  })();

  return (
    <Layout>
      {/* 
        Parent container controls height with h-full flex flex-col min-h-0.
        We use overflow-hidden so that no full-page scrolling occurs. 
        Children will manage their own overflow-y-auto where needed.
      */}
      <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-background">
        <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:grid-rows-1 lg:gap-6 lg:overflow-hidden">
            <div className="flex min-h-0 flex-col space-y-3 lg:order-1 lg:space-y-4 lg:overflow-hidden">
              <SalesDetailsHeader
                prospect={sale.prospect}
                companyName={companyName}
                categoryKey={sale.category}
                expectedRevenue={sale.expectedRevenue}
                revenueCurrency={revenueCurrency}
                expectedClosingDate={sale.expectedClosingDate}
                createdBy={getUserName(sale.createdByUserId)}
                createdAt={new Date(sale.createdAt).toLocaleDateString()}
                onBack={() => navigate("/sales")}
                onEdit={openEditSale}
                salesScopeAdmin={salesScopeAdmin}
                onDelete={handleDeleteSale}
                onChangeStatus={openStatusChange}
                statusLocked={isLockedClosedWonDealStatus(sale.status)}
              />
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <SalesDetailsTabs
                  activities={activities}
                  companyTasks={companyTasks}
                  companySales={companySales}
                  companyId={sale.companyId}
                  dealRfqs={dealRfqs}
                  canAccessRfq={canAccessRfq}
                  saleId={sale.id}
                  getCompanyName={getCompanyName}
                  formatRevenueWithCurrency={formatRevenueWithCurrency}
                  getKamNameByCompany={getKamNameByCompany}
                  getUserName={getUserName}
                  navigate={navigate}
                  statusColors={statusColors}
                  activityDialogOpen={activityDialogOpen}
                  setActivityDialogOpen={setActivityDialogOpen}
                  activityForm={activityForm}
                  setActivityForm={setActivityForm}
                  activityErrors={activityErrors}
                  activitySaving={activitySaving}
                  editingActivity={editingActivity}
                  resetActivityForm={resetActivityForm}
                  handleAddActivity={handleAddActivity}
                  openEditActivity={openEditActivity}
                  handleDeleteActivity={handleDeleteActivity}
                />
              </div>
            </div>

            <div className="flex flex-col min-h-0 lg:order-2 overflow-hidden">
              <SalesStatusSidebar
                sale={sale}
                logs={logs}
                getUserName={getUserName}
                statusColors={statusColors}
                salesStatuses={salesStatuses}
                statusOpen={statusOpen}
                setStatusOpen={setStatusOpen}
                newStatus={newStatus}
                setNewStatus={setNewStatus}
                statusNote={statusNote}
                setStatusNote={setStatusNote}
                statusSaving={statusSaving}
                onStatusSave={handleStatusChange}
                openStatusChange={openStatusChange}
                isLockedClosedWon={isLockedClosedWonDealStatus(sale.status)}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Prospect *</Label>
              <Input value={editForm.prospect} onChange={(e) => setEditForm({ ...editForm, prospect: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Company *</Label>
              <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={companyOpen} className="w-full justify-between font-normal">
                    {editForm.companyId ? (() => {
                      const c = companies.find((x) => x.id === editForm.companyId);
                      return c ? (c.location || c.country ? `${c.name} · ${[c.location, c.country].filter(Boolean).join(", ")}` : c.name) : "Select company";
                    })() : "Select company"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by company name, location or country..." />
                    <CommandList>
                      <CommandEmpty>No company found.</CommandEmpty>
                      <CommandGroup>
                        {companies.map((comp) => (
                          <CommandItem
                            key={comp.id}
                            value={`${comp.name} ${comp.location} ${comp.country}`}
                            onSelect={() => { setEditForm((prev) => ({ ...prev, companyId: comp.id })); setCompanyOpen(false); }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{comp.name}</span>
                              {(comp.location || comp.country) && <span className="text-xs text-muted-foreground">{[comp.location, comp.country].filter(Boolean).join(" · ")}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{salesCategories.map((c) => <SelectItem key={c} value={c}>{formatStatusLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Expected Revenue *</Label>
                <Input type="number" value={editForm.expectedRevenue} onChange={(e) => setEditForm({ ...editForm, expectedRevenue: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Expected Closing Date *</Label>
              <Input type="date" value={editForm.expectedClosingDate} onChange={(e) => setEditForm({ ...editForm, expectedClosingDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Next Action</Label>
                <Input value={editForm.nextAction} onChange={(e) => setEditForm({ ...editForm, nextAction: e.target.value })} placeholder="Follow-up action" />
              </div>
              <div className="space-y-1">
                <Label>Next Action Date</Label>
                <Input type="date" value={editForm.nextActionDate} onChange={(e) => setEditForm({ ...editForm, nextActionDate: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleEditSave} disabled={editSaving} className="w-full">{editSaving ? "Saving…" : "Update Deal"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newOrderOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetNewOrderModalState();
            if (sale) setNewStatus(sale.status);
            setNewOrderOpen(false);
          } else {
            setNewOrderOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal pt-1">
              Submitting creates the order and marks this deal Closed Won. Cancel keeps the previous status.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Company</Label>
              <Input value={getCompanyName(sale.companyId)} disabled />
            </div>
            <div className="space-y-1">
              <Label>Order Details *</Label>
              <Textarea
                value={orderForm.orderDetails}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, orderDetails: e.target.value }))}
                placeholder="Pre-filled from this deal’s prospect — add more detail as needed."
                className="min-h-[90px]"
              />
              {orderErrors.orderDetails && <p className="text-sm text-destructive">{orderErrors.orderDetails}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Revenue *</Label>
                <Input type="number" min={0} step="0.01" value={orderForm.revenue} onChange={(e) => setOrderForm((prev) => ({ ...prev, revenue: e.target.value }))} />
                {orderErrors.revenue && <p className="text-sm text-destructive">{orderErrors.revenue}</p>}
              </div>
              <div className="space-y-1">
                <Label>Assign To *</Label>
                <Popover open={orderAssignToOpen} onOpenChange={setOrderAssignToOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={orderAssignToOpen}
                      className="w-full justify-between font-normal"
                    >
                      {orderForm.assignTo
                        ? (users.find((x) => x.id === orderForm.assignTo)?.name ?? "Select user")
                        : "Select user"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name, email or mobile…" />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.name} ${u.email} ${u.phone}`}
                              onSelect={() => {
                                setOrderForm((prev) => ({ ...prev, assignTo: u.id }));
                                setOrderAssignToOpen(false);
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{u.name}</span>
                                {(u.email || u.phone) && (
                                  <span className="text-xs text-muted-foreground">
                                    {[u.email, u.phone].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {orderErrors.assignTo && <p className="text-sm text-destructive">{orderErrors.assignTo}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Order Confirmation Date *</Label>
                <Input type="date" value={orderForm.orderConfirmationDate} onChange={(e) => setOrderForm((prev) => ({ ...prev, orderConfirmationDate: e.target.value }))} />
                {orderErrors.orderConfirmationDate && <p className="text-sm text-destructive">{orderErrors.orderConfirmationDate}</p>}
              </div>
              <div className="space-y-1">
                <Label>Delivery Date *</Label>
                <Input type="date" value={orderForm.deliveryDate} onChange={(e) => setOrderForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
                {orderErrors.deliveryDate && <p className="text-sm text-destructive">{orderErrors.deliveryDate}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <Input type="file" multiple onChange={(e) => { void handleOrderAttachmentChange(e.target.files); }} />
              {orderForm.attachments.length > 0 && (
                <div className="rounded-md border p-2 space-y-1">
                  {orderForm.attachments.map((a) => (
                    <div key={a.fileName} className="flex items-center justify-between text-sm">
                      <span className="truncate">{a.fileName}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveOrderAttachment(a.fileName)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOrderOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateOrder} disabled={orderSaving}>{orderSaving ? "Saving..." : "Create Order"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
