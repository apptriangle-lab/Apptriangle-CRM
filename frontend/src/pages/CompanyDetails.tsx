import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, Pencil } from "lucide-react";
import { Company } from "@/data/mockData";
import { COUNTRIES } from "@/data/mockData";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { companiesApi, contactsApi, usersApi, currenciesApi } from "@/lib/api";
import type { CurrencyDto } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Building2, Users, CheckSquare, DollarSign, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { formatStatusLabel, formatTableDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  lead: "bg-muted text-muted-foreground",
  prospect: "bg-info/10 text-info",
  negotiation: "bg-warning/10 text-warning",
  closed: "bg-success/10 text-success",
  disqualified: "bg-destructive/10 text-destructive",
};

export default function CompanyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, fetchTasks } = useTaskStore();
  const { sales, fetchSales } = useSalesStore();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string; companyId: string; designation: string | null; mobile: string; email: string | null }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string; location: string; country: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [kamOpen, setKamOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", country: "", currencyId: "", kamUserId: "" });
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactEditingId, setContactEditingId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", companyId: "", designation: "", mobile: "", email: "" });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [companyOpen, setCompanyOpen] = useState(false);

  const contactSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
    companyId: z.string().min(1, "Company is required"),
    designation: z.string().max(100).optional(),
    mobile: z.string().trim().min(1, "Mobile is required").max(20, "Mobile must be under 20 characters"),
    email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      companiesApi.get(id),
      contactsApi.list({ companyId: id }),
      usersApi.list(),
      companiesApi.list(),
      currenciesApi.list(),
    ])
      .then(([companyRes, contactsRes, usersRes, companiesRes, currenciesRes]) => {
        setCompany({
          id: companyRes.id,
          name: companyRes.name,
          location: companyRes.location ?? "",
          country: companyRes.country ?? "",
          currencyId: companyRes.currencyId ?? "",
          kamUserId: companyRes.kamUserId ?? "",
          createdByUserId: companyRes.createdByUserId ?? "",
          createdAt: companyRes.createdAt?.split?.("T")[0] ?? companyRes.createdAt ?? "",
          updatedAt: companyRes.updatedAt?.split?.("T")[0] ?? companyRes.updatedAt ?? "",
        });
        setCurrencies(currenciesRes);
        setContacts(contactsRes.map((c) => ({ id: c.id, name: c.name, companyId: c.companyId, designation: c.designation, mobile: c.mobile, email: c.email })));
        setUsers(
          usersRes
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "" }))
        );
        setCompanies(companiesRes.map((c) => ({ id: c.id, name: c.name, location: c.location ?? "", country: c.country ?? "" })));
        fetchTasks({ companyId: id });
        fetchSales({ companyId: id });
      })
      .catch(() => {
        setCompany(null);
        toast.error("Failed to load company");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";

  const resetContactForm = () => {
    setContactForm({ name: "", companyId: company?.id ?? "", designation: "", mobile: "", email: "" });
    setContactEditingId(null);
    setContactErrors({});
  };

  const openAddContact = () => {
    setContactForm({
      name: "",
      companyId: company?.id ?? "",
      designation: "",
      mobile: "",
      email: "",
    });
    setContactEditingId(null);
    setContactErrors({});
    setContactOpen(true);
  };

  const openEditContact = (c: { id: string; name: string; companyId: string; designation: string | null; mobile: string; email: string | null }) => {
    setContactForm({
      name: c.name,
      companyId: c.companyId,
      designation: c.designation ?? "",
      mobile: c.mobile,
      email: c.email ?? "",
    });
    setContactEditingId(c.id);
    setContactErrors({});
    setContactOpen(true);
  };

  const refetchContacts = () => {
    if (!id) return;
    contactsApi.list({ companyId: id }).then((list) =>
      setContacts(list.map((c) => ({ id: c.id, name: c.name, companyId: c.companyId, designation: c.designation, mobile: c.mobile, email: c.email })))
    );
  };

  const handleContactSave = () => {
    const result = contactSchema.safeParse(contactForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setContactErrors(fieldErrors);
      return;
    }
    setContactSaving(true);
    const payload = {
      name: contactForm.name.trim(),
      companyId: contactForm.companyId,
      designation: contactForm.designation.trim() || undefined,
      mobile: contactForm.mobile.trim(),
      email: contactForm.email.trim() || undefined,
    };
    if (contactEditingId) {
      contactsApi
        .update(contactEditingId, payload)
        .then(() => {
          refetchContacts();
          toast.success("Contact updated");
          setContactOpen(false);
          resetContactForm();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update");
          setContactErrors({ submit: "Update failed" });
        })
        .finally(() => setContactSaving(false));
    } else {
      contactsApi
        .create(payload)
        .then(() => {
          refetchContacts();
          toast.success("Contact created");
          setContactOpen(false);
          resetContactForm();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create");
          setContactErrors({ submit: "Create failed" });
        })
        .finally(() => setContactSaving(false));
    }
  };

  const handleContactDelete = (contactId: string) => {
    if (!confirm("Delete this contact?")) return;
    contactsApi
      .delete(contactId)
      .then(() => {
        refetchContacts();
        toast.success("Contact deleted");
        if (contactEditingId === contactId) {
          setContactOpen(false);
          resetContactForm();
        }
      })
      .catch(() => toast.error("Failed to delete contact"));
  };

  const openEdit = () => {
    if (!company) return;
    setForm({ name: company.name, location: company.location, country: company.country, currencyId: company.currencyId ?? "", kamUserId: company.kamUserId });
    setEditOpen(true);
  };

  const getCurrencyLabel = (currencyId: string) => {
    if (!currencyId) return "—";
    const c = currencies.find((x) => x.id === currencyId);
    return c ? `${c.code}${c.symbol ? ` (${c.symbol})` : ""}` : currencyId;
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const updated = await companiesApi.update(company.id, {
        name: form.name.trim(),
        location: form.location.trim(),
        country: form.country,
        currencyId: form.currencyId || undefined,
        kamUserId: form.kamUserId,
      });
      setCompany({
        ...company,
        name: updated.name,
        location: updated.location ?? "",
        country: updated.country ?? "",
        currencyId: updated.currencyId ?? "",
        kamUserId: updated.kamUserId ?? "",
      });
      setEditOpen(false);
      toast.success("Company updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loader message="Loading company…" size="lg" className="py-16" />
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Company not found</h2>
          <Button variant="outline" onClick={() => navigate("/companies")}>
            Back to Companies
          </Button>
        </div>
      </Layout>
    );
  }

  const companyTasks = tasks.filter((t) => t.companyId === company.id);
  const companySales = sales.filter((s) => s.companyId === company.id);

  return (
    <Layout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Companies
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="page-title">{company.name}</h1>
              <p className="text-sm text-muted-foreground">{company.location} · {company.country}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => openEdit()}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground block">Location</span><span className="font-medium">{company.location}</span></div>
            <div><span className="text-muted-foreground block">Country</span><span className="font-medium">{company.country}</span></div>
            <div><span className="text-muted-foreground block">Currency</span><span className="font-medium">{getCurrencyLabel(company.currencyId)}</span></div>
            <div><span className="text-muted-foreground block">KAM</span><span className="font-medium">{getUserName(company.kamUserId)}</span></div>
            <div><span className="text-muted-foreground block">Created</span><span className="font-medium">{company.createdAt}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contacts</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{contacts.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{companyTasks.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${companySales.reduce((s, d) => s + d.expectedRevenue, 0).toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({companyTasks.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({companySales.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          {companyTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tasks for this company</p>
          ) : (
            <div className="data-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Assigned To</TableHead>
                    <TableHead className="hidden md:table-cell">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyTasks.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tasks/${t.id}`)}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[t.status]}>{t.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">{getUserName(t.assignToUserId)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatTableDate(t.dueDatetime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="deals">
          {companySales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No deals for this company</p>
          ) : (
            <div className="data-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Revenue</TableHead>
                    <TableHead className="hidden md:table-cell">Closing Date</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companySales.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/companies/${company.id}/sales/${s.id}`)}>
                      <TableCell className="font-medium">{s.prospect}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          s.category === "hot" ? "bg-destructive/10 text-destructive" :
                          s.category === "warm" ? "bg-warning/10 text-warning" :
                          "bg-info/10 text-info"
                        }>{formatStatusLabel(s.category)}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[s.status]}>{formatStatusLabel(s.status)}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">${s.expectedRevenue.toLocaleString()}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatTableDate(s.expectedClosingDate)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/companies/${company.id}/sales/${s.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openAddContact}>
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No contacts for this company. Add one above.</p>
          ) : (
            <div className="data-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="hidden md:table-cell">Mobile</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openEditContact(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.designation ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.mobile}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleContactDelete(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Location *</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Currency *</Label>
              <Select value={form.currencyId || ""} onValueChange={(v) => setForm((prev) => ({ ...prev, currencyId: v }))}>
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
            </div>
            <div className="space-y-1">
              <Label>Country *</Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={countryOpen} className="w-full justify-between font-normal">
                    {form.country || "Select country"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col" align="start" onWheel={(e) => e.stopPropagation()}>
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search country..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRIES.map((c) => (
                          <CommandItem key={c} value={c} onSelect={() => { setForm((prev) => ({ ...prev, country: c })); setCountryOpen(false); }}>
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Key Account Manager *</Label>
              <Popover open={kamOpen} onOpenChange={setKamOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={kamOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.kamUserId
                      ? (users.find((x) => x.id === form.kamUserId)?.name ?? "Select KAM")
                      : "Select KAM"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col" align="start" onWheel={(e) => e.stopPropagation()}>
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
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving…" : "Update Company"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={(v) => { setContactOpen(v); if (!v) resetContactForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contactEditingId ? "Edit Contact" : "New Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Full name" />
              {contactErrors.name && <p className="text-sm text-destructive">{contactErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Company *</Label>
              <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={companyOpen} className="w-full justify-between font-normal">
                    {contactForm.companyId
                      ? (companies.find((x) => x.id === contactForm.companyId)?.name ?? "Select company")
                      : "Select company"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-[min(320px,70vh)] p-0 overflow-hidden flex flex-col" align="start" onWheel={(e) => e.stopPropagation()}>
                  <Command className="flex flex-col max-h-full min-h-0">
                    <CommandInput placeholder="Search by company name, location or country..." />
                    <CommandList className="flex-1 min-h-0">
                      <CommandEmpty>No company found.</CommandEmpty>
                      <CommandGroup>
                        {companies.map((comp) => (
                          <CommandItem
                            key={comp.id}
                            value={`${comp.name} ${comp.location} ${comp.country}`}
                            onSelect={() => {
                              setContactForm((prev) => ({ ...prev, companyId: comp.id }));
                              setCompanyOpen(false);
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
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {contactErrors.companyId && <p className="text-sm text-destructive">{contactErrors.companyId}</p>}
            </div>
            <div className="space-y-1">
              <Label>Mobile *</Label>
              <Input value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} placeholder="+1-555-0000" />
              {contactErrors.mobile && <p className="text-sm text-destructive">{contactErrors.mobile}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@example.com" />
              {contactErrors.email && <p className="text-sm text-destructive">{contactErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} placeholder="e.g. CTO" />
              {contactErrors.designation && <p className="text-sm text-destructive">{contactErrors.designation}</p>}
            </div>
            {contactErrors.submit && <p className="text-sm text-destructive">{contactErrors.submit}</p>}
            <div className="flex gap-2">
              {contactEditingId && (
                <Button variant="destructive" onClick={() => handleContactDelete(contactEditingId)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              )}
              <Button onClick={handleContactSave} disabled={contactSaving} className="flex-1">
                {contactSaving ? "Saving…" : contactEditingId ? "Update Contact" : "Create Contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
