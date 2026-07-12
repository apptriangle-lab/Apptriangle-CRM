import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { Company } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Search, Building2, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import { useNavigate } from "react-router-dom";
import { companiesApi, usersApi, currenciesApi } from "@/lib/api";
import type { CurrencyDto } from "@/lib/api";
import { COUNTRIES } from "@/data/mockData";
import { formatTableDate } from "@/lib/utils";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Name must be under 100 characters"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be under 200 characters"),
  country: z.string().trim().min(1, "Country is required"),
  currencyId: z.string().min(1, "Currency is required"),
  kamUserId: z.string().min(1, "Key Account Manager is required"),
});

function toCompany(d: {
  id: string;
  name: string;
  location: string;
  country: string;
  currencyId?: string;
  kamUserId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}): Company {
  return {
    id: d.id,
    name: d.name,
    location: d.location ?? "",
    country: d.country ?? "",
    currencyId: d.currencyId ?? "",
    kamUserId: d.kamUserId ?? "",
    createdByUserId: d.createdByUserId ?? "",
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
    updatedAt: d.updatedAt?.split?.("T")[0] ?? d.updatedAt ?? "",
  };
}

export default function Companies() {
  const navigate = useNavigate();
  const { isPageScopeAdmin } = useRbac();
  const companiesScopeAdmin = isPageScopeAdmin("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [kamOpen, setKamOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterKam, setFilterKam] = useState("all");
  const [filterKamOpen, setFilterKamOpen] = useState(false);
  const [filterKamSearchValue, setFilterKamSearchValue] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchCompanies = () => {
    setLoading(true);
    const searchQuery = search.trim();
    companiesApi
      .list({
        search: searchQuery || undefined,
        country: filterCountry !== "all" ? filterCountry : undefined,
        kamUserId: filterKam !== "all" ? filterKam : undefined,
      })
      .then((list) => setCompanies(list.map(toCompany)))
      .catch(() => toast.error("Failed to load companies"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    usersApi
      .list()
      .then((list) =>
        setUsers(
          list
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" }))
        )
      )
      .catch(() => {});
    currenciesApi.list().then(setCurrencies).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [search, filterCountry, filterKam]);

  const uniqueCountries = useMemo(() => [...new Set(companies.map((c) => c.country).filter(Boolean))].sort(), [companies]);

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";

  const resetForm = () => {
    setForm({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
    setErrors({});
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setForm({ name: c.name, location: c.location, country: c.country, currencyId: c.currencyId ?? "", kamUserId: c.kamUserId });
    setEditingId(c.id);
    setErrors({});
    setOpen(true);
  };

  const getCurrencyLabel = (currencyId: string) => {
    if (!currencyId) return "—";
    const c = currencies.find((x) => x.id === currencyId);
    return c ? `${c.code}${c.symbol ? ` (${c.symbol})` : ""}` : currencyId;
  };

  const handleSave = async () => {
    const result = companySchema.safeParse(form);
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
        await companiesApi.update(editingId, {
          name: form.name.trim(),
          location: form.location.trim(),
          country: form.country,
          currencyId: form.currencyId || undefined,
          kamUserId: form.kamUserId,
        });
        toast.success("Company updated successfully");
      } else {
        await companiesApi.create({
          name: form.name.trim(),
          location: form.location.trim(),
          country: form.country,
          currencyId: form.currencyId,
          kamUserId: form.kamUserId,
        });
        toast.success("Company created successfully");
      }
      fetchCompanies();
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      setErrors({ submit: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, location, country, KAM…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search companies"
          />
        </div>
        <Select
          value={filterCountry}
          onValueChange={setFilterCountry}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {uniqueCountries.filter(c => c && c.trim() !== "").map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover
          open={filterKamOpen}
          onOpenChange={(o) => {
            setFilterKamOpen(o);
            if (!o) setFilterKamSearchValue("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={filterKamOpen}
              className="h-10 w-[min(100%,14rem)] min-w-[14rem] justify-between font-normal sm:w-56"
            >
              <span className="truncate text-left">
                {filterKam === "all"
                  ? "All KAMs"
                  : (users.find((x) => x.id === filterKam)?.name ?? "All KAMs")}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search KAMs…"
                value={filterKamSearchValue}
                onValueChange={setFilterKamSearchValue}
              />
              <CommandList>
                {users.filter((u) => {
                  const q = filterKamSearchValue.toLowerCase();
                  return (
                    !filterKamSearchValue ||
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.phone.toLowerCase().includes(q)
                  );
                }).length === 0 &&
                  filterKamSearchValue && <CommandEmpty>No KAM found.</CommandEmpty>}
                <CommandGroup>
                  <CommandItem
                    value="all kams"
                    onSelect={() => {
                      setFilterKam("all");
                      setFilterKamOpen(false);
                      setFilterKamSearchValue("");
                    }}
                  >
                    <span className="font-medium">All KAMs</span>
                  </CommandItem>
                  {users
                    .filter((u) => {
                      const q = filterKamSearchValue.toLowerCase();
                      return (
                        !filterKamSearchValue ||
                        u.name.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        u.phone.toLowerCase().includes(q)
                      );
                    })
                    .map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`${u.name} ${u.email} ${u.phone}`}
                        onSelect={() => {
                          setFilterKam(u.id);
                          setFilterKamOpen(false);
                          setFilterKamSearchValue("");
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
        <div className="flex-1" />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      {loading ? (
        <Loader message="Loading companies…" size="lg" className="py-16" />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            search.trim() || filterCountry !== "all" || filterKam !== "all"
              ? "No companies match your filters"
              : "No companies yet"
          }
          description={
            search.trim() || filterCountry !== "all" || filterKam !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Get started by adding your first company."
          }
          actionLabel={!search.trim() && filterCountry === "all" && filterKam === "all" ? "Add Company" : undefined}
          onAction={!search.trim() && filterCountry === "all" && filterKam === "all" ? openCreate : undefined}
        />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Companies ({companies.length})</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="hidden md:table-cell">Country</TableHead>
                <TableHead className="hidden md:table-cell">Currency</TableHead>
                <TableHead className="hidden md:table-cell">KAM</TableHead>
                {companiesScopeAdmin && (
                  <TableHead className="hidden lg:table-cell">Created By</TableHead>
                )}
                <TableHead className="hidden lg:table-cell">Created On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/companies/${c.id}`)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.location}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.country}</TableCell>
                  <TableCell className="hidden md:table-cell">{getCurrencyLabel(c.currencyId)}</TableCell>
                  <TableCell className="hidden md:table-cell">{getUserName(c.kamUserId)}</TableCell>
                  {companiesScopeAdmin && (
                    <TableCell className="hidden lg:table-cell">{getUserName(c.createdByUserId)}</TableCell>
                  )}
                  <TableCell className="hidden lg:table-cell">
                    {formatTableDate(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Company" : "New Company"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter company name"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Location *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, State"
              />
              {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <Select 
                value={form.currencyId && form.currencyId !== "" ? form.currencyId : undefined} 
                onValueChange={(v) => setForm({ ...form, currencyId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.filter(cur => cur.id && cur.id.trim() !== "").map((cur) => (
                    <SelectItem key={cur.id} value={cur.id}>
                      {cur.code} — {cur.name}{cur.symbol ? ` (${cur.symbol})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currencyId && <p className="text-sm text-destructive">{errors.currencyId}</p>}
            </div>
            <div className="space-y-1">
              <Label>Country *</Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.country || "Select country"}
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
                              setForm({ ...form, country: c });
                              setCountryOpen(false);
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
              {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
            </div>
            <div className="space-y-1">
              <Label>Key Account Manager (KAM) *</Label>
              <Popover open={kamOpen} onOpenChange={setKamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={kamOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.kamUserId
                      ? (() => {
                          const u = users.find((x) => x.id === form.kamUserId);
                          return u ? u.name : "Select KAM";
                        })()
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
                              setForm((prev) => ({ ...prev, kamUserId: u.id }));
                              setKamOpen(false);
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
              {errors.kamUserId && <p className="text-sm text-destructive">{errors.kamUserId}</p>}
            </div>
            {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving…" : editingId ? "Update Company" : "Create Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
