import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { User, Role } from "@/data/mockData";
import { usersApi } from "@/lib/api";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, UserCog, Lock, Users, ShieldCheck, Shield, Building2, Mail, Phone, Eye, EyeOff, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { type CurrencySettingsRef } from "@/components/settings/CurrencySettings";
import { VariablesSettingsPanel } from "@/components/settings/VariablesSettingsPanel";
import { BinSettingsPanel } from "@/components/settings/BinSettingsPanel";
import { RbacSettings } from "@/components/settings/RbacSettings";
import { z } from "zod";
import { cn, formatTableDate } from "@/lib/utils";

const SETTINGS_TAB_VALUES = new Set(["users", "rbac", "variables", "company", "bin"]);

const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email must be under 255 characters"),
  role: z.enum(["user", "admin"]),
});

function PasswordField({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  error,
  className,
  withLockIcon = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  className?: string;
  withLockIcon?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        {withLockIcon && (
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(withLockIcon ? "pl-9 pr-10" : "pr-10", "h-10", className)}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
    </div>
  );
}

function toUser(d: any): User {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    phone: d.phone ?? "",
    role: d.role === "admin" ? "admin" : "user",
    isActive: d.isActive,
    createdAt: d.createdAt?.split("T")[0] ?? d.createdAt ?? "",
  };
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";
  const activeTab = SETTINGS_TAB_VALUES.has(tabParam) ? tabParam : "users";
  const setActiveTab = (val: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", val);
        return next;
      },
      { replace: true },
    );
  };

  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "user" as Role, isActive: true, password: "", passwordConfirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const currencySettingsRef = useRef<CurrencySettingsRef>(null);

  const fetchUsers = () => {
    setLoading(true);
    usersApi.list()
      .then(list => setUsers(list.map(toUser)))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => { 
    setForm({ name: "", email: "", phone: "", role: "user", isActive: true, password: "", passwordConfirm: "" }); 
    setErrors({}); 
    setEditingId(null); 
    setShowCreatePassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSave = async () => {
    const result = userSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    if (!editingId && (!form.password || form.password.length < 6)) {
      setErrors(prev => ({ ...prev, password: "Password must be at least 6 characters" }));
      return;
    }

    if (editingId) {
      const wantsPasswordChange = form.password.length > 0 || form.passwordConfirm.length > 0;
      if (wantsPasswordChange) {
        const fieldErrors: Record<string, string> = {};
        if (!form.password || form.password.length < 6) {
          fieldErrors.password = "Password must be at least 6 characters";
        }
        if (form.password !== form.passwordConfirm) {
          fieldErrors.passwordConfirm = "Passwords do not match";
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrors }));
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await usersApi.update(editingId, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          isActive: form.isActive,
        });
        if (form.password) {
          await usersApi.setPassword(editingId, form.password);
        }
        toast.success(form.password ? "User and password updated successfully" : "User updated successfully");
      } else {
        await usersApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          role: form.role,
        });
        toast.success("User created successfully");
      }
      fetchUsers();
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: User) => {
    setForm({ ...user, password: "", passwordConfirm: "" } as any);
    setEditingId(user.id);
    setErrors({});
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setOpen(true);
  };

  return (
    <Layout>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-6"
      >
        <TabsList className="sticky top-0 z-20 h-auto w-full shrink-0 flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <TabsTrigger
            value="users"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4 shrink-0 opacity-80" /> User & Roles
          </TabsTrigger>
          <TabsTrigger
            value="rbac"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Shield className="h-4 w-4 shrink-0 opacity-80" /> RBAC
          </TabsTrigger>
          <TabsTrigger
            value="variables"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings2 className="h-4 w-4 shrink-0 opacity-80" /> Variables
          </TabsTrigger>
          <TabsTrigger
            value="company"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Building2 className="h-4 w-4 shrink-0 opacity-80" /> Company Info
          </TabsTrigger>
          <TabsTrigger
            value="bin"
            className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Trash2 className="h-4 w-4 shrink-0 opacity-80" /> Bin
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-9 h-10 shadow-sm" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <Button onClick={() => { resetForm(); setOpen(true); }} className="w-full sm:w-auto shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add New User
            </Button>
          </div>

          {loading ? (
            <Loader message="Loading users…" size="lg" className="py-20" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title={search ? "No matches found" : "Your team is empty"}
              description={search ? "Adjust your search filters." : "Start adding users to collaborate."}
            />
          ) : (
            <div className="rounded-xl border border-border shadow-sm bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 py-4">User Details</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell text-right px-6">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow 
                      key={u.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors group" 
                      onClick={() => openEdit(u)}
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs border border-primary/20">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground leading-none">{u.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">ID: {u.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 mr-1.5 shrink-0" /> {u.email}
                          </div>
                          {u.phone && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 mr-1.5 shrink-0" /> {u.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "shadow-none",
                            u.role === "admin" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          )}
                        >
                          {u.role === "admin" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                          {u.role.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={cn(
                            "shadow-none border",
                            u.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"
                          )}
                        >
                          {u.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right px-6 text-muted-foreground text-xs font-mono">
                        {formatTableDate(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rbac" className="mt-0 space-y-6 animate-in fade-in duration-300">
          <RbacSettings />
        </TabsContent>

        <TabsContent value="variables" className="mt-0">
          <VariablesSettingsPanel currencySettingsRef={currencySettingsRef} />
        </TabsContent>

        <TabsContent value="company" className="mt-0 animate-in fade-in duration-300 pt-1">
          <CompanySettings />
        </TabsContent>

        <TabsContent value="bin" className="mt-0 animate-in fade-in duration-300">
          <BinSettingsPanel />
        </TabsContent>
      </Tabs>

      {/* Modernized Dialog */ }
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary rounded-lg">
                  <UserCog className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">{editingId ? "Update User" : "Add Team Member"}</DialogTitle>
                  <DialogDescription>
                    Configure access and details for {editingId ? "this account" : "a new user"}.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Full Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="h-10" />
                {errors.name && <p className="text-[11px] text-destructive font-medium">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Email Address *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" className="h-10" />
                {errors.email && <p className="text-[11px] text-destructive font-medium">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Phone Number</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+880..." className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Access Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Standard User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingId ? (
              <div className="space-y-1.5 bg-muted/40 p-4 rounded-lg border border-dashed">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Security Credentials *</Label>
                <PasswordField
                  value={form.password}
                  onChange={(password) => setForm({ ...form, password })}
                  placeholder="Create a strong password"
                  show={showCreatePassword}
                  onToggleShow={() => setShowCreatePassword((v) => !v)}
                  error={errors.password}
                  withLockIcon
                />
                <p className="text-[10px] text-muted-foreground">Must be at least 6 characters.</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="user-active" className="text-sm font-semibold text-emerald-900 cursor-pointer">Account Visibility</Label>
                  <p className="text-[11px] text-emerald-700">Toggle user's ability to log in and access data.</p>
                </div>
                <Switch 
                  id="user-active" 
                  checked={form.isActive} 
                  onCheckedChange={v => setForm({ ...form, isActive: v })} 
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            )}

            {editingId && (
              <div className="space-y-3 pt-2 border-t border-border border-dashed">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Change Password (Optional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <PasswordField
                    value={form.password}
                    onChange={(password) => setForm({ ...form, password })}
                    placeholder="New password"
                    show={showNewPassword}
                    onToggleShow={() => setShowNewPassword((v) => !v)}
                    error={errors.password}
                  />
                  <PasswordField
                    value={form.passwordConfirm}
                    onChange={(passwordConfirm) => setForm({ ...form, passwordConfirm })}
                    placeholder="Confirm new"
                    show={showConfirmPassword}
                    onToggleShow={() => setShowConfirmPassword((v) => !v)}
                    error={errors.passwordConfirm}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/30 p-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="px-8 shadow-sm">
              {saving ? "Processing..." : editingId ? "Update User" : "Create Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout >
  );
}