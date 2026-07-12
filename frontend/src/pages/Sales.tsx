import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { Sale, COUNTRIES } from "@/data/mockData";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Search, CalendarIcon, DollarSign, ChevronsUpDown, Trash2, Package, CalendarDays, Truck, User2, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import { useNavigate } from "react-router-dom";
import { companiesApi, usersApi, currenciesApi, ordersApi, renewalsApi } from "@/lib/api";
import type { CurrencyDto, OrderDto, OrdersListParams, RenewalDto } from "@/lib/api";
import { z } from "zod";
import { differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { formatTableDate } from "@/lib/utils";
import { cn, formatStatusLabel } from "@/lib/utils";

const statusColors: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  prospect: "bg-info/10 text-info",
  negotiation: "bg-warning/10 text-warning",
  closed: "bg-success/10 text-success",
  disqualified: "bg-destructive/10 text-destructive",
};

const categoryColors: Record<string, string> = {
  hot: "bg-destructive/10 text-destructive",
  warm: "bg-warning/10 text-warning",
  cold: "bg-info/10 text-info",
};

function normalizeOrderStatusKey(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "_");
}

const saleSchema = z.object({
  prospect: z.string().trim().min(1, "Prospect is required").max(200, "Max 200 characters"),
  companyId: z.string().min(1, "Company is required"),
  category: z.string().min(1, "Category is required"),
  expectedClosingDate: z.string().min(1, "Expected closing date is required"),
  expectedRevenue: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Revenue must be a number >= 0"),
  status: z.string().min(1),
});

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Name must be under 100 characters"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be under 200 characters"),
  country: z.string().trim().min(1, "Country is required"),
  currencyId: z.string().min(1, "Currency is required"),
  kamUserId: z.string().min(1, "Key Account Manager is required"),
});

const emptyForm = { prospect: "", companyId: "", category: "warm", expectedClosingDate: "", expectedRevenue: "", status: "lead" };
const emptyRenewalForm = { companyId: "", productDetails: "", renewalType: "existing" as "existing" | "potential", source: "", renewalDate: "" };

const renewalSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  productDetails: z.string().trim().min(1, "Product details are required").max(500, "Max 500 characters"),
  renewalType: z.enum(["existing", "potential"]),
  source: z.string().trim().max(150, "Max 150 characters"),
  renewalDate: z.string().min(1, "Renewal date is required"),
});

