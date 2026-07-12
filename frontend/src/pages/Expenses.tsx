import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "@/components/ui/loader";
import { Plus, Receipt, ChevronsUpDown, Search, ArrowRight, ArrowLeftRight, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { expensesApi, expensePurposesApi, companiesApi, usersApi, currenciesApi } from "@/lib/api";
import type { ExpenseDto, CurrencyDto } from "@/lib/api";
import { COUNTRIES } from "@/data/mockData";
import { formatTableDate, cn } from "@/lib/utils";
import { z } from "zod";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const expenseSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Amount must be >= 0"),
  amountReturn: z.string(),
  fromLocation: z.string().trim().min(1, "From is required").max(200, "Max 200 characters"),
  toLocation: z.string().trim().min(1, "To is required").max(200, "Max 200 characters"),
  purposeId: z.string().min(1, "Purpose is required"),
  purpose: z.string().max(500).optional(),
  tripType: z.enum(["single_trip", "round_trip"]),
});

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Name must be under 100 characters"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be under 200 characters"),
  country: z.string().trim().min(1, "Country is required"),
  currencyId: z.string().min(1, "Currency is required"),
  kamUserId: z.string().min(1, "Key Account Manager is required"),
});

const emptyForm = { companyId: "", date: "", amount: "", amountReturn: "", fromLocation: "", toLocation: "", purposeId: "", purpose: "", tripType: "single_trip" as "single_trip" | "round_trip" };

function displayAmount(exp: ExpenseDto): number {
  // For round trips, show total (for backward compatibility with old expenses that have amountReturn)
  if (exp.tripType === "round_trip" && exp.amountReturn != null) {
    return exp.amount + exp.amountReturn;
  }
  // For new round trips and single trips, just use amount
  return exp.amount;
}

function displayRoute(exp: ExpenseDto): { from: string; to: string; isRoundTrip: boolean } {
  const from = (exp.fromLocation ?? "").trim();
  const to = (exp.toLocation ?? "").trim();
  return {
    from: from || "—",
    to: to || "—",
    isRoundTrip: exp.tripType === "round_trip"
  };
}

type ExpensePeriodPreset = "all" | "today" | "week" | "month" | "year";

/** Calendar range wins when set; otherwise the period dropdown applies. */
function boundsForExpensePeriod(
  preset: ExpensePeriodPreset,
  custom: { from?: Date; to?: Date },
): { start: Date; end: Date } | null {
  if (custom.from) {
    return {
      start: startOfDay(custom.from),
      end: endOfDay(custom.to ?? custom.from),
    };
  }
  const now = new Date();
  switch (preset) {
    case "all":
      return null;
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return null;
  }
}

function expenseMatchesDateBounds(
  exp: ExpenseDto,
  bounds: { start: Date; end: Date } | null,
): boolean {
  if (!bounds) return true;
  if (!exp.date) return false;
  try {
    const d = startOfDay(parseISO(exp.date.slice(0, 10)));
    return isWithinInterval(d, { start: bounds.start, end: bounds.end });
  } catch {
    return false;
  }
}

