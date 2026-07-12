import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { Contact } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmCompanyFilterDropdown } from "@/components/crm/CrmCompanyFilterDropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader } from "@/components/ui/loader";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Search, Users, ChevronsUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { contactsApi, companiesApi, usersApi, currenciesApi } from "@/lib/api";
import type { CurrencyDto } from "@/lib/api";
import { COUNTRIES } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { z } from "zod";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
  companyId: z.string().min(1, "Company is required"),
  designation: z
    .string()
    .max(100, "Designation must be under 100 characters")
    .optional(),
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .max(20, "Mobile must be under 20 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be under 255 characters")
    .optional()
    .or(z.literal("")),
});

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Name must be under 100 characters"),
  location: z.string().trim().min(1, "Location is required").max(200, "Location must be under 200 characters"),
  country: z.string().trim().min(1, "Country is required"),
  currencyId: z.string().min(1, "Currency is required"),
  kamUserId: z.string().min(1, "Key Account Manager is required"),
});

const emptyForm = {
  name: "",
  companyId: "",
  designation: "",
  mobile: "",
  email: "",
};

function toContact(d: {
  id: string;
  name: string;
  companyId: string;
  designation: string | null;
  mobile: string;
  email: string | null;
  createdByUserId?: string;
  createdAt: string;
}): Contact {
  return {
    id: d.id,
    name: d.name,
    companyId: d.companyId,
    designation: d.designation,
    mobile: d.mobile,
    email: d.email,
    createdByUserId: d.createdByUserId ?? "",
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
  };
}

