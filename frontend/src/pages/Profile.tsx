import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, Mail, Phone, Shield, Calendar, Building2, 
  MapPin, Settings2, Check, X, Globe, FileText, Hash, Lock 
} from "lucide-react";
import { toast } from "sonner";
import { companyProfileApi, authApi } from "@/lib/api";
import type { CompanyProfileDto } from "@/lib/api";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileDto | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setForm({ name: user?.name ?? "", phone: user?.phone ?? "" });
  }, [user?.name, user?.phone]);

  useEffect(() => {
    companyProfileApi.get().then(setCompanyProfile).catch(() => setCompanyProfile(null));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      toast.success("Profile updated successfully");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword.trim()) {
      setPasswordError("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast.success("Password changed successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Simplified Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Profile & Organization</h1>
            <p className="text-slate-500 font-medium mt-1">Manage your identity and business details.</p>
          </div>
          {!editing ? (
            <Button 
              variant="outline" 
              className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold px-6 shadow-sm"
              onClick={() => setEditing(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="font-semibold text-slate-500">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>

        {/* Section 1: User Identity */}
        <div className="space-y-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-1 bg-indigo-600 rounded-full" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Personal Information</h2>
          </div>
          
          <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-10">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-3">
                  <div className="h-24 w-24 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-none font-bold uppercase text-[10px] tracking-widest px-3">
                    {user?.role}
                  </Badge>
                </div>

                {/* Form Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User className="h-3.5 w-3.5" /> Full Name
                    </Label>
                    {editing ? (
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11 rounded-lg border-slate-200 focus:ring-indigo-500" />
                    ) : (
                      <p className="text-lg font-semibold text-slate-800">{user?.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> Phone Number
                    </Label>
                    {editing ? (
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-11 rounded-lg border-slate-200" placeholder="—" />
                    ) : (
                      <p className="text-lg font-semibold text-slate-800">{user?.phone || "—"}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Primary Email
                    </Label>
                    <p className="text-lg font-semibold text-slate-500">{user?.email}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" /> Joined Date
                    </Label>
                    <p className="text-lg font-semibold text-slate-800">{user?.createdAt}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current password</Label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    className="h-11 rounded-lg border-slate-200"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">New password</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="At least 6 characters"
                    className="h-11 rounded-lg border-slate-200"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirm new password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Re-enter new password"
                    className="h-11 rounded-lg border-slate-200"
                    autoComplete="new-password"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive font-medium md:col-span-2">{passwordError}</p>
                )}
                <div className="md:col-span-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordSaving}
                    variant="outline"
                    className="rounded-xl border-slate-200 font-semibold"
                  >
                    {passwordSaving ? "Updating…" : "Update Password"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Company Data */}
        {companyProfile && (
          <div className="space-y-6 text-left animate-in fade-in duration-1000">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-1 bg-slate-800 rounded-full" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Organization Profile</h2>
            </div>
            
            <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Company Banner-like Header */}
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-2 shadow-sm">
                    {companyProfile.logo ? (
                      <img src={companyProfile.logo} alt="Logo" className="object-contain" />
                    ) : (
                      <Building2 className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{companyProfile.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{companyProfile.industry || "General Industry"}</p>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  {companyProfile.website && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" /> Website
                      </Label>
                      <a href={companyProfile.website.startsWith("http") ? companyProfile.website : `https://${companyProfile.website}`} 
                         target="_blank" rel="noopener noreferrer" 
                         className="text-lg font-bold text-indigo-600 hover:underline">
                        {companyProfile.website}
                      </a>
                    </div>
                  )}

                  {companyProfile.taxId && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5" /> Tax ID / Registration
                      </Label>
                      <p className="text-lg font-semibold text-slate-800">{companyProfile.taxId}</p>
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> Registered Address
                    </Label>
                    <p className="text-lg font-semibold text-slate-800">
                      {[companyProfile.address, companyProfile.city, companyProfile.country].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>

                  {companyProfile.description && (
                    <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-50">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" /> About the Company
                      </Label>
                      <p className="text-slate-600 leading-relaxed font-medium">{companyProfile.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}