export default function Expenses() {
  const { user } = useAuth();
  const { isPageScopeAdmin } = useRbac();
  /** RBAC: Expenses column "admin" = all expenses + status; "user" = own expenses only, no status changes. */
  const expensesScopeAdmin = isPageScopeAdmin("expenses");
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [purposes, setPurposes] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState("");
  const [userFilterOpen, setUserFilterOpen] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [statusConfirmExp, setStatusConfirmExp] = useState<ExpenseDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<"paid" | "unpaid" | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
  const [addCompanySaving, setAddCompanySaving] = useState(false);
  const [addCompanyErrors, setAddCompanyErrors] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [addCompanyCountryOpen, setAddCompanyCountryOpen] = useState(false);
  const [addCompanyKamOpen, setAddCompanyKamOpen] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<ExpensePeriodPreset>("all");
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [dateRangePopoverOpen, setDateRangePopoverOpen] = useState(false);

  const fetchExpenses = () => {
    setLoading(true);
    expensesApi
      .list()
      .then(setExpenses)
      .catch(() => toast.error("Failed to load expenses"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchCompanies = () =>
    companiesApi.list().then((list) => setCompanies(list.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});

  useEffect(() => {
    fetchCompanies();
    expensePurposesApi.list().then((list) => setPurposes(list.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive !== false })))).catch(() => {});
    usersApi.list().then((list) => setUsers(list.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" })))).catch(() => {});
  }, []);

  useEffect(() => {
    if (addCompanyOpen) {
      currenciesApi.list().then(setCurrencies).catch(() => {});
    }
  }, [addCompanyOpen]);

  useEffect(() => {
    if (!expensesScopeAdmin) setFilterUser("all");
  }, [expensesScopeAdmin]);

  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—";
  const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? "—";

  const expenseDateBounds = useMemo(
    () => boundsForExpensePeriod(periodPreset, customDateRange),
    [periodPreset, customDateRange],
  );

  const filtered = expenses.filter((e) => {
    if (!expenseMatchesDateBounds(e, expenseDateBounds)) return false;
    if (filterUser !== "all" && e.createdByUserId !== filterUser) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const companyName = getCompanyName(e.companyId).toLowerCase();
      const purposeName = (e.purposeName || "").toLowerCase();
      const purpose = (e.purpose || "").toLowerCase();
      const status = e.status.toLowerCase();
      const createdByName = getUserName(e.createdByUserId).toLowerCase();
      // Format date for search (YYYY-MM-DD format)
      const dateStr = e.date ? e.date.slice(0, 10) : "";
      // Also check formatted date (e.g., "2025-01-15" or "01/15/2025")
      const dateFormatted = dateStr ? dateStr.replace(/-/g, "/") : "";
      const dateParts = dateStr ? dateStr.split("-") : [];
      const dateReversed = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : "";
      
      if (
        !companyName.includes(searchLower) &&
        !purposeName.includes(searchLower) &&
        !purpose.includes(searchLower) &&
        !status.includes(searchLower) &&
        !createdByName.includes(searchLower) &&
        !dateStr.includes(searchLower) &&
        !dateFormatted.includes(searchLower) &&
        !dateReversed.includes(searchLower) &&
        !dateParts.some(part => part.includes(searchLower))
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPaid = filtered.filter((e) => e.status === "paid").reduce((sum, e) => sum + displayAmount(e), 0);
  const totalUnpaid = filtered.filter((e) => e.status === "unpaid").reduce((sum, e) => sum + displayAmount(e), 0);

  const resetForm = () => {
    setForm({ ...emptyForm, amountReturn: "", fromLocation: "", toLocation: "", purposeId: "" });
    setErrors({});
    setEditingId(null);
  };

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
      await fetchCompanies();
      setForm((prev) => ({ ...prev, companyId: created.id }));
      setAddCompanyOpen(false);
      setNewCompanyForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
      setAddCompanyErrors({});
      toast.success("Company added. You can now continue with the expense.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add company");
      setAddCompanyErrors({ submit: err instanceof Error ? err.message : "Failed to add company" });
    } finally {
      setAddCompanySaving(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setForm((f) => ({ ...f, date: new Date().toISOString().slice(0, 10) }));
    setOpen(true);
  };

  const openEdit = (exp: ExpenseDto) => {
    // Regular users cannot edit paid expenses
    if (!expensesScopeAdmin && exp.status === "paid") {
      toast.error("Paid expenses cannot be edited");
      return;
    }
    setForm({
      companyId: exp.companyId,
      date: exp.date?.slice(0, 10) ?? "",
      amount: String(displayAmount(exp)),
      amountReturn: "",
      fromLocation: exp.fromLocation ?? "",
      toLocation: exp.toLocation ?? "",
      purposeId: exp.purposeId ?? "",
      purpose: exp.purpose ?? "",
      tripType: (exp.tripType === "round_trip" ? "round_trip" : "single_trip") as "single_trip" | "round_trip",
    });
    setEditingId(exp.id);
    setErrors({});
    setOpen(true);
  };

  const canEditExpense = (exp: ExpenseDto) => {
    return expensesScopeAdmin || exp.status === "unpaid";
  };

  const handleSave = async () => {
    const result = expenseSchema.safeParse({
      ...form,
      amount: form.amount,
      amountReturn: "",
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      purposeId: form.purposeId,
      purpose: form.purpose || undefined,
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
      const payload: {
        companyId: string;
        date: string;
        amount: number;
        amountReturn?: number | null;
        fromLocation?: string;
        toLocation?: string;
        purposeId: string;
        purpose?: string;
        tripType: "single_trip" | "round_trip";
      } = {
        companyId: result.data.companyId,
        date: result.data.date,
        amount: parseFloat(result.data.amount),
        tripType: result.data.tripType,
        purposeId: (result.data.purposeId ?? "").trim(),
      };
      // For round trips, amountReturn is set to null (using single amount input)
      payload.amountReturn = null;
      payload.fromLocation = (result.data.fromLocation ?? "").trim();
      payload.toLocation = (result.data.toLocation ?? "").trim();
      payload.purpose = (result.data.purpose ?? "").trim() || undefined;
      if (editingId) {
        await expensesApi.update(editingId, payload);
        toast.success("Expense updated");
      } else {
        await expensesApi.create(payload);
        toast.success("Expense added");
      }
      fetchExpenses();
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (exp: ExpenseDto) => {
    if (!expensesScopeAdmin) return;
    const next = exp.status === "paid" ? "unpaid" : "paid";
    try {
      await expensesApi.update(exp.id, { status: next });
      toast.success(`Marked as ${next}`);
      fetchExpenses();
      setStatusConfirmExp(null);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleStatusClick = (exp: ExpenseDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusConfirmExp(exp);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFiltered = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = filtered.map((exp) => exp.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  };

  const handleBulkStatusChange = async (status: "paid" | "unpaid") => {
    if (!expensesScopeAdmin) return;
    const idsToUpdate = selectedIds.filter((id) => filtered.some((e) => e.id === id));
    if (idsToUpdate.length === 0) {
      setSelectedIds([]);
      setBulkStatusTarget(null);
      return;
    }
    setBulkUpdating(true);
    try {
      await Promise.all(idsToUpdate.map((id) => expensesApi.update(id, { status })));
      toast.success(`Updated ${idsToUpdate.length} expense(s) to ${status}`);
      fetchExpenses();
      setSelectedIds([]);
      setBulkStatusTarget(null);
    } catch {
      toast.error("Failed to update some expenses");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkSoftDelete = async () => {
    const idsToDelete = selectedIds.filter((id) => filtered.some((e) => e.id === id));
    if (idsToDelete.length === 0) {
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      return;
    }
    setBulkDeleting(true);
    try {
      const { count } = await expensesApi.bulkSoftDelete(idsToDelete);
      if (count < idsToDelete.length) {
        toast.warning(`Deleted ${count} of ${idsToDelete.length} expense(s) (some could not be removed)`);
      } else {
        toast.success(
          count === 1
            ? "1 expense deleted"
            : `${count} expenses deleted`,
        );
      }
      setExpenses((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      void fetchExpenses();
    } catch {
      toast.error("Failed to delete expenses");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative shrink-0 min-w-[240px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {expensesScopeAdmin && (
          <Popover open={userFilterOpen} onOpenChange={setUserFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={userFilterOpen} className="w-44 shrink-0 justify-between font-normal h-9 text-sm">
                {filterUser === "all" ? "User" : (users.find((u) => u.id === filterUser)?.name ?? "User")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 min-w-[18rem] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name, email..." />
                <CommandList>
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="All users"
                      onSelect={() => {
                        setFilterUser("all");
                        setUserFilterOpen(false);
                      }}
                    >
                      User (all)
                    </CommandItem>
                    {users.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`${u.name} ${u.email} ${u.phone}`}
                        onSelect={() => {
                          setFilterUser(u.id);
                          setUserFilterOpen(false);
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{u.name}</span>
                          {(u.email || u.phone) && <span className="text-xs text-muted-foreground">{[u.email, u.phone].filter(Boolean).join(" · ")}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={periodPreset}
          onValueChange={(v) => {
            setPeriodPreset(v as ExpensePeriodPreset);
            setCustomDateRange({});
          }}
        >
          <SelectTrigger className="w-[148px] h-9">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={dateRangePopoverOpen} onOpenChange={setDateRangePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 justify-start text-left font-normal min-w-[200px] max-w-[280px] sm:max-w-xs",
                !customDateRange.from && periodPreset === "all" && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">
                {customDateRange.from
                  ? customDateRange.to
                    ? `${format(customDateRange.from, "MMM d, yyyy")} – ${format(customDateRange.to, "MMM d, yyyy")}`
                    : format(customDateRange.from, "MMM d, yyyy")
                  : periodPreset === "today"
                    ? `Today · ${format(new Date(), "MMM d, yyyy")}`
                    : periodPreset === "week"
                      ? "This week"
                      : periodPreset === "month"
                        ? format(new Date(), "MMMM yyyy")
                        : periodPreset === "year"
                          ? format(new Date(), "yyyy")
                          : "Date range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={
                customDateRange.from
                  ? { from: customDateRange.from, to: customDateRange.to }
                  : undefined
              }
              onSelect={(range) => {
                setCustomDateRange({ from: range?.from, to: range?.to });
                setPeriodPreset("all");
              }}
              numberOfMonths={2}
              captionLayout="dropdown"
              fromYear={2020}
              toYear={2030}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {(periodPreset !== "all" || !!customDateRange.from) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setPeriodPreset("all");
              setCustomDateRange({});
            }}
          >
            Clear dates
          </Button>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Paid: <span className="font-medium text-success">{totalPaid.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            Unpaid: <span className="font-medium text-warning">{totalUnpaid.toLocaleString()}</span>
          </span>
        </div>
        <div className="flex-1" />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
      </div>

      {loading ? (
        <Loader message="Loading expenses…" size="lg" className="py-16" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            search.trim() ||
            filterUser !== "all" ||
            filterStatus !== "all" ||
            expenseDateBounds !== null
              ? "No expenses match your filters"
              : "No expenses yet"
          }
          description={
            search.trim() ||
            filterUser !== "all" ||
            filterStatus !== "all" ||
            expenseDateBounds !== null
              ? "Try adjusting your search, status, period, or date range."
              : "Add your first expense."
          }
          actionLabel={
            !search.trim() &&
            filterUser === "all" &&
            filterStatus === "all" &&
            expenseDateBounds === null
              ? "Add Expense"
              : undefined
          }
          onAction={
            !search.trim() &&
            filterUser === "all" &&
            filterStatus === "all" &&
            expenseDateBounds === null
              ? openCreate
              : undefined
          }
        />
      ) : (
        <>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-lg border bg-muted/50">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              {expensesScopeAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setBulkStatusTarget("paid")} disabled={bulkUpdating || bulkDeleting}>
                    Mark as Paid
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBulkStatusTarget("unpaid")} disabled={bulkUpdating || bulkDeleting}>
                    Mark as Unpaid
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkUpdating || bulkDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} disabled={bulkUpdating || bulkDeleting}>
                Clear selection
              </Button>
            </div>
          )}
          <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id))}
                    onCheckedChange={() => {}}
                    onClick={selectAllFiltered}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden md:table-cell">From / To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead>Status</TableHead>
                {expensesScopeAdmin && <TableHead className="hidden lg:table-cell">Created By</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((exp) => (
                <TableRow 
                  key={exp.id} 
                  className={canEditExpense(exp) ? "cursor-pointer" : "cursor-not-allowed opacity-60"} 
                  onClick={() => canEditExpense(exp) && openEdit(exp)}
                >
                  <TableCell onClick={(e) => toggleSelect(exp.id, e)}>
                    <Checkbox checked={selectedIds.includes(exp.id)} onCheckedChange={() => {}} onClick={(e) => toggleSelect(exp.id, e)} aria-label="Select row" />
                  </TableCell>
                  <TableCell className="font-medium">{getCompanyName(exp.companyId)}</TableCell>
                  <TableCell>{formatTableDate(exp.date)}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">
                    {(() => {
                      const route = displayRoute(exp);
                      if (route.from === "—" && route.to === "—") return "—";
                      return (
                        <div className="flex items-center gap-1.5">
                          <span>{route.from}</span>
                          {route.isRoundTrip ? (
                            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          )}
                          <span>{route.to}</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {displayAmount(exp).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">{exp.purposeName || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">{exp.purpose || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${expensesScopeAdmin ? "cursor-pointer hover:opacity-90" : "cursor-default"} ${exp.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                      onClick={expensesScopeAdmin ? (e) => handleStatusClick(exp, e) : undefined}
                    >
                      {exp.status === "paid" ? "Paid" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  {expensesScopeAdmin && (
                    <TableCell className="hidden lg:table-cell">{getUserName(exp.createdByUserId)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <AlertDialog open={!!bulkStatusTarget} onOpenChange={(open) => !open && setBulkStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change status for selected expenses</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {selectedIds.filter((id) => filtered.some((e) => e.id === id)).length} expense(s) as <strong>{bulkStatusTarget === "paid" ? "Paid" : "Unpaid"}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkUpdating}
              onClick={() => bulkStatusTarget && handleBulkStatusChange(bulkStatusTarget)}
            >
              {bulkUpdating ? "Updating…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && !bulkDeleting && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected expenses?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.filter((id) => filtered.some((e) => e.id === id)).length} expense(s) will be removed from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleBulkSoftDelete();
              }}
            >
              {bulkDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!statusConfirmExp} onOpenChange={(open) => !open && setStatusConfirmExp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change expense status</AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirmExp && (
                <>
                  Mark this expense as <strong>{statusConfirmExp.status === "paid" ? "Unpaid" : "Paid"}</strong>?
                  {statusConfirmExp.companyId && (
                    <span className="block mt-1 text-muted-foreground">
                      {getCompanyName(statusConfirmExp.companyId)} · {statusConfirmExp.date?.slice(0, 10)} · {displayAmount(statusConfirmExp).toLocaleString()}
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusConfirmExp && handleStatusToggle(statusConfirmExp)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent
          showClose={false}
          className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/80 bg-background p-0 text-foreground shadow-2xl shadow-slate-300/40 sm:w-full sm:max-w-[min(100vw-1.25rem,28rem)] sm:rounded-2xl md:max-w-[min(100vw-1.5rem,32rem)] lg:max-w-[min(100vw-2rem,36rem)] [&>button.absolute]:hidden"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-24 -top-28 h-[min(22rem,50vw)] w-[min(22rem,50vw)] rounded-full bg-indigo-400/15 blur-[100px]" />
            <div className="absolute -bottom-32 -left-20 h-[min(20rem,45vw)] w-[min(20rem,45vw)] rounded-full bg-violet-400/10 blur-[90px]" />
          </div>

          <div className="relative z-[1] shrink-0 border-b border-border bg-gradient-to-r from-slate-50 via-background to-indigo-50/40 px-3 py-3 sm:px-4">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    {editingId ? "Edit expense" : "Add expense"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground sm:text-sm">Required fields marked below.</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form
            className="relative z-[1] flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
              <div className="min-w-0 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Company <span className="text-destructive">*</span>
                </Label>
                <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "h-10 w-full justify-between rounded-xl border border-input bg-background font-normal text-foreground shadow-sm hover:bg-background hover:text-foreground",
                        !form.companyId && "text-muted-foreground",
                      )}
                    >
                      {form.companyId ? getCompanyName(form.companyId) : "Select company"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search company..."
                        value={companySearchValue}
                        onValueChange={setCompanySearchValue}
                      />
                      <CommandList>
                        {companies.filter((c) => !companySearchValue || c.name.toLowerCase().includes(companySearchValue.toLowerCase())).length === 0 && companySearchValue && (
                          <CommandEmpty>No company found.</CommandEmpty>
                        )}
                        <CommandGroup>
                          {companies
                            .filter((c) => !companySearchValue || c.name.toLowerCase().includes(companySearchValue.toLowerCase()))
                            .map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setForm((f) => ({ ...f, companyId: c.id }));
                                  setCompanyOpen(false);
                                  setCompanySearchValue("");
                                }}
                              >
                                {c.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup>
                          <CommandItem
                            value="add new company"
                            onSelect={() => {
                              setCompanyOpen(false);
                              setNewCompanyForm((prev) => ({ ...prev, name: companySearchValue.trim() }));
                              setAddCompanyOpen(true);
                              setCompanySearchValue("");
                            }}
                            className="text-indigo-600 dark:text-indigo-400"
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

              <div className="min-w-0 space-y-2">
                <Label htmlFor="expense-purpose" className="text-xs font-medium text-muted-foreground">
                  Purpose <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.purposeId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, purposeId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger
                    id="expense-purpose"
                    className="h-10 w-full rounded-xl border border-input bg-background text-sm font-medium text-foreground shadow-sm focus:ring-2 focus:ring-indigo-500/25 [&>svg]:text-muted-foreground"
                  >
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent className="z-[200] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
                    <SelectItem value="none">Select purpose…</SelectItem>
                    {purposes.filter((p) => p.isActive).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.purposeId && <p className="text-sm text-destructive">{errors.purposeId}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-date" className="text-xs font-medium text-muted-foreground">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="h-10 rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                  />
                  {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Trip type</Label>
                  <Select
                    value={form.tripType}
                    onValueChange={(v) => {
                      const trip = v as "single_trip" | "round_trip";
                      setForm((f) => ({ ...f, tripType: trip, amountReturn: "" }));
                    }}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border border-input bg-background text-sm font-medium shadow-sm focus:ring-2 focus:ring-indigo-500/25 [&>svg]:text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200] rounded-xl border border-border bg-popover shadow-lg">
                      <SelectItem value="single_trip">Single trip</SelectItem>
                      <SelectItem value="round_trip">Round trip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-from" className="text-xs font-medium text-muted-foreground">
                    From <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expense-from"
                    value={form.fromLocation}
                    onChange={(e) => setForm((f) => ({ ...f, fromLocation: e.target.value }))}
                    placeholder="e.g. Dhaka"
                    className="h-10 rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                  />
                  {errors.fromLocation && (
                    <p className="text-sm text-destructive">{errors.fromLocation}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-to" className="text-xs font-medium text-muted-foreground">
                    To <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expense-to"
                    value={form.toLocation}
                    onChange={(e) => setForm((f) => ({ ...f, toLocation: e.target.value }))}
                    placeholder="e.g. Chittagong"
                    className="h-10 rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                  />
                  {errors.toLocation && (
                    <p className="text-sm text-destructive">{errors.toLocation}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-amount" className="text-xs font-medium text-muted-foreground">
                  Amount <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-10 max-w-full rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20 sm:max-w-xs"
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-notes" className="text-xs font-medium text-muted-foreground">
                  Optional details
                </Label>
                <Input
                  id="expense-notes"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="Additional context…"
                  className="h-10 rounded-xl border border-input bg-background text-sm shadow-sm focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                />
              </div>

              {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            </div>

            <DialogFooter className="relative z-[1] flex w-full shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/40 px-3 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-4 sm:py-3.5">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-10 w-full rounded-xl bg-indigo-600 px-6 font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 sm:w-auto"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
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
                      {cur.code} — {cur.name}{cur.symbol ? ` (${cur.symbol})` : ""}
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
    </Layout>
  );
}