export default function Contacts() {
  const { isPageScopeAdmin } = useRbac();
  const contactsScopeAdmin = isPageScopeAdmin("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [companies, setCompanies] = useState<
    { id: string; name: string; location: string; country: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState("");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    location: "",
    country: "",
    currencyId: "",
    kamUserId: "",
  });
  const [addCompanySaving, setAddCompanySaving] = useState(false);
  const [addCompanyErrors, setAddCompanyErrors] = useState<Record<string, string>>({});
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [addCompanyCountryOpen, setAddCompanyCountryOpen] = useState(false);
  const [addCompanyKamOpen, setAddCompanyKamOpen] = useState(false);

  const fetchCompanies = () =>
    companiesApi
      .list()
      .then((list) =>
        setCompanies(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location ?? "",
            country: c.country ?? "",
          })),
        ),
      )
      .catch(() => {});

  const fetchContacts = () => {
    setLoading(true);
    contactsApi
      .list({
        search: search || undefined,
        companyId: filterCompany !== "all" ? filterCompany : undefined,
      })
      .then((list) => setContacts(list.map(toContact)))
      .catch(() => toast.error("Failed to load contacts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompanies();
    usersApi
      .list()
      .then((list) =>
        setUsers(
          list
            .filter((u) => u.isActive)
            .map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email ?? "",
              phone: u.phone ?? "",
            })),
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
    fetchContacts();
  }, [search, filterCompany]);

  const getCompanyName = (companyId: string) =>
    companies.find((c) => c.id === companyId)?.name ?? "—";

  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.name ?? "—";

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
    setCompanySearchValue("");
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
      toast.success("Company added. You can continue with the contact.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add company");
      setAddCompanyErrors({ submit: err instanceof Error ? err.message : "Failed to add company" });
    } finally {
      setAddCompanySaving(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (c: Contact) => {
    setForm({
      name: c.name,
      companyId: c.companyId,
      designation: c.designation ?? "",
      mobile: c.mobile,
      email: c.email ?? "",
    });
    setEditingId(c.id);
    setErrors({});
    setOpen(true);
  };

  const handleSave = () => {
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      companyId: form.companyId,
      designation: form.designation.trim() || undefined,
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
    };

    if (editingId) {
      contactsApi
        .update(editingId, payload)
        .then((updated) => {
          setContacts((prev) =>
            prev.map((c) => (c.id === editingId ? toContact(updated) : c)),
          );
          toast.success("Contact updated successfully");
          setOpen(false);
          resetForm();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update");
          setErrors({ submit: "Update failed" });
        })
        .finally(() => setSaving(false));
    } else {
      contactsApi
        .create(payload)
        .then((created) => {
          setContacts((prev) => [toContact(created), ...prev]);
          toast.success("Contact created successfully");
          setOpen(false);
          resetForm();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create");
          setErrors({ submit: "Create failed" });
        })
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this contact?")) return;
    contactsApi
      .delete(id)
      .then(() => {
        setContacts((prev) => prev.filter((c) => c.id !== id));
        toast.success("Contact deleted");
        if (editingId === id) {
          setOpen(false);
          resetForm();
        }
      })
      .catch(() => toast.error("Failed to delete contact"));
  };

  return (
    <Layout>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <CrmCompanyFilterDropdown
          value={filterCompany}
          onChange={setFilterCompany}
          companies={companies}
        />
        <div className="relative w-72 min-w-[200px] max-w-sm shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
              search.trim() && "border-indigo-200 bg-indigo-50/40",
            )}
          />
        </div>
        <div className="flex-1" />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </div>

      {loading ? (
        <Loader message="Loading contacts…" size="lg" className="py-16" />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search || filterCompany !== "all"
              ? "No contacts match your filters"
              : "No contacts yet"
          }
          description={
            search || filterCompany !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Add your first contact to get started."
          }
          actionLabel={
            !search && filterCompany === "all" ? "Add Contact" : undefined
          }
          onAction={!search && filterCompany === "all" ? openCreate : undefined}
        />
      ) : (
        <div className="data-table">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">
                  Name ({contacts.length})
                </TableHead>
                <TableHead className="w-[18%]">Company</TableHead>
                <TableHead className="hidden md:table-cell w-[18%]">
                  Designation
                </TableHead>
                <TableHead className="w-[14%] min-w-0">Mobile</TableHead>
                <TableHead className="hidden lg:table-cell min-w-0">
                  Email
                </TableHead>
                {contactsScopeAdmin && (
                  <TableHead className="hidden xl:table-cell">Created by</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => {
                const maskMobile = (mobile: string) => {
                  if (!mobile || mobile.length === 0) return mobile;
                  if (mobile.length === 1) return "X";
                  return mobile.slice(0, -1) + "X";
                };
                
                const maskEmail = (email: string) => {
                  const at = email.indexOf("@");
                  if (at === -1) return email;

                  const local = email.slice(0, at);
                  const domain = email.slice(at); // includes "@"

                  const first3 = local.slice(0, 3);
                  return `${first3}***${domain}`;
                };

                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{getCompanyName(c.companyId)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.designation ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {maskMobile(c.mobile)}
                    </TableCell>
                    <TableCell
                      className="hidden lg:table-cell font-mono text-sm min-w-0 truncate"
                      title={c.email ?? undefined}
                    >
                      {c.email ? maskEmail(c.email) : "—"}
                    </TableCell>
                    {contactsScopeAdmin && (
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                        {c.createdByUserId ? getUserName(c.createdByUserId) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
            <DialogTitle>
              {editingId ? "Edit Contact" : "New Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Company *</Label>
              <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={companyOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.companyId
                      ? (() => {
                          const c = companies.find((x) => x.id === form.companyId);
                          return c
                            ? c.location || c.country
                              ? `${c.name} · ${[c.location, c.country].filter(Boolean).join(", ")}`
                              : c.name
                            : "Select company";
                        })()
                      : "Select company"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by company name, location or country..."
                      value={companySearchValue}
                      onValueChange={setCompanySearchValue}
                    />
                    <CommandList>
                      {companies.filter((comp) => {
                        const searchLower = companySearchValue.toLowerCase();
                        return (
                          !companySearchValue ||
                          comp.name.toLowerCase().includes(searchLower) ||
                          comp.location?.toLowerCase().includes(searchLower) ||
                          comp.country?.toLowerCase().includes(searchLower)
                        );
                      }).length === 0 &&
                        companySearchValue && (
                          <CommandEmpty>No company found.</CommandEmpty>
                        )}
                      <CommandGroup>
                        {companies
                          .filter((comp) => {
                            const searchLower = companySearchValue.toLowerCase();
                            return (
                              !companySearchValue ||
                              comp.name.toLowerCase().includes(searchLower) ||
                              comp.location?.toLowerCase().includes(searchLower) ||
                              comp.country?.toLowerCase().includes(searchLower)
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
                          value="add new company"
                          onSelect={() => {
                            setCompanyOpen(false);
                            setNewCompanyForm((prev) => ({
                              ...prev,
                              name: companySearchValue.trim(),
                            }));
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
              {errors.companyId && (
                <p className="text-sm text-destructive">{errors.companyId}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Mobile *</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="+1-555-0000"
              />
              {errors.mobile && (
                <p className="text-sm text-destructive">{errors.mobile}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Email </Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) =>
                  setForm({ ...form, designation: e.target.value })
                }
                placeholder="e.g. CTO, VP Sales"
              />
              {errors.designation && (
                <p className="text-sm text-destructive">{errors.designation}</p>
              )}
            </div>
            {errors.submit && (
              <p className="text-sm text-destructive">{errors.submit}</p>
            )}
            <div className="flex gap-2">
              {editingId && (
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(editingId)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update Contact"
                    : "Create Contact"}
              </Button>
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
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] flex flex-col overflow-hidden p-0"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex max-h-full min-h-0 flex-col">
                    <CommandInput placeholder="Search country..." />
                    <CommandList className="min-h-0 flex-1">
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
              {addCompanyErrors.currencyId && (
                <p className="text-sm text-destructive">{addCompanyErrors.currencyId}</p>
              )}
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
                  className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] flex flex-col overflow-hidden p-0"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command className="flex max-h-full min-h-0 flex-col">
                    <CommandInput placeholder="Search by name, email or mobile..." />
                    <CommandList className="min-h-0 flex-1">
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
              {addCompanyErrors.kamUserId && (
                <p className="text-sm text-destructive">{addCompanyErrors.kamUserId}</p>
              )}
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