export default function Sales() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isPageScopeAdmin } = useRbac();
  const salesScopeAdmin = isPageScopeAdmin("sales");
  const { sales, fetchSales, addSale, updateSale, changeStatus, deleteSale } = useSalesStore();
  const { salesStatuses, salesCategories, orderStatuses, orderNextTodos } = useStatusConfig();

  const activeTab = searchParams.get("tab") || "funnel";
  const setActiveTab = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  const [companies, setCompanies] = useState<{ id: string; name: string; location: string; country: string; kamUserId: string; currencyId: string }[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterKam, setFilterKam] = useState("all");
  const [filterCompanyOpen, setFilterCompanyOpen] = useState(false);
  const [filterKamOpen, setFilterKamOpen] = useState(false);
  const [closeDateRange, setCloseDateRange] = useState<{ from?: Date; to?: Date }>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState("");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
  const [addCompanySaving, setAddCompanySaving] = useState(false);
  const [addCompanyErrors, setAddCompanyErrors] = useState<Record<string, string>>({});
  const [addCompanyCountryOpen, setAddCompanyCountryOpen] = useState(false);
  const [addCompanyKamOpen, setAddCompanyKamOpen] = useState(false);
  /** Which form receives the new company id after add-company dialog saves */
  const [addCompanyTarget, setAddCompanyTarget] = useState<"deal" | "renewal">("deal");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSaleId, setStatusSaleId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("lead");
  const [statusNote, setStatusNote] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [renewals, setRenewals] = useState<RenewalDto[]>([]);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderFilterCompany, setOrderFilterCompany] = useState("all");
  const [orderFilterCompanyOpen, setOrderFilterCompanyOpen] = useState(false);
  const [orderFilterNextAction, setOrderFilterNextAction] = useState("all");
  const [orderDeliveryDateRange, setOrderDeliveryDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [orderFilterAssignTo, setOrderFilterAssignTo] = useState("all");
  const [orderFilterAssignOpen, setOrderFilterAssignOpen] = useState(false);
  const [orderFilterStatus, setOrderFilterStatus] = useState("all");
  const [orderNextActionDateRange, setOrderNextActionDateRange] = useState<{ from?: Date; to?: Date }>({});

  const [renewalLoading, setRenewalLoading] = useState(true);
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [renewalSearch, setRenewalSearch] = useState("");
  const [renewalFilterCompany, setRenewalFilterCompany] = useState("all");
  const [renewalFilterCompanyOpen, setRenewalFilterCompanyOpen] = useState(false);
  const [renewalFilterKam, setRenewalFilterKam] = useState("all");
  const [renewalFilterType, setRenewalFilterType] = useState<"all" | "existing" | "potential">("all");
  const [renewalDateRange, setRenewalDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [renewalFormOpen, setRenewalFormOpen] = useState(false);
  const [renewalCompanyOpen, setRenewalCompanyOpen] = useState(false);
  const [renewalCompanySearchValue, setRenewalCompanySearchValue] = useState("");
  const [renewalKamOpen, setRenewalKamOpen] = useState(false);
  const [editingRenewalId, setEditingRenewalId] = useState<string | null>(null);
  const [renewalForm, setRenewalForm] = useState(emptyRenewalForm);
  const [renewalErrors, setRenewalErrors] = useState<Record<string, string>>({});
  const [renewalDeleteConfirmOpen, setRenewalDeleteConfirmOpen] = useState(false);
  const [renewalDeleteId, setRenewalDeleteId] = useState<string | null>(null);
  const [renewalDeleting, setRenewalDeleting] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDto | null>(null);
  const [orderModalSaving, setOrderModalSaving] = useState(false);
  const [orderDetailDraft, setOrderDetailDraft] = useState<{
    forwardedTo: string;
    status: string;
    nextAction: string;
    nextActionDate: string;
  }>({
    forwardedTo: "__none__",
    status: "__none__",
    nextAction: "__none__",
    nextActionDate: "",
  });
  const [orderWorkflowModalOpen, setOrderWorkflowModalOpen] = useState(false);
  const [orderWorkflowTarget, setOrderWorkflowTarget] = useState<OrderDto | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState("__none__");
  const [workflowNextAction, setWorkflowNextAction] = useState("__none__");
  const [workflowNextActionDate, setWorkflowNextActionDate] = useState("");

  useEffect(() => {
    companiesApi.list().then((list) => setCompanies(list.map((c) => ({ id: c.id, name: c.name, location: c.location ?? "", country: c.country ?? "", kamUserId: c.kamUserId ?? "", currencyId: c.currencyId ?? "" })))).catch(() => {});
    currenciesApi.list().then(setCurrencies).catch(() => {});
    usersApi.list()
      .then((list) =>
        setUsers(
          list
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (addCompanyOpen) {
      currenciesApi.list().then(setCurrencies).catch(() => {});
    }
  }, [addCompanyOpen]);

  useEffect(() => {
    if (!salesScopeAdmin) setOrderFilterAssignTo("all");
  }, [salesScopeAdmin]);

  useEffect(() => {
    if (!orderDetail) return;
    setOrderDetailDraft({
      forwardedTo: orderDetail.forwardedTo?.trim() ? orderDetail.forwardedTo : "__none__",
      status: normalizeOrderStatusKey(orderDetail.status) || "__none__",
      nextAction: normalizeOrderStatusKey(orderDetail.nextAction) || "__none__",
      nextActionDate: orderDetail.nextActionDate ? orderDetail.nextActionDate.slice(0, 10) : "",
    });
  }, [orderDetail]);

  useEffect(() => {
    setLoading(true);
    const params: { status?: string; companyId?: string; category?: string; createdByUserId?: string } = {};
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterCompany !== "all") params.companyId = filterCompany;
    if (filterCategory !== "all") params.category = filterCategory;
    fetchSales(params)
      .catch(() => toast.error("Failed to load sales"))
      .finally(() => setLoading(false));
  }, [filterStatus, filterCategory, filterCompany, fetchSales]);

  const loadRenewals = async () => {
    setRenewalLoading(true);
    try {
      const list = await renewalsApi.list({
        companyId: renewalFilterCompany !== "all" ? renewalFilterCompany : undefined,
        kamUserId: renewalFilterKam !== "all" ? renewalFilterKam : undefined,
        search: renewalSearch.trim() || undefined,
      });
      setRenewals(list);
    } catch {
      toast.error("Failed to load renewals");
    } finally {
      setRenewalLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, [renewalFilterCompany, renewalFilterKam, renewalSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
      try {
        const params: OrdersListParams = {};
        if (orderFilterCompany !== "all") params.companyId = orderFilterCompany;
        if (orderFilterStatus !== "all") params.status = orderFilterStatus;
        if (orderFilterNextAction !== "all") params.nextAction = orderFilterNextAction;
        if (orderNextActionDateRange.from) params.nextActionDateFrom = format(orderNextActionDateRange.from, "yyyy-MM-dd");
        if (orderNextActionDateRange.to) params.nextActionDateTo = format(orderNextActionDateRange.to, "yyyy-MM-dd");
        if (orderDeliveryDateRange.from) params.deliveryDateFrom = format(orderDeliveryDateRange.from, "yyyy-MM-dd");
        if (orderDeliveryDateRange.to) params.deliveryDateTo = format(orderDeliveryDateRange.to, "yyyy-MM-dd");
        if (salesScopeAdmin) {
          if (orderFilterAssignTo !== "all") params.assignToUserId = orderFilterAssignTo;
        }
        const list = await ordersApi.list(params);
        if (!cancelled) setOrders(list);
      } catch {
        if (!cancelled) toast.error("Failed to load orders");
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    salesScopeAdmin,
    orderFilterCompany,
    orderFilterNextAction,
    orderFilterAssignTo,
    orderFilterStatus,
    orderNextActionDateRange.from?.getTime(),
    orderNextActionDateRange.to?.getTime(),
    orderDeliveryDateRange.from?.getTime(),
    orderDeliveryDateRange.to?.getTime(),
  ]);

  const activeOrderStatusValues = useMemo(
    () => orderStatuses.filter((o) => o.isActive).map((o) => o.value),
    [orderStatuses],
  );

  const activeOrderNextTodoValues = useMemo(
    () => orderNextTodos.filter((o) => o.isActive).map((o) => o.value),
    [orderNextTodos],
  );

  const orderHasActiveFilters = useMemo(() => {
    if (salesScopeAdmin) {
      return (
        orderFilterCompany !== "all" ||
        orderFilterNextAction !== "all" ||
        !!orderDeliveryDateRange.from ||
        !!orderDeliveryDateRange.to ||
        orderFilterAssignTo !== "all" ||
        orderFilterStatus !== "all" ||
        !!orderNextActionDateRange.from ||
        !!orderNextActionDateRange.to
      );
    }
    return (
      orderFilterCompany !== "all" ||
      orderFilterStatus !== "all" ||
      orderFilterNextAction !== "all" ||
      !!orderNextActionDateRange.from ||
      !!orderNextActionDateRange.to ||
      !!orderDeliveryDateRange.from ||
      !!orderDeliveryDateRange.to
    );
  }, [
    salesScopeAdmin,
    orderFilterCompany,
    orderFilterAssignTo,
    orderFilterStatus,
    orderNextActionDateRange.from,
    orderNextActionDateRange.to,
    orderFilterNextAction,
    orderDeliveryDateRange.from,
    orderDeliveryDateRange.to,
  ]);

  const getCompanyName = (companyId: string) => companies.find((c) => c.id === companyId)?.name ?? "—";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";
  const getKamNameByCompany = (companyId: string) => {
    const kamUserId = companies.find((c) => c.id === companyId)?.kamUserId;
    return kamUserId ? getUserName(kamUserId) : "—";
  };

  /** For table: format revenue amount with the company's currency (symbol or code). */
  const formatRevenueWithCurrency = (companyId: string, amount: number) => {
    const company = companies.find((c) => c.id === companyId);
    const currencyId = company?.currencyId;
    const cur = currencyId ? currencies.find((c) => c.id === currencyId) : null;
    const formatted = amount.toLocaleString();
    if (cur?.symbol) return `${cur.symbol}${formatted}`;
    if (cur?.code) return `${formatted} ${cur.code}`;
    return `$${formatted}`;
  };

  /** Currency label (code + symbol) for the selected company in the deal form, or fallback when no company. */
  const expectedRevenueCurrencyLabel = (() => {
    if (!form.companyId) return null;
    const company = companies.find((c) => c.id === form.companyId);
    const currencyId = company?.currencyId;
    if (!currencyId) return null;
    const cur = currencies.find((c) => c.id === currencyId);
    if (!cur) return null;
    return cur.symbol ? `${cur.code} (${cur.symbol})` : cur.code;
  })();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = sales.filter((s) => {
      const company = companies.find((c) => c.id === s.companyId);
      if (filterKam !== "all") {
        if (!company || company.kamUserId !== filterKam) return false;
      }
      if (filterCurrency !== "all") {
        if (!company || company.currencyId !== filterCurrency) return false;
      }
      if (closeDateRange.from && new Date(s.expectedClosingDate) < closeDateRange.from) return false;
      if (closeDateRange.to) {
        const end = new Date(closeDateRange.to);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.expectedClosingDate) > end) return false;
      }
      if (q) {
        const prospect = (s.prospect ?? "").toLowerCase();
        const nextAction = (s.nextAction ?? "").toLowerCase();
        const companyName = (company?.name ?? "").toLowerCase();
        if (!prospect.includes(q) && !companyName.includes(q) && !nextAction.includes(q)) return false;
      }
      return true;
    });
    result.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      // Newest created first (last added at top); invalid dates sort last
      const na = Number.isFinite(ta) ? ta : 0;
      const nb = Number.isFinite(tb) ? tb : 0;
      return nb - na;
    });
    return result;
  }, [sales, companies, filterKam, filterCurrency, closeDateRange, search]);

  /** When filtering by currency: total revenue of filtered deals and label for that currency. */
  const filteredTotalRevenue = useMemo(() => {
    const total = filtered.reduce((sum, s) => sum + s.expectedRevenue, 0);
    if (filterCurrency === "all" || total === 0) return null;
    const cur = currencies.find((c) => c.id === filterCurrency);
    if (!cur) return null;
    const formatted = total.toLocaleString();
    const label = cur.symbol ? `${cur.symbol}${formatted}` : `${formatted} ${cur.code}`;
    return { total, label };
  }, [filtered, filterCurrency, currencies]);

  const filteredRenewals = useMemo(() => {
    return renewals.filter((r) => {
      if (renewalFilterType !== "all" && r.renewalType !== renewalFilterType) return false;
      if (!renewalDateRange.from && !renewalDateRange.to) return true;
      const renewalDate = startOfDay(parseISO(r.renewalDate));
      if (renewalDateRange.from && renewalDate < startOfDay(renewalDateRange.from)) return false;
      if (renewalDateRange.to && renewalDate > startOfDay(renewalDateRange.to)) return false;
      return true;
    });
  }, [renewals, renewalDateRange, renewalFilterType]);

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
    setCompanySearchValue("");
  };

  const refetchCompanies = () =>
    companiesApi
      .list()
      .then((list) =>
        setCompanies(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location ?? "",
            country: c.country ?? "",
            kamUserId: c.kamUserId ?? "",
            currencyId: c.currencyId ?? "",
          })),
        ),
      )
      .catch(() => toast.error("Failed to load companies"));

  const handleAddCompanySave = async () => {
    const result = companySchema.safeParse(newCompanyForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setAddCompanyErrors(fieldErrors);
      return;
    }
    setAddCompanySaving(true);
    setAddCompanyErrors({});
    try {
      const created = await companiesApi.create({
        name: newCompanyForm.name.trim(),
        location: newCompanyForm.location.trim(),
        country: newCompanyForm.country,
        currencyId: newCompanyForm.currencyId,
        kamUserId: newCompanyForm.kamUserId,
      });
      await refetchCompanies();
      if (addCompanyTarget === "renewal") {
        setRenewalForm((prev) => ({ ...prev, companyId: created.id }));
      } else {
        setForm((prev) => ({ ...prev, companyId: created.id }));
      }
      setAddCompanyOpen(false);
      setNewCompanyForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
      setAddCompanyErrors({});
      toast.success(
        addCompanyTarget === "renewal"
          ? "Company added. You can now continue with the renewal."
          : "Company added. You can now continue with the deal.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add company");
      setAddCompanyErrors({ submit: err instanceof Error ? err.message : "Failed to add company" });
    } finally {
      setAddCompanySaving(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (saleId: string) => {
    const s = sales.find((x) => x.id === saleId);
    if (!s) return;
    setForm({
      prospect: s.prospect,
      companyId: s.companyId,
      category: s.category,
      expectedClosingDate: s.expectedClosingDate,
      expectedRevenue: String(s.expectedRevenue),
      status: s.status,
    });
    setEditingId(s.id);
    setErrors({});
    setFormOpen(true);
  };

  const handleSave = async () => {
    const result = saleSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateSale(editingId, {
          prospect: form.prospect.trim(),
          companyId: form.companyId,
          category: form.category as Sale["category"],
          expectedClosingDate: form.expectedClosingDate,
          expectedRevenue: parseFloat(form.expectedRevenue),
        });
        toast.success("Sale updated successfully");
      } else {
        await addSale({
          prospect: form.prospect.trim(),
          companyId: form.companyId,
          category: form.category as Sale["category"],
          expectedClosingDate: form.expectedClosingDate,
          expectedRevenue: parseFloat(form.expectedRevenue),
          status: form.status as Sale["status"],
          createdByUserId: user!.id,
        });
        toast.success("Sale created successfully");
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setErrors({ submit: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusSaleId || !statusNote.trim()) return;
    const s = sales.find((x) => x.id === statusSaleId);
    if (!s || s.status === newStatus) {
      toast.error("Please select a different status");
      return;
    }
    setStatusSaving(true);
    try {
      await changeStatus(statusSaleId, newStatus as Sale["status"], statusNote.trim(), user!.id);
      toast.success(`Status changed to ${newStatus}`);
      setStatusModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async (saleId: string) => {
    if (!confirm("Delete this deal?")) return;
    try {
      await deleteSale(saleId);
      toast.success("Deal deleted");
      if (editingId === saleId) {
        setFormOpen(false);
        resetForm();
      }
    } catch {
      toast.error("Failed to delete deal");
    }
  };

  const resetRenewalForm = () => {
    setRenewalForm(emptyRenewalForm);
    setRenewalErrors({});
    setEditingRenewalId(null);
    setRenewalCompanySearchValue("");
  };

  const openRenewalCreate = () => {
    resetRenewalForm();
    setRenewalFormOpen(true);
  };

  const openRenewalEdit = (row: RenewalDto) => {
    setRenewalForm({
      companyId: row.companyId,
      productDetails: row.productDetails,
      renewalType: row.renewalType || "existing",
      source: row.source,
      renewalDate: row.renewalDate,
    });
    setEditingRenewalId(row.id);
    setRenewalErrors({});
    setRenewalFormOpen(true);
  };

  const handleRenewalSave = async () => {
    const result = renewalSchema.safeParse(renewalForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setRenewalErrors(fieldErrors);
      return;
    }
    setRenewalSaving(true);
    try {
      if (editingRenewalId) {
        await renewalsApi.update(editingRenewalId, {
          companyId: renewalForm.companyId,
          productDetails: renewalForm.productDetails.trim(),
          renewalType: renewalForm.renewalType,
          source: renewalForm.source.trim(),
          renewalDate: renewalForm.renewalDate,
        });
        toast.success("Renewal updated successfully");
      } else {
        await renewalsApi.create({
          companyId: renewalForm.companyId,
          productDetails: renewalForm.productDetails.trim(),
          renewalType: renewalForm.renewalType,
          source: renewalForm.source.trim(),
          renewalDate: renewalForm.renewalDate,
          createdByUserId: user?.id,
        });
        toast.success("Renewal created successfully");
      }
      setRenewalFormOpen(false);
      resetRenewalForm();
      loadRenewals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save renewal");
      setRenewalErrors({ submit: "Save failed" });
    } finally {
      setRenewalSaving(false);
    }
  };

  const handleRenewalDelete = async (renewalId: string) => {
    setRenewalDeleting(true);
    try {
      await renewalsApi.delete(renewalId);
      toast.success("Renewal moved to bin");
      if (editingRenewalId === renewalId) {
        setRenewalFormOpen(false);
        resetRenewalForm();
      }
      loadRenewals();
      setRenewalDeleteConfirmOpen(false);
      setRenewalDeleteId(null);
    } catch {
      toast.error("Failed to delete renewal");
    } finally {
      setRenewalDeleting(false);
    }
  };

  const currentStatusSale = statusSaleId ? sales.find((s) => s.id === statusSaleId) : null;
  const openOrderWorkflowModal = (target?: OrderDto) => {
    const t = target ?? orderDetail;
    if (!t) return;
    setOrderWorkflowTarget(t);
    setWorkflowStatus(normalizeOrderStatusKey(t.status) || "__none__");
    setWorkflowNextAction(normalizeOrderStatusKey(t.nextAction) || "__none__");
    setWorkflowNextActionDate(t.nextActionDate ? t.nextActionDate.slice(0, 10) : "");
    setOrderWorkflowModalOpen(true);
  };

  const getAutoNextOrderStatus = (currentStatus: string) => {
    if (activeOrderStatusValues.length === 0) return "__none__";
    const normalizedCurrent = currentStatus === "__none__" ? "" : currentStatus;
    const currentIndex = activeOrderStatusValues.indexOf(normalizedCurrent);
    if (currentIndex < 0) return activeOrderStatusValues[0];
    if (currentIndex >= activeOrderStatusValues.length - 1) return activeOrderStatusValues[currentIndex];
    return activeOrderStatusValues[currentIndex + 1];
  };

  const saveOrderWorkflowChanges = async () => {
    if (!orderWorkflowTarget) return;
    const nextActionValue = workflowNextAction === "__none__" ? "" : workflowNextAction;
    if (nextActionValue && !workflowNextActionDate) {
      toast.error("Set a due date for next to do before saving");
      return;
    }
    setOrderModalSaving(true);
    try {
      const updated = await ordersApi.patch(orderWorkflowTarget.id, {
        status: workflowStatus === "__none__" ? "" : workflowStatus,
        nextAction: nextActionValue,
        nextActionDate: workflowNextActionDate || null,
      });
      setOrderDetail((prev) => (prev && prev.id === updated.id ? updated : prev));
      setOrders((prevOrders) => prevOrders.map((x) => (x.id === updated.id ? updated : x)));
      setOrderWorkflowModalOpen(false);
      setOrderWorkflowTarget(null);
      toast.success("Order updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update workflow");
    } finally {
      setOrderModalSaving(false);
    }
  };

  const saveOrderDetailChanges = async () => {
    if (!orderDetail) return;
    const nextActionValue = orderDetailDraft.nextAction === "__none__" ? "" : orderDetailDraft.nextAction;
    if (nextActionValue && !orderDetailDraft.nextActionDate) {
      toast.error("Set a due date for next to do before saving");
      return;
    }
    setOrderModalSaving(true);
    try {
      const updated = await ordersApi.patch(orderDetail.id, {
        forwardedTo: orderDetailDraft.forwardedTo === "__none__" ? null : orderDetailDraft.forwardedTo,
        status: orderDetailDraft.status === "__none__" ? "" : orderDetailDraft.status,
        nextAction: nextActionValue,
        nextActionDate: orderDetailDraft.nextActionDate || null,
      });
      setOrders((prevOrders) => prevOrders.map((x) => (x.id === updated.id ? updated : x)));
      toast.success("Order updated");
      setOrderDetail(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order");
    } finally {
      setOrderModalSaving(false);
    }
  };

  return (
    <Layout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="inline-flex h-auto w-fit justify-start gap-1 rounded-xl border border-border/60 bg-muted/40 p-1.5 shadow-sm">
          <TabsTrigger value="funnel" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Funnel
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Orders
          </TabsTrigger>
          <TabsTrigger value="renewal" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Renewal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search prospect..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Statuses</SelectItem>
                {salesStatuses.map((s) => <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Categories</SelectItem>
                {salesCategories.map((c) => <SelectItem key={c} value={c}>{formatStatusLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover open={filterCompanyOpen} onOpenChange={setFilterCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={filterCompanyOpen}
                  className="w-44 shrink-0 justify-between font-normal"
                >
                  <span className="truncate">
                    {filterCompany === "all" ? "Companies" : companies.find((c) => c.id === filterCompany)?.name ?? "Company"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 min-w-[18rem] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search company…" />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_companies__"
                        onSelect={() => {
                          setFilterCompany("all");
                          setFilterCompanyOpen(false);
                        }}
                      >
                        All companies
                      </CommandItem>
                      {companies.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.location} ${c.country}`}
                          onSelect={() => {
                            setFilterCompany(c.id);
                            setFilterCompanyOpen(false);
                          }}
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">{c.name}</span>
                            {(c.location || c.country) && (
                              <span className="truncate text-xs text-muted-foreground">
                                {[c.location, c.country].filter(Boolean).join(" · ")}
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
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Currency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.symbol ? `${c.code} (${c.symbol})` : c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={filterKamOpen} onOpenChange={setFilterKamOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={filterKamOpen}
                  className="w-40 shrink-0 justify-between font-normal"
                >
                  <span className="truncate">
                    {filterKam === "all" ? "KAMs" : users.find((u) => u.id === filterKam)?.name ?? "KAM"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 min-w-[18rem] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search KAM…" />
                  <CommandList>
                    <CommandEmpty>No user found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_kams__"
                        onSelect={() => {
                          setFilterKam("all");
                          setFilterKamOpen(false);
                        }}
                      >
                        All KAMs
                      </CommandItem>
                      {users.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={`${u.name} ${u.id}`}
                          onSelect={() => {
                            setFilterKam(u.id);
                            setFilterKamOpen(false);
                          }}
                        >
                          <span className="font-medium">{u.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-56 justify-start text-left font-normal text-sm", !closeDateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {closeDateRange.from ? (closeDateRange.to ? `${format(closeDateRange.from, "PP")} – ${format(closeDateRange.to, "PP")}` : format(closeDateRange.from, "PP")) : "Close date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={closeDateRange.from ? { from: closeDateRange.from, to: closeDateRange.to } : undefined}
                  onSelect={(range) => setCloseDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  captionLayout="dropdown"
                  fromYear={2020}
                  toYear={2030}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(closeDateRange.from || closeDateRange.to) && (
              <Button variant="ghost" size="sm" onClick={() => setCloseDateRange({})}>Clear</Button>
            )}
            <div className="flex-1" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Deal</Button>
          </div>

          {loading ? (
            <Loader message="Loading deals…" size="lg" className="py-16" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={search || filterStatus !== "all" || filterCategory !== "all" || filterCompany !== "all" || filterCurrency !== "all" || filterKam !== "all" || closeDateRange.from ? "No deals match your filters" : "No deals yet"}
              description="Try adjusting your search or filter criteria."
              actionLabel={!search && filterStatus === "all" && filterCategory === "all" && filterCompany === "all" && filterCurrency === "all" && filterKam === "all" && !closeDateRange.from ? "Add Deal" : undefined}
              onAction={!search && filterStatus === "all" && filterCategory === "all" && filterCompany === "all" && filterCurrency === "all" && filterKam === "all" && !closeDateRange.from ? openCreate : undefined}
            />
          ) : (
            <div className="data-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company ({filtered.length})</TableHead>
                    <TableHead>Prospect</TableHead>
                    <TableHead>
                      Revenue{filteredTotalRevenue ? ` (Total: ${filteredTotalRevenue.label})` : ""}
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Closing Date</TableHead>
                    <TableHead className="hidden md:table-cell">Closing In</TableHead>
                    <TableHead className="hidden lg:table-cell">KAM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const company = companies.find((c) => c.id === s.companyId);
                    const closeDate = new Date(s.expectedClosingDate);
                    const now = new Date();
                    const diffDays = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isClosed = s.status === "closed" || s.status === "disqualified";
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/sales/${s.id}`)}>
                        <TableCell className="font-medium">{getCompanyName(s.companyId)}</TableCell>
                        <TableCell>{s.prospect}</TableCell>
                        <TableCell>{formatRevenueWithCurrency(s.companyId, s.expectedRevenue)}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColors[s.status] || "bg-muted text-muted-foreground"}>{formatStatusLabel(s.status)}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline" className={categoryColors[s.category] || "bg-muted text-muted-foreground"}>{formatStatusLabel(s.category)}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">{formatTableDate(s.expectedClosingDate)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {isClosed ? <span className="text-muted-foreground">—</span> : diffDays < 0 ? <span className="text-destructive font-medium">{Math.abs(diffDays)}d</span> : diffDays === 0 ? <span className="text-warning font-medium">Today</span> : <span>{diffDays}d</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{company ? getUserName(company.kamUserId) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="animate-in fade-in duration-200 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover open={orderFilterCompanyOpen} onOpenChange={setOrderFilterCompanyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={orderFilterCompanyOpen} className="w-52 justify-between font-normal">
                  <span className="truncate">{orderFilterCompany === "all" ? "All companies" : getCompanyName(orderFilterCompany)}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search company..." />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all companies"
                        onSelect={() => {
                          setOrderFilterCompany("all");
                          setOrderFilterCompanyOpen(false);
                        }}
                      >
                        All companies
                      </CommandItem>
                      {companies.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setOrderFilterCompany(c.id);
                            setOrderFilterCompanyOpen(false);
                          }}
                        >
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {salesScopeAdmin ? (
              <>
                <Popover open={orderFilterAssignOpen} onOpenChange={setOrderFilterAssignOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={orderFilterAssignOpen} className="w-48 justify-between font-normal">
                      <span className="truncate">{orderFilterAssignTo === "all" ? "All assignees" : getUserName(orderFilterAssignTo)}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search assignee..." />
                      <CommandList>
                        <CommandEmpty>No assignee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all assignees"
                            onSelect={() => {
                              setOrderFilterAssignTo("all");
                              setOrderFilterAssignOpen(false);
                            }}
                          >
                            All assignees
                          </CommandItem>
                          {users.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={u.name}
                              onSelect={() => {
                                setOrderFilterAssignTo(u.id);
                                setOrderFilterAssignOpen(false);
                              }}
                            >
                              {u.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Select value={orderFilterStatus} onValueChange={setOrderFilterStatus}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {orderStatuses
                      .filter((o) => o.isActive)
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {formatStatusLabel(o.value)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={orderFilterNextAction} onValueChange={setOrderFilterNextAction}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Next to do" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All next to-do</SelectItem>
                    <SelectItem value="__none__">None</SelectItem>
                    {orderNextTodos
                      .filter((o) => o.isActive)
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {formatStatusLabel(o.value)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-64 justify-start text-left font-normal text-sm overflow-hidden",
                        !orderDeliveryDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <Truck className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">
                        {orderDeliveryDateRange.from
                          ? orderDeliveryDateRange.to
                            ? `${format(orderDeliveryDateRange.from, "MMM d, yyyy")} – ${format(orderDeliveryDateRange.to, "MMM d, yyyy")}`
                            : format(orderDeliveryDateRange.from, "MMM d, yyyy")
                          : "Delivery date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={
                        orderDeliveryDateRange.from
                          ? { from: orderDeliveryDateRange.from, to: orderDeliveryDateRange.to }
                          : undefined
                      }
                      onSelect={(range) => setOrderDeliveryDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2035}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {(orderDeliveryDateRange.from || orderDeliveryDateRange.to) && (
                  <Button variant="ghost" size="sm" onClick={() => setOrderDeliveryDateRange({})}>
                    Clear delivery range
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-64 justify-start text-left font-normal text-sm overflow-hidden",
                        !orderNextActionDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">
                        {orderNextActionDateRange.from
                          ? orderNextActionDateRange.to
                            ? `${format(orderNextActionDateRange.from, "MMM d, yyyy")} – ${format(orderNextActionDateRange.to, "MMM d, yyyy")}`
                            : format(orderNextActionDateRange.from, "MMM d, yyyy")
                          : "Next to-do date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={
                        orderNextActionDateRange.from
                          ? { from: orderNextActionDateRange.from, to: orderNextActionDateRange.to }
                          : undefined
                      }
                      onSelect={(range) => setOrderNextActionDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2035}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {(orderNextActionDateRange.from || orderNextActionDateRange.to) && (
                  <Button variant="ghost" size="sm" onClick={() => setOrderNextActionDateRange({})}>
                    Clear next date
                  </Button>
                )}
              </>
            ) : (
              <>
                <Select value={orderFilterStatus} onValueChange={setOrderFilterStatus}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {orderStatuses
                      .filter((o) => o.isActive)
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {formatStatusLabel(o.value)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={orderFilterNextAction} onValueChange={setOrderFilterNextAction}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Next to do" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All next to-do</SelectItem>
                    <SelectItem value="__none__">None</SelectItem>
                    {orderNextTodos
                      .filter((o) => o.isActive)
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {formatStatusLabel(o.value)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-64 justify-start text-left font-normal text-sm overflow-hidden",
                        !orderNextActionDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">
                        {orderNextActionDateRange.from
                          ? orderNextActionDateRange.to
                            ? `${format(orderNextActionDateRange.from, "MMM d, yyyy")} – ${format(orderNextActionDateRange.to, "MMM d, yyyy")}`
                            : format(orderNextActionDateRange.from, "MMM d, yyyy")
                          : "Next to-do date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={
                        orderNextActionDateRange.from
                          ? { from: orderNextActionDateRange.from, to: orderNextActionDateRange.to }
                          : undefined
                      }
                      onSelect={(range) => setOrderNextActionDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2035}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {(orderNextActionDateRange.from || orderNextActionDateRange.to) && (
                  <Button variant="ghost" size="sm" onClick={() => setOrderNextActionDateRange({})}>
                    Clear next date
                  </Button>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-64 justify-start text-left font-normal text-sm overflow-hidden",
                        !orderDeliveryDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <Truck className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">
                        {orderDeliveryDateRange.from
                          ? orderDeliveryDateRange.to
                            ? `${format(orderDeliveryDateRange.from, "MMM d, yyyy")} – ${format(orderDeliveryDateRange.to, "MMM d, yyyy")}`
                            : format(orderDeliveryDateRange.from, "MMM d, yyyy")
                          : "Delivery date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={
                        orderDeliveryDateRange.from
                          ? { from: orderDeliveryDateRange.from, to: orderDeliveryDateRange.to }
                          : undefined
                      }
                      onSelect={(range) => setOrderDeliveryDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2035}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {(orderDeliveryDateRange.from || orderDeliveryDateRange.to) && (
                  <Button variant="ghost" size="sm" onClick={() => setOrderDeliveryDateRange({})}>
                    Clear delivery range
                  </Button>
                )}
              </>
            )}
            {orderHasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOrderFilterCompany("all");
                  setOrderFilterNextAction("all");
                  setOrderDeliveryDateRange({});
                  setOrderFilterAssignTo("all");
                  setOrderFilterStatus("all");
                  setOrderNextActionDateRange({});
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {ordersLoading ? (
            <Loader message="Loading orders…" size="lg" className="py-16" />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={orderHasActiveFilters ? "No orders match your filters" : "No orders yet"}
              description={
                orderHasActiveFilters
                  ? "Try widening or clearing filters."
                  : "Close a deal with Closed Won / Close Win from Sales Details to create an order."
              }
            />
          ) : (
            <div className="data-table overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] whitespace-nowrap">Customers ({orders.length})</TableHead>
                    <TableHead className="min-w-[200px]">Order Details</TableHead>
                    <TableHead className="whitespace-nowrap">Order Date</TableHead>
                    <TableHead className="whitespace-nowrap">Delivery Date</TableHead>
                    <TableHead className="whitespace-nowrap">Assign To</TableHead>
                    <TableHead className="whitespace-nowrap">Assign By</TableHead>
                    <TableHead className="whitespace-nowrap">Forwarded To</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">Next To Do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setOrderDetail(o)}
                    >
                      <TableCell className="font-medium">{getCompanyName(o.companyId)}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={o.orderDetails}>
                        {o.orderDetails}
                      </TableCell>
                      <TableCell>{formatTableDate(o.orderConfirmationDate)}</TableCell>
                      <TableCell>{formatTableDate(o.deliveryDate)}</TableCell>
                      <TableCell>{getUserName(o.assignTo)}</TableCell>
                      <TableCell>{o.createdByUserId ? getUserName(o.createdByUserId) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {o.forwardedTo?.trim() ? getUserName(o.forwardedTo) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderWorkflowModal(o);
                        }}
                      >
                        {o.status?.trim() ? (
                          <Badge variant="outline">{formatStatusLabel(normalizeOrderStatusKey(o.status))}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderWorkflowModal(o);
                        }}
                      >
                        {o.nextAction?.trim() || o.nextActionDate ? (
                          <div className="flex flex-col gap-0.5">
                            {o.nextAction?.trim() ? (
                              <span className="text-sm">{formatStatusLabel(normalizeOrderStatusKey(o.nextAction))}</span>
                            ) : null}
                            {o.nextActionDate ? (
                              <span className="text-xs text-muted-foreground">{formatTableDate(o.nextActionDate)}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="renewal" className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product or source..."
                className="pl-9"
                value={renewalSearch}
                onChange={(e) => setRenewalSearch(e.target.value)}
              />
            </div>
            <Popover open={renewalFilterCompanyOpen} onOpenChange={setRenewalFilterCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={renewalFilterCompanyOpen}
                  className="w-52 shrink-0 justify-between font-normal"
                >
                  <span className="truncate">
                    {renewalFilterCompany === "all"
                      ? "All companies"
                      : companies.find((c) => c.id === renewalFilterCompany)?.name ?? "Company"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 min-w-[18rem] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search company…" />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__renewal_all_companies__"
                        onSelect={() => {
                          setRenewalFilterCompany("all");
                          setRenewalFilterCompanyOpen(false);
                        }}
                      >
                        All companies
                      </CommandItem>
                      {companies.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.location} ${c.country}`}
                          onSelect={() => {
                            setRenewalFilterCompany(c.id);
                            setRenewalFilterCompanyOpen(false);
                          }}
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">{c.name}</span>
                            {(c.location || c.country) && (
                              <span className="truncate text-xs text-muted-foreground">
                                {[c.location, c.country].filter(Boolean).join(" · ")}
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
            <Select value={renewalFilterType} onValueChange={(v) => setRenewalFilterType(v as "all" | "existing" | "potential")}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="existing">Existing</SelectItem>
                <SelectItem value="potential">Potential</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={renewalKamOpen} onOpenChange={setRenewalKamOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={renewalKamOpen} className="w-44 justify-between font-normal">
                  <span className="truncate">
                    {renewalFilterKam === "all" ? "All KAMs" : getUserName(renewalFilterKam)}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search KAM..." />
                  <CommandList>
                    <CommandEmpty>No KAM found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all kams"
                        onSelect={() => {
                          setRenewalFilterKam("all");
                          setRenewalKamOpen(false);
                        }}
                      >
                        All KAMs
                      </CommandItem>
                      {users.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={u.name}
                          onSelect={() => {
                            setRenewalFilterKam(u.id);
                            setRenewalKamOpen(false);
                          }}
                        >
                          {u.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-64 justify-start text-left font-normal text-sm overflow-hidden", !renewalDateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">
                    {renewalDateRange.from
                      ? (renewalDateRange.to
                        ? `${format(renewalDateRange.from, "MMM d, yyyy")} - ${format(renewalDateRange.to, "MMM d, yyyy")}`
                        : format(renewalDateRange.from, "MMM d, yyyy"))
                      : "Renewal date range"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={renewalDateRange.from ? { from: renewalDateRange.from, to: renewalDateRange.to } : undefined}
                  onSelect={(range) => setRenewalDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  captionLayout="dropdown"
                  fromYear={2020}
                  toYear={2035}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(renewalDateRange.from || renewalDateRange.to) && (
              <Button variant="ghost" size="sm" onClick={() => setRenewalDateRange({})}>Clear date</Button>
            )}
            {(renewalSearch || renewalFilterCompany !== "all" || renewalFilterKam !== "all" || renewalDateRange.from || renewalDateRange.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRenewalSearch("");
                  setRenewalFilterCompany("all");
                  setRenewalFilterType("all");
                  setRenewalFilterKam("all");
                  setRenewalDateRange({});
                }}
              >
                Clear filters
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={openRenewalCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Renewal
            </Button>
          </div>

          {renewalLoading ? (
            <Loader message="Loading renewals…" size="lg" className="py-16" />
          ) : filteredRenewals.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title={renewalSearch || renewalFilterCompany !== "all" || renewalFilterType !== "all" || renewalFilterKam !== "all" || renewalDateRange.from ? "No renewals match your filters" : "No renewal records yet"}
              description="Create renewal records to track upcoming contract/product renewals."
              actionLabel={!renewalSearch && renewalFilterCompany === "all" && renewalFilterType === "all" && renewalFilterKam === "all" && !renewalDateRange.from ? "Add Renewal" : undefined}
              onAction={!renewalSearch && renewalFilterCompany === "all" && renewalFilterType === "all" && renewalFilterKam === "all" && !renewalDateRange.from ? openRenewalCreate : undefined}
            />
          ) : (
            <div className="data-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company ({filteredRenewals.length})</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Renewal Date</TableHead>
                    <TableHead>Remaining Days</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>KAM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRenewals.map((r) => {
                    const renewalDate = parseISO(r.renewalDate);
                    const today = startOfDay(new Date());
                    const renewalDay = startOfDay(renewalDate);
                    const expired = isBefore(renewalDay, today);
                    const days = differenceInCalendarDays(renewalDay, today);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => openRenewalEdit(r)}>
                        <TableCell className="font-medium">{getCompanyName(r.companyId)}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={r.productDetails}>{r.productDetails}</TableCell>
                        <TableCell className={expired ? "font-medium text-destructive" : ""}>
                          {formatTableDate(r.renewalDate)}
                        </TableCell>
                        <TableCell>
                          {expired ? (
                            <span className="font-medium text-destructive">Expired {Math.abs(days)}d ago</span>
                          ) : days === 0 ? (
                            <span className="font-medium text-warning">Due today</span>
                          ) : (
                            <span>{days}d left</span>
                          )}
                        </TableCell>
                        <TableCell>{r.renewalType === "potential" ? "Potential" : "Existing"}</TableCell>
                        <TableCell>{getKamNameByCompany(r.companyId)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={orderDetail !== null} onOpenChange={(open) => { if (!open) { setOrderDetail(null); } }}>
        <DialogContent
          showClose={false}
          className="flex min-h-0 max-h-[min(90dvh,calc(100vh-1.5rem))] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border border-border/80 bg-background p-0 text-foreground shadow-2xl shadow-slate-300/40 sm:w-full sm:max-w-[min(100vw-1.5rem,42rem)] md:max-w-[min(100vw-2rem,52rem)] lg:max-w-[min(100vw-2.5rem,60rem)] xl:max-w-[min(100vw-3rem,70rem)] sm:rounded-3xl"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-24 -top-28 h-[min(22rem,50vw)] w-[min(22rem,50vw)] rounded-full bg-indigo-400/15 blur-[100px]" />
            <div className="absolute -bottom-32 -left-20 h-[min(20rem,45vw)] w-[min(20rem,45vw)] rounded-full bg-violet-400/10 blur-[90px]" />
          </div>
          {orderDetail && (
            <>
              <div className="relative z-[1] shrink-0 border-b border-border bg-gradient-to-r from-slate-50 via-background to-indigo-50/40 px-4 py-4 sm:px-6">
                <DialogHeader className="space-y-0 text-left">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <DialogTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Order details</DialogTitle>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{getCompanyName(orderDetail.companyId)}</p>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text sm:text-2xl">
                        {formatRevenueWithCurrency(orderDetail.companyId, orderDetail.revenue)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-1 gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-12 lg:items-start">
                  <div className="flex flex-wrap gap-3 border-b border-border pb-4 lg:col-span-12 lg:flex-nowrap lg:justify-between lg:gap-3 lg:border-0 lg:pb-0">
                    {[
                      { icon: CalendarDays, label: "Order date", value: formatTableDate(orderDetail.orderConfirmationDate) },
                      { icon: Truck, label: "Delivery", value: formatTableDate(orderDetail.deliveryDate) },
                      { icon: User2, label: "Assign to", value: getUserName(orderDetail.assignTo) },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-2.5 shadow-sm sm:min-w-[7.5rem]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                          <p className={cn("truncate text-sm font-semibold text-foreground", item.label === "Assign to" && "max-w-[12rem] sm:max-w-none")}>
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
                    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order scope</h3>
                      <div className="max-h-[min(9rem,28dvh)] overflow-y-auto rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {orderDetail.orderDetails?.trim() ? (
                            orderDetail.orderDetails
                          ) : (
                            <span className="text-muted-foreground">No details provided.</span>
                          )}
                        </p>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</h3>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="order-detail-status" className="text-xs font-medium text-muted-foreground">
                            Status
                          </Label>
                          <Select
                            disabled={orderModalSaving}
                            value={orderDetailDraft.status}
                            onValueChange={(val) => {
                              setOrderDetailDraft((prev) => ({ ...prev, status: val }));
                            }}
                          >
                            <SelectTrigger
                              id="order-detail-status"
                              className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 [&>svg]:text-muted-foreground"
                            >
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                              <SelectItem value="__none__">No status</SelectItem>
                              {activeOrderStatusValues.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {formatStatusLabel(v)}
                                </SelectItem>
                              ))}
                              {(() => {
                                const k = orderDetailDraft.status === "__none__" ? "" : orderDetailDraft.status;
                                if (!k || activeOrderStatusValues.includes(k)) return null;
                                const knownInactive = orderStatuses.some((o) => o.value === k && !o.isActive);
                                return (
                                  <SelectItem value={k} disabled className="text-muted-foreground">
                                    {knownInactive ? `${formatStatusLabel(k)} (inactive)` : `Legacy: ${formatStatusLabel(k)}`}
                                  </SelectItem>
                                );
                              })()}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="order-detail-next-action" className="text-xs font-medium text-muted-foreground">
                            Next to do
                          </Label>
                          <Select
                            disabled={orderModalSaving}
                            value={orderDetailDraft.nextAction}
                            onValueChange={(val) => {
                              const next = val === "__none__" ? "" : val;
                              const prev = orderDetailDraft.nextAction === "__none__" ? "" : orderDetailDraft.nextAction;
                              if (next === prev) return;
                              setOrderDetailDraft((prevDraft) => {
                                if (val === "__none__") {
                                  return { ...prevDraft, nextAction: val, nextActionDate: "" };
                                }
                                const autoStatus = getAutoNextOrderStatus(prevDraft.status);
                                return {
                                  ...prevDraft,
                                  nextAction: val,
                                  nextActionDate: "",
                                  status: autoStatus,
                                };
                              });
                            }}
                          >
                            <SelectTrigger
                              id="order-detail-next-action"
                              className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60 [&>svg]:text-muted-foreground"
                            >
                              <SelectValue placeholder="Select next to do" />
                            </SelectTrigger>
                            <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                              <SelectItem value="__none__">None</SelectItem>
                              {activeOrderNextTodoValues.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {formatStatusLabel(v)}
                                </SelectItem>
                              ))}
                              {(() => {
                                const k = orderDetailDraft.nextAction === "__none__" ? "" : orderDetailDraft.nextAction;
                                if (!k || activeOrderNextTodoValues.includes(k)) return null;
                                const knownInactive = orderNextTodos.some((o) => o.value === k && !o.isActive);
                                return (
                                  <SelectItem value={k} disabled className="text-muted-foreground">
                                    {knownInactive ? `${formatStatusLabel(k)} (inactive)` : `Legacy: ${formatStatusLabel(k)}`}
                                  </SelectItem>
                                );
                              })()}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="order-detail-next-due" className="text-xs font-medium text-muted-foreground">
                            Next to do due date
                          </Label>
                          <Input
                            id="order-detail-next-due"
                            type="date"
                            disabled={orderModalSaving}
                            className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                            value={orderDetailDraft.nextActionDate}
                            onChange={(e) => {
                              const v = e.target.value;
                              const hasNext = orderDetailDraft.nextAction !== "__none__";
                              if (!v && hasNext) {
                                toast.error("Clear next to do before removing the due date");
                                return;
                              }
                              setOrderDetailDraft((prev) => ({ ...prev, nextActionDate: v }));
                            }}
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="flex w-full min-w-0 flex-col gap-4 lg:col-span-4">
                    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">People</h3>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Assign by
                          </span>
                          <span
                            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100"
                            title={
                              orderDetail.createdByUserId
                                ? getUserName(orderDetail.createdByUserId)
                                : undefined
                            }
                          >
                            <User2 className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                            {orderDetail.createdByUserId ? (
                              getUserName(orderDetail.createdByUserId)
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </span>
                        </div>
                        <div className="space-y-2 border-t border-border pt-3">
                          <Label htmlFor="order-detail-forwarded" className="text-xs font-medium text-muted-foreground">
                            Forwarded to
                          </Label>
                          <Select
                            disabled={orderModalSaving}
                            value={orderDetailDraft.forwardedTo}
                            onValueChange={(val) => {
                              setOrderDetailDraft((prev) => ({ ...prev, forwardedTo: val }));
                            }}
                          >
                            <SelectTrigger
                              id="order-detail-forwarded"
                              className="h-10 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 [&>svg]:text-muted-foreground"
                            >
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                              <SelectItem value="__none__">Not forwarded</SelectItem>
                              {users.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-dashed border-indigo-200/90 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/20">
                      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        Attachments
                      </h3>
                      {orderDetail.attachments && orderDetail.attachments.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {orderDetail.attachments.map((a, i) => (
                            <li key={`${a.fileName}-${i}`}>
                              <a
                                href={a.data}
                                download={a.fileName}
                                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                              >
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                                <span className="truncate">{a.fileName}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No files attached.</p>
                      )}
                    </section>
                  </div>

                  <div className="border-t border-border pt-3 lg:col-span-12">
                    <p className="text-center text-[10px] text-muted-foreground sm:text-left">
                      Created {formatTableDate(orderDetail.createdAt)}
                      {orderDetail.updatedAt && orderDetail.updatedAt !== orderDetail.createdAt
                        ? ` · Updated ${formatTableDate(orderDetail.updatedAt)}`
                        : null}
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="relative z-[1] shrink-0 flex w-full flex-row flex-nowrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-4 sm:justify-between sm:px-6 sm:space-x-0">
                <Button type="button" variant="outline" className="min-w-[100px] shrink-0" onClick={() => setOrderDetail(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  className="min-w-[120px] shrink-0 bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500"
                  onClick={saveOrderDetailChanges}
                  disabled={orderModalSaving}
                >
                  {orderModalSaving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderWorkflowModalOpen}
        onOpenChange={(open) => {
          setOrderWorkflowModalOpen(open);
          if (!open) setOrderWorkflowTarget(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90dvh,calc(100vh-1.5rem))] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border border-border/80 bg-background p-0 text-foreground shadow-2xl shadow-slate-300/40 sm:w-full sm:max-w-2xl sm:rounded-3xl">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-400/15 blur-[80px]" />
            <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-violet-400/10 blur-[70px]" />
          </div>
          <div className="relative z-[1] shrink-0 border-b border-border bg-gradient-to-r from-slate-50 via-background to-indigo-50/40 px-5 py-4">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">Change status & next to do</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">Set status, next step, and due date for this order.</p>
            </DialogHeader>
          </div>
          <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="workflow-quick-status" className="text-xs font-medium text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    disabled={orderModalSaving}
                    value={workflowStatus}
                    onValueChange={setWorkflowStatus}
                  >
                    <SelectTrigger
                      id="workflow-quick-status"
                      className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 [&>svg]:text-muted-foreground"
                    >
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                      <SelectItem value="__none__">No status</SelectItem>
                      {activeOrderStatusValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {formatStatusLabel(v)}
                        </SelectItem>
                      ))}
                      {(() => {
                        const k = workflowStatus === "__none__" ? "" : workflowStatus;
                        if (!k || activeOrderStatusValues.includes(k)) return null;
                        const knownInactive = orderStatuses.some((o) => o.value === k && !o.isActive);
                        return (
                          <SelectItem value={k} disabled className="text-muted-foreground">
                            {knownInactive ? `${formatStatusLabel(k)} (inactive)` : `Legacy: ${formatStatusLabel(k)}`}
                          </SelectItem>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="workflow-quick-next-action" className="text-xs font-medium text-muted-foreground">
                    Next to do
                  </Label>
                  <Select
                    disabled={orderModalSaving}
                    value={workflowNextAction}
                    onValueChange={(val) => {
                      const prev = workflowNextAction === "__none__" ? "" : workflowNextAction;
                      const next = val === "__none__" ? "" : val;
                      if (next === prev) return;
                      if (val !== "__none__") {
                        setWorkflowStatus(getAutoNextOrderStatus(workflowStatus));
                      }
                      setWorkflowNextAction(val);
                      setWorkflowNextActionDate("");
                    }}
                  >
                    <SelectTrigger
                      id="workflow-quick-next-action"
                      className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60 [&>svg]:text-muted-foreground"
                    >
                      <SelectValue placeholder="Select next to do" />
                    </SelectTrigger>
                    <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                      <SelectItem value="__none__">None</SelectItem>
                      {activeOrderNextTodoValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {formatStatusLabel(v)}
                        </SelectItem>
                      ))}
                      {(() => {
                        const k = workflowNextAction === "__none__" ? "" : workflowNextAction;
                        if (!k || activeOrderNextTodoValues.includes(k)) return null;
                        const knownInactive = orderNextTodos.some((o) => o.value === k && !o.isActive);
                        return (
                          <SelectItem value={k} disabled className="text-muted-foreground">
                            {knownInactive ? `${formatStatusLabel(k)} (inactive)` : `Legacy: ${formatStatusLabel(k)}`}
                          </SelectItem>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="workflow-quick-next-due" className="text-xs font-medium text-muted-foreground">
                    Next to do due date
                  </Label>
                  <Input
                    id="workflow-quick-next-due"
                    type="date"
                    disabled={orderModalSaving}
                    className="h-10 w-full min-w-0 rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                    value={workflowNextActionDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v && workflowNextAction !== "__none__") {
                        toast.error("Clear next to do before removing the due date");
                        return;
                      }
                      setWorkflowNextActionDate(v);
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
          <DialogFooter className="relative z-[1] shrink-0 flex w-full flex-row flex-nowrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-5 py-4 sm:justify-between sm:px-6 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="min-w-[100px] shrink-0"
              onClick={() => {
                setOrderWorkflowModalOpen(false);
                setOrderWorkflowTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[120px] shrink-0 bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500"
              onClick={saveOrderWorkflowChanges}
              disabled={orderModalSaving}
            >
              {orderModalSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1">
              <Label>Prospect *</Label>
              <Input value={form.prospect} onChange={(e) => setForm({ ...form, prospect: e.target.value })} placeholder="Deal name / prospect" />
              {errors.prospect && <p className="text-sm text-destructive">{errors.prospect}</p>}
            </div>
            <div className="space-y-1">
              <Label>Company *</Label>
              <Popover
                open={companyOpen}
                onOpenChange={(o) => {
                  setCompanyOpen(o);
                  if (!o) setCompanySearchValue("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={companyOpen} className="w-full justify-between font-normal">
                    {form.companyId ? (() => {
                      const c = companies.find((x) => x.id === form.companyId);
                      return c ? (c.location || c.country ? `${c.name} · ${[c.location, c.country].filter(Boolean).join(", ")}` : c.name) : "Select company";
                    })() : "Select company"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by company name, location or country..."
                      value={companySearchValue}
                      onValueChange={setCompanySearchValue}
                    />
                    <CommandList>
                      {companies.filter((comp) => {
                        const q = companySearchValue.toLowerCase();
                        return (
                          !companySearchValue ||
                          comp.name.toLowerCase().includes(q) ||
                          comp.location?.toLowerCase().includes(q) ||
                          comp.country?.toLowerCase().includes(q)
                        );
                      }).length === 0 &&
                        companySearchValue.trim() && <CommandEmpty>No company found.</CommandEmpty>}
                      <CommandGroup>
                        {companies
                          .filter((comp) => {
                            const q = companySearchValue.toLowerCase();
                            return (
                              !companySearchValue ||
                              comp.name.toLowerCase().includes(q) ||
                              comp.location?.toLowerCase().includes(q) ||
                              comp.country?.toLowerCase().includes(q)
                            );
                          })
                          .map((comp) => (
                            <CommandItem
                              key={comp.id}
                              value={`${comp.name} ${comp.location} ${comp.country}`}
                              onSelect={() => {
                                setForm((prev) => ({ ...prev, companyId: comp.id }));
                                setCompanyOpen(false);
                                setCompanySearchValue("");
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{comp.name}</span>
                                {(comp.location || comp.country) && (
                                  <span className="text-xs text-muted-foreground">
                                    {[comp.location, comp.country].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      <CommandGroup>
                        <CommandItem
                          value="add new company deal form"
                          onSelect={() => {
                            setAddCompanyTarget("deal");
                            setCompanyOpen(false);
                            setNewCompanyForm((prev) => ({ ...prev, name: companySearchValue.trim() }));
                            setAddCompanyOpen(true);
                            setCompanySearchValue("");
                          }}
                          className="text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add new company…
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.companyId && <p className="text-sm text-destructive">{errors.companyId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{salesCategories.map((c) => <SelectItem key={c} value={c}>{formatStatusLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
              </div>
              {!editingId && (
                <div className="space-y-1">
                  <Label>Initial Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{salesStatuses.map((s) => <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Expected Revenue {expectedRevenueCurrencyLabel ? `(${expectedRevenueCurrencyLabel})` : ""} *
                </Label>
                <Input type="number" min={0} step={0.01} value={form.expectedRevenue} onChange={(e) => setForm({ ...form, expectedRevenue: e.target.value })} placeholder="0.00" />
                {errors.expectedRevenue && <p className="text-sm text-destructive">{errors.expectedRevenue}</p>}
              </div>
              <div className="space-y-1">
                <Label>Expected Closing Date *</Label>
                <Input type="date" value={form.expectedClosingDate} onChange={(e) => setForm({ ...form, expectedClosingDate: e.target.value })} />
                {errors.expectedClosingDate && <p className="text-sm text-destructive">{errors.expectedClosingDate}</p>}
              </div>
            </div>
            {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            <div className="flex gap-2">
              {editingId && (
                <Button variant="destructive" onClick={() => handleDelete(editingId)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Saving…" : editingId ? "Update Deal" : "Create Deal"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addCompanyOpen}
        onOpenChange={(v) => {
          setAddCompanyOpen(v);
          if (!v) {
            setNewCompanyForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
            setAddCompanyErrors({});
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input
                value={newCompanyForm.name}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                placeholder="Enter company name"
              />
              {addCompanyErrors.name && <p className="text-sm text-destructive">{addCompanyErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Location *</Label>
              <Input
                value={newCompanyForm.location}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, location: e.target.value })}
                placeholder="City, State"
              />
              {addCompanyErrors.location && <p className="text-sm text-destructive">{addCompanyErrors.location}</p>}
            </div>
            <div className="space-y-1">
              <Label>Country *</Label>
              <Popover open={addCompanyCountryOpen} onOpenChange={setAddCompanyCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={addCompanyCountryOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newCompanyForm.country || "Select country"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search country..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRIES.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setNewCompanyForm({ ...newCompanyForm, country: c });
                              setAddCompanyCountryOpen(false);
                            }}
                          >
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {addCompanyErrors.country && <p className="text-sm text-destructive">{addCompanyErrors.country}</p>}
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <Select
                value={newCompanyForm.currencyId || ""}
                onValueChange={(v) => setNewCompanyForm({ ...newCompanyForm, currencyId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((cur) => (
                    <SelectItem key={cur.id} value={cur.id}>
                      {cur.code} — {cur.name}
                      {cur.symbol ? ` (${cur.symbol})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addCompanyErrors.currencyId && <p className="text-sm text-destructive">{addCompanyErrors.currencyId}</p>}
            </div>
            <div className="space-y-1">
              <Label>Key Account Manager (KAM) *</Label>
              <Popover open={addCompanyKamOpen} onOpenChange={setAddCompanyKamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={addCompanyKamOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newCompanyForm.kamUserId
                      ? (users.find((x) => x.id === newCompanyForm.kamUserId)?.name ?? "Select KAM")
                      : "Select KAM"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search by name, email or mobile..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.name} ${u.email} ${u.phone}`}
                            onSelect={() => {
                              setNewCompanyForm((prev) => ({ ...prev, kamUserId: u.id }));
                              setAddCompanyKamOpen(false);
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
              {addCompanyErrors.kamUserId && <p className="text-sm text-destructive">{addCompanyErrors.kamUserId}</p>}
            </div>
            {addCompanyErrors.submit && <p className="text-sm text-destructive">{addCompanyErrors.submit}</p>}
            <Button onClick={handleAddCompanySave} disabled={addCompanySaving} className="w-full">
              {addCompanySaving ? "Saving…" : "Add company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renewalFormOpen} onOpenChange={(v) => { setRenewalFormOpen(v); if (!v) resetRenewalForm(); }}>
        <DialogContent className="flex max-h-[min(90dvh,calc(100vh-1.5rem))] max-w-2xl flex-col gap-0 overflow-hidden border border-border/80 bg-background p-0 text-foreground shadow-lg shadow-slate-200/50 sm:rounded-xl">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-400/15 blur-[80px]" />
            <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-violet-400/10 blur-[70px]" />
          </div>
          <div className="relative z-[1] shrink-0 border-b border-border bg-gradient-to-r from-slate-50 via-background to-indigo-50/40 px-5 py-4 sm:px-6">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                    {editingRenewalId ? "Edit renewal" : "New renewal"}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">Manage product renewal details; KAM follows the selected company.</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="relative z-[1] min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</h3>
              <div className="space-y-2">
                <Label htmlFor="renewal-company-trigger" className="text-xs font-medium text-muted-foreground">Company *</Label>
              <Popover
                open={renewalCompanyOpen}
                onOpenChange={(o) => {
                  setRenewalCompanyOpen(o);
                  if (!o) setRenewalCompanySearchValue("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="renewal-company-trigger"
                    variant="outline"
                    role="combobox"
                    aria-expanded={renewalCompanyOpen}
                    className="h-10 w-full justify-between rounded-md border border-input bg-background font-normal text-foreground shadow-sm hover:bg-background hover:text-foreground focus:ring-2 focus:ring-indigo-500/25"
                  >
                    {renewalForm.companyId ? (() => {
                      const c = companies.find((x) => x.id === renewalForm.companyId);
                      return c ? (c.location || c.country ? `${c.name} · ${[c.location, c.country].filter(Boolean).join(", ")}` : c.name) : "Select company";
                    })() : "Select company"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by company name, location or country..."
                      value={renewalCompanySearchValue}
                      onValueChange={setRenewalCompanySearchValue}
                    />
                    <CommandList>
                      {companies.filter((comp) => {
                        const q = renewalCompanySearchValue.toLowerCase();
                        return (
                          !renewalCompanySearchValue ||
                          comp.name.toLowerCase().includes(q) ||
                          comp.location?.toLowerCase().includes(q) ||
                          comp.country?.toLowerCase().includes(q)
                        );
                      }).length === 0 &&
                        renewalCompanySearchValue.trim() && <CommandEmpty>No company found.</CommandEmpty>}
                      <CommandGroup>
                        {companies
                          .filter((comp) => {
                            const q = renewalCompanySearchValue.toLowerCase();
                            return (
                              !renewalCompanySearchValue ||
                              comp.name.toLowerCase().includes(q) ||
                              comp.location?.toLowerCase().includes(q) ||
                              comp.country?.toLowerCase().includes(q)
                            );
                          })
                          .map((comp) => (
                            <CommandItem
                              key={comp.id}
                              value={`${comp.name} ${comp.location} ${comp.country}`}
                              onSelect={() => {
                                setRenewalForm((prev) => ({ ...prev, companyId: comp.id }));
                                setRenewalCompanyOpen(false);
                                setRenewalCompanySearchValue("");
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{comp.name}</span>
                                {(comp.location || comp.country) && (
                                  <span className="text-xs text-muted-foreground">
                                    {[comp.location, comp.country].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      <CommandGroup>
                        <CommandItem
                          value="add new company renewal form"
                          onSelect={() => {
                            setAddCompanyTarget("renewal");
                            setRenewalCompanyOpen(false);
                            setNewCompanyForm((prev) => ({ ...prev, name: renewalCompanySearchValue.trim() }));
                            setAddCompanyOpen(true);
                            setRenewalCompanySearchValue("");
                          }}
                          className="text-primary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add new company…
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {renewalErrors.companyId && <p className="text-sm text-destructive">{renewalErrors.companyId}</p>}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Renewal details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="renewal-product-details" className="text-xs font-medium text-muted-foreground">Product details *</Label>
                  <Input
                    id="renewal-product-details"
                    className="h-10 rounded-md border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                    value={renewalForm.productDetails}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, productDetails: e.target.value }))}
                    placeholder="Product / package / contract details"
                  />
                  {renewalErrors.productDetails && <p className="text-sm text-destructive">{renewalErrors.productDetails}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewal-date-input" className="text-xs font-medium text-muted-foreground">Renewal date *</Label>
                  <Input
                    id="renewal-date-input"
                    className="h-10 rounded-md border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                    type="date"
                    value={renewalForm.renewalDate}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, renewalDate: e.target.value }))}
                  />
                  {renewalErrors.renewalDate && <p className="text-sm text-destructive">{renewalErrors.renewalDate}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="renewal-kam-display" className="text-xs font-medium text-muted-foreground">KAM</Label>
                  <Input
                    id="renewal-kam-display"
                    className="h-10 rounded-md border border-border/80 bg-muted/40 text-sm text-muted-foreground"
                    value={renewalForm.companyId ? getKamNameByCompany(renewalForm.companyId) : ""}
                    placeholder="Auto-filled from selected company"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewal-source-input" className="text-xs font-medium text-muted-foreground">Source</Label>
                  <Input
                    id="renewal-source-input"
                    className="h-10 rounded-md border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                    value={renewalForm.source}
                    onChange={(e) => setRenewalForm((prev) => ({ ...prev, source: e.target.value }))}
                    placeholder="Optional (e.g. Direct, Partner, Referral)"
                  />
                  {renewalErrors.source && <p className="text-sm text-destructive">{renewalErrors.source}</p>}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type *</h3>
              <RadioGroup
                value={renewalForm.renewalType}
                onValueChange={(v) => setRenewalForm((prev) => ({ ...prev, renewalType: v as "existing" | "potential" }))}
                className="flex flex-wrap items-center gap-6 rounded-md border border-border/60 bg-muted/30 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="renewal-type-existing" value="existing" />
                  <Label htmlFor="renewal-type-existing" className="cursor-pointer text-sm font-normal text-foreground">Existing</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="renewal-type-potential" value="potential" />
                  <Label htmlFor="renewal-type-potential" className="cursor-pointer text-sm font-normal text-foreground">Potential</Label>
                </div>
              </RadioGroup>
            </section>

            {renewalErrors.submit && <p className="text-sm text-destructive">{renewalErrors.submit}</p>}
          </div>

          <div className="relative z-[1] shrink-0 border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editingRenewalId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="shadow-sm"
                  onClick={() => {
                    setRenewalDeleteId(editingRenewalId);
                    setRenewalDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <div className="flex-1" aria-hidden />
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleRenewalSave}
                disabled={renewalSaving}
                className="rounded-md bg-indigo-600 px-5 font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 sm:ml-auto"
              >
                {renewalSaving ? "Saving…" : editingRenewalId ? "Update renewal" : "Create renewal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={renewalDeleteConfirmOpen} onOpenChange={setRenewalDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete renewal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this renewal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renewalDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!renewalDeleteId || renewalDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (!renewalDeleteId) return;
                void handleRenewalDelete(renewalDeleteId);
              }}
            >
              {renewalDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Sales Status</DialogTitle></DialogHeader>
          {currentStatusSale && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deal</p>
                <p className="font-medium">{currentStatusSale.prospect}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                <Badge variant="outline" className={cn("text-sm", statusColors[currentStatusSale.status] || "bg-muted text-muted-foreground")}>{formatStatusLabel(currentStatusSale.status)}</Badge>
              </div>
              <div className="space-y-1">
                <Label>New Status *</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {salesStatuses.filter((s) => s !== currentStatusSale.status).map((s) => <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Note * <span className="text-xs text-muted-foreground">(required for status changes)</span></Label>
                <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Explain why this status is changing..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={!statusNote.trim() || currentStatusSale?.status === newStatus || statusSaving}>{statusSaving ? "Saving…" : "Confirm Change"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
