import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, CalendarIcon, Edit, User, X, Upload, Briefcase, ShieldAlert, GraduationCap, Camera, Save, MapPin, Home, Plus, Loader, Trash2, Landmark } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { cn } from "../lib/utils";
import {
  hrApi,
  usersApi,
  departmentsApi,
  designationsApi,
  employeeTypesApi,
  leavesApi,
  type EmployeeLeaveBalanceRowDto,
} from "../lib/api";
import { toast } from "sonner";
import { z } from "zod";
import { HrProfileSelect } from "@/components/hr/HrProfileSelect";
import { HrReportingManagerSelect } from "@/components/hr/HrReportingManagerSelect";
import { HrProfileDatePicker } from "@/components/hr/HrProfileDatePicker";

const GENDER_OPTIONS = [
  { value: "male", label: "Male", dotClass: "bg-sky-500" },
  { value: "female", label: "Female", dotClass: "bg-pink-500" },
  { value: "other", label: "Other", dotClass: "bg-violet-400" },
];

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({
  value: g,
  label: g,
  dotClass: "bg-red-500",
}));

const MARITAL_STATUS_OPTIONS = ["single", "married", "divorced", "widowed"].map((s) => ({
  value: s,
  label: s,
  dotClass: "bg-indigo-400",
}));

const RELIGION_OPTIONS = ["Islam", "Christianity", "Hinduism", "Buddhism", "Other"].map((r) => ({
  value: r,
  label: r,
  dotClass: "bg-emerald-500",
}));

const HR_SELECT_DOT_CLASSES = [
  "bg-indigo-400",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-teal-500",
];

// --- SCHEMAS ---
const hrInfoSchema = z.object({
  userId: z.string(),
  employeeId: z.string().optional(),
  employeeType: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
  reportingManagerId: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  mobile: z.string().optional(),
  personalMail: z.string().optional(),
  nid: z.string().optional(),
  birthDate: z.string().optional(),
  maritalStatus: z.string().optional(),
  religion: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  beneficiaryBankAccountNumber: z.string().optional(),
  receiverName: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  profilePicture: z.string().optional(),
});

const HRDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<any[]>([]);

  // UI States
  const fileRef = useRef<HTMLInputElement>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  // Sub-modals
  const [empHistoryOpen, setEmpHistoryOpen] = useState(false);
  const [editingEmpHistoryId, setEditingEmpHistoryId] = useState<string | null>(null);
  const [empHistoryForm, setEmpHistoryForm] = useState<any>({});
  const [appraisalDateOpen, setAppraisalDateOpen] = useState(false);
  const [nextActivityDateOpen, setNextActivityDateOpen] = useState(false);
  const [employmentHistoryDeleteId, setEmploymentHistoryDeleteId] = useState<string | null>(null);
  const [deletingEmploymentHistory, setDeletingEmploymentHistory] = useState(false);

  const [emergencyContactOpen, setEmergencyContactOpen] = useState(false);
  const [editingEmergencyContactId, setEditingEmergencyContactId] = useState<string | null>(null);
  const [emergencyContactForm, setEmergencyContactForm] = useState<any>({});

  const [academicOpen, setAcademicOpen] = useState(false);
  const [editingAcademicId, setEditingAcademicId] = useState<string | null>(null);
  const [academicForm, setAcademicForm] = useState<any>({});
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalanceRowDto[]>([]);
  const [savingLeaveBalances, setSavingLeaveBalances] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      
      // Load user, users list, departments, and designations
      const [u, allUsers, depts, desigs, empTypes, leaveBalanceData] = await Promise.all([
        usersApi.get(id),
        usersApi.list(),
        departmentsApi.list(),
        designationsApi.list(),
        employeeTypesApi.list(),
        leavesApi.getEmployeeBalances(id),
      ]);

      setUser(u);
      setUsers(allUsers);
      setDepartments(depts);
      setDesignations(desigs);
      setEmployeeTypes(empTypes);
      
      // Try to load HR info, but handle 404 gracefully (user might not have HR info yet)
      let hr = null;
      try {
        hr = await hrApi.get(id);
      } catch (err: any) {
        // If HR info doesn't exist (404), that's okay - we'll create it when user saves
        if (err?.status !== 404) {
          console.error("Failed to load HR info:", err);
          toast.error("Failed to load HR information");
        }
        // For 404, we just continue with hr = null
      }

      const initialForm = {
        hrInfoId: hr?.id || null, // Store HR info ID (different from user ID)
        userId: id,
        employeeId: hr?.employeeId || "",
        employeeType: hr?.employeeType || empTypes.find((t) => t.isActive)?.name || "",
        department: hr?.department || "",
        designation: hr?.designation || "",
        joiningDate: hr?.joiningDate || undefined,
        reportingManagerId: hr?.reportingManagerId || "",
        gender: hr?.gender || "male",
        bloodGroup: hr?.bloodGroup || "",
        mobile: hr?.mobile || "",
        personalMail: hr?.personalMail || "",
        nid: hr?.nid || "",
        birthDate: hr?.birthDate || undefined,
        maritalStatus: hr?.maritalStatus || "single",
        religion: hr?.religion || "",
        bankRoutingNumber: hr?.bankRoutingNumber || "",
        beneficiaryBankAccountNumber: hr?.beneficiaryBankAccountNumber || "",
        receiverName: hr?.receiverName || "",
        presentAddress: hr?.presentAddress || "",
        permanentAddress: hr?.permanentAddress || "",
        profilePicture: hr?.profilePicture || "",
        employmentHistory: hr?.employmentHistory || [],
        emergencyContacts: hr?.emergencyContacts || [],
        academicCertifications: hr?.academicCertifications || [],
      };
      setForm(initialForm);
      setProfilePicturePreview(hr?.profilePicture || null);
      setLeaveBalances(
        (leaveBalanceData?.balances || []).map((row) => ({
          leaveTypeId: row.leaveTypeId,
          leaveTypeName: row.leaveTypeName,
          isActive: row.isActive,
          balance: Number.isFinite(row.balance) ? row.balance : 0,
          remainingBalance:
            typeof row.remainingBalance === "number" ? row.remainingBalance : undefined,
          additionalOutstanding:
            typeof row.additionalOutstanding === "number"
              ? row.additionalOutstanding
              : undefined,
        })),
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load HR details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const payload = { ...form };
      // Remove fields that shouldn't be sent to the API
      delete payload.employmentHistory;
      delete payload.emergencyContacts;
      delete payload.academicCertifications;
      delete payload.hrInfoId; // Don't send hrInfoId to the API (it's managed by the backend)

      await hrApi.update(id, payload);
      toast.success("HR information saved successfully");
      // Reload data to get the HR info ID (needed for adding sub-items like employment history)
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save HR information");
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProfilePicturePreview(base64);
        setForm((p: any) => ({ ...p, profilePicture: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePicture = () => {
    setProfilePicturePreview(null);
    setForm((p: any) => ({ ...p, profilePicture: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const formatDateOnly = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  const updateLeaveBalanceValue = (leaveTypeId: string, rawValue: string) => {
    const parsed = Number(rawValue);
    setLeaveBalances((prev) =>
      prev.map((row) =>
        row.leaveTypeId === leaveTypeId
          ? {
              ...row,
              balance: Number.isFinite(parsed) ? parsed : 0,
              remainingBalance: undefined,
              additionalOutstanding: undefined,
            }
          : row,
      ),
    );
  };

  const saveLeaveBalances = async () => {
    if (!id) return;
    try {
      setSavingLeaveBalances(true);
      const hasInvalid = leaveBalances.some(
        (row) => !Number.isFinite(row.balance) || row.balance < 0,
      );
      if (hasInvalid) {
        toast.error("Leave balance must be a valid non-negative number");
        return;
      }
      await leavesApi.updateEmployeeBalances(
        id,
        leaveBalances.map((row) => ({
          leaveTypeId: row.leaveTypeId,
          balance: row.balance,
        })),
      );
      toast.success("Leave balances updated successfully");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update leave balances");
    } finally {
      setSavingLeaveBalances(false);
    }
  };

  // --- Employment History ---
  const openEmpHistoryEdit = (historyId?: string) => {
    if (historyId) {
      const item = form.employmentHistory.find((h: any) => h.id === historyId);
      setEmpHistoryForm({ ...item });
      setEditingEmpHistoryId(historyId);
    } else {
      setEmpHistoryForm({ activity: "", appraisalDate: formatDateOnly(new Date()), nextActivity: "", nextActivityDate: "", remarks: "" });
      setEditingEmpHistoryId(null);
    }
    setEmpHistoryOpen(true);
  };

  const saveEmpHistory = async () => {
    if (!id) return;
    try {
      // Ensure HR info exists before creating employment history
      if (!form.hrInfoId) {
        toast.error("Please save the HR profile first before adding employment history");
        return;
      }
      
      if (editingEmpHistoryId) {
        await hrApi.updateEmploymentHistory(editingEmpHistoryId, empHistoryForm);
      } else {
        await hrApi.createEmploymentHistory({ ...empHistoryForm, hrInfoId: form.hrInfoId });
      }
      toast.success("Employment history updated");
      setEmpHistoryOpen(false);
      loadData();
    } catch (error) {
      toast.error("Failed to save employment history");
    }
  };

  const confirmDeleteEmploymentHistory = async () => {
    if (!employmentHistoryDeleteId) return;
    try {
      setDeletingEmploymentHistory(true);
      await hrApi.deleteEmploymentHistory(employmentHistoryDeleteId);
      const deletedId = employmentHistoryDeleteId;
      setEmploymentHistoryDeleteId(null);
      if (editingEmpHistoryId === deletedId) {
        setEmpHistoryOpen(false);
        setEditingEmpHistoryId(null);
      }
      toast.success("Employment record deleted");
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete employment record";
      toast.error(message);
    } finally {
      setDeletingEmploymentHistory(false);
    }
  };

  // --- Emergency Contact ---
  const openEmergencyContactEdit = (contactId?: string) => {
    if (contactId) {
      const item = form.emergencyContacts.find((c: any) => c.id === contactId);
      setEmergencyContactForm({ ...item });
      setEditingEmergencyContactId(contactId);
    } else {
      setEmergencyContactForm({ name: "", phone: "", relation: "", address: "" });
      setEditingEmergencyContactId(null);
    }
    setEmergencyContactOpen(true);
  };

  const saveEmergencyContact = async () => {
    if (!id) return;
    try {
      // Ensure HR info exists before creating emergency contact
      if (!form.hrInfoId) {
        toast.error("Please save the HR profile first before adding emergency contact");
        return;
      }
      
      if (editingEmergencyContactId) {
        await hrApi.updateEmergencyContact(editingEmergencyContactId, emergencyContactForm);
      } else {
        await hrApi.createEmergencyContact({ ...emergencyContactForm, hrInfoId: form.hrInfoId });
      }
      toast.success("Emergency contact updated");
      setEmergencyContactOpen(false);
      loadData();
    } catch (error) {
      toast.error("Failed to save emergency contact");
    }
  };

  // --- Academic ---
  const openAcademicEdit = (academicId?: string) => {
    if (academicId) {
      const item = form.academicCertifications.find((a: any) => a.id === academicId);
      setAcademicForm({ ...item });
      setEditingAcademicId(academicId);
    } else {
      setAcademicForm({ degree: "", institute: "", year: new Date().getFullYear().toString(), grade: "", attachmentFileName: "", attachmentData: "" });
      setEditingAcademicId(null);
    }
    setAcademicOpen(true);
  };

  const handleAcademicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAcademicForm((p: any) => ({
          ...p,
          attachmentFileName: file.name,
          attachmentData: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveAcademic = async () => {
    if (!id) return;
    try {
      // Ensure HR info exists before creating academic certification
      if (!form.hrInfoId) {
        toast.error("Please save the HR profile first before adding academic certification");
        return;
      }
      
      if (editingAcademicId) {
        await hrApi.updateAcademicCertification(editingAcademicId, academicForm);
      } else {
        await hrApi.createAcademicCertification({ ...academicForm, hrInfoId: form.hrInfoId });
      }
      toast.success("Academic certification updated");
      setAcademicOpen(false);
      loadData();
    } catch (error) {
      toast.error("Failed to save academic certification");
    }
  };

  const formatTableDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const EmptyPlaceholder = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
      <Icon className="h-16 w-16 mb-4 stroke-[1px]" />
      <p className="text-sm font-bold uppercase tracking-widest">{label}</p>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex h-full min-h-0 items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        {/* Header Section */}
        <div className="shrink-0 px-6 py-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/hr?tab=profiles")}
                className="rounded-full h-10 w-10 p-0 border-border hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{user.name}</h1>
                <p className="text-sm text-muted-foreground">Manage employee profile and records</p>
              </div>
            </div>
            
            {activeTab === "basic" && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-medium transition-all animate-in fade-in zoom-in duration-300"
              >
                {saving ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Profile
              </Button>
            )}
            {activeTab === "leave-balance" && (
              <Button
                onClick={saveLeaveBalances}
                disabled={savingLeaveBalances}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-medium transition-all animate-in fade-in zoom-in duration-300"
              >
                {savingLeaveBalances ? (
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Leave Balances
              </Button>
            )}
          </div>
        </div>

        {/* Navigation & Content Area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 bg-card border-b border-border px-6">
              <TabsList className="h-14 bg-transparent p-0 gap-8">
                <TabsTrigger value="basic" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-medium transition-all">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="employment" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-medium transition-all">
                  Employment History
                </TabsTrigger>
                <TabsTrigger value="emergency" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-medium transition-all">
                  Emergency Contacts
                </TabsTrigger>
                <TabsTrigger value="academic" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-medium transition-all">
                  Education
                </TabsTrigger>
                <TabsTrigger value="leave-balance" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-medium transition-all">
                  Leave Balance
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              {/* --- BASIC INFORMATION TAB --- */}
              <TabsContent value="basic" className="mt-0 space-y-6 animate-in fade-in-50 duration-300 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-2 gap-6">
                  {/* Profile Card */}
                  <div className="space-y-6">
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full flex flex-col justify-center">
                      <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4">
                          {profilePicturePreview ? (
                            <img src={profilePicturePreview} alt="Profile" className="h-24 w-24 rounded-2xl object-cover ring-4 ring-muted" />
                          ) : (
                            <div className="h-24 w-24 rounded-2xl bg-muted flex items-center justify-center ring-4 ring-muted">
                              <User className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                          )}
                          <label htmlFor="profile-picture" className="absolute -bottom-1 -right-1 h-8 w-8 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer shadow-sm hover:bg-accent transition-all">
                            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                            <input type="file" ref={fileRef} accept="image/*" onChange={handleProfilePicture} className="hidden" id="profile-picture" />
                          </label>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>

                      <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-primary/40" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Gender</span>
                          </div>
                          <HrProfileSelect
                            variant="compact"
                            value={form.gender || ""}
                            onChange={v => setForm(p => ({ ...p, gender: v }))}
                            options={GENDER_OPTIONS}
                            align="end"
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-red-500/40" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Blood Group</span>
                          </div>
                          <HrProfileSelect
                            variant="compact"
                            value={form.bloodGroup || ""}
                            onChange={v => setForm(p => ({ ...p, bloodGroup: v }))}
                            options={BLOOD_GROUP_OPTIONS}
                            placeholder="Select"
                            align="end"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workplace Section */}
                  <div className="space-y-6">
                    <div className="bg-card rounded-2xl border border-border p-8 shadow-sm relative overflow-hidden group h-full">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                      <div className="flex items-center gap-4 mb-8 relative">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                          <Briefcase className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Workplace</h3>
                          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Professional Assignment</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6 relative">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Employee ID</Label>
                          <Input value={form.employeeId || ""} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="bg-muted/50 border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Employment Type</Label>
                          <HrProfileSelect
                            value={form.employeeType || ""}
                            onChange={v => setForm(p => ({ ...p, employeeType: v }))}
                            placeholder="Select type"
                            options={employeeTypes.filter(t => t.isActive).map((t, i) => ({
                              value: t.name,
                              label: t.name,
                              dotClass: HR_SELECT_DOT_CLASSES[i % HR_SELECT_DOT_CLASSES.length],
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Department</Label>
                          <HrProfileSelect
                            value={form.department || ""}
                            onChange={v => setForm(p => ({ ...p, department: v }))}
                            allowEmpty
                            options={departments.filter(d => d.isActive).map((d, i) => ({
                              value: d.name,
                              label: d.name,
                              dotClass: HR_SELECT_DOT_CLASSES[i % HR_SELECT_DOT_CLASSES.length],
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Designation</Label>
                          <HrProfileSelect
                            value={form.designation || ""}
                            onChange={v => setForm(p => ({ ...p, designation: v }))}
                            allowEmpty
                            options={designations.filter(d => d.isActive).map((d, i) => ({
                              value: d.name,
                              label: d.name,
                              dotClass: HR_SELECT_DOT_CLASSES[i % HR_SELECT_DOT_CLASSES.length],
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Joining Date</Label>
                          <HrProfileDatePicker
                            value={form.joiningDate}
                            onChange={v => setForm(p => ({ ...p, joiningDate: v }))}
                            placeholder="Select joining date"
                            maxYear={new Date().getFullYear() + 5}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Reporting Manager</Label>
                          <HrReportingManagerSelect
                            value={form.reportingManagerId || ""}
                            onChange={v => setForm(p => ({ ...p, reportingManagerId: v }))}
                            users={users}
                            excludeUserId={form.userId}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Combined Personal Information Section */}
                <div className="bg-card rounded-2xl border border-border p-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-8 relative">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Personal Info</h3>
                      <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Identity & Communication</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-6 relative">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Mobile Number</Label>
                      <Input value={form.mobile || ""} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className="bg-muted/50 border-border" placeholder="+880..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Personal Email</Label>
                      <Input value={form.personalMail || ""} onChange={e => setForm(p => ({ ...p, personalMail: e.target.value }))} className="bg-muted/50 border-border" placeholder="email@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">National ID (NID)</Label>
                      <Input value={form.nid || ""} onChange={e => setForm(p => ({ ...p, nid: e.target.value }))} className="bg-muted/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                      <HrProfileDatePicker
                        value={form.birthDate}
                        onChange={v => setForm(p => ({ ...p, birthDate: v }))}
                        placeholder="Select date of birth"
                        maxYear={new Date().getFullYear()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Marital Status</Label>
                      <HrProfileSelect
                        value={form.maritalStatus || ""}
                        onChange={v => setForm(p => ({ ...p, maritalStatus: v }))}
                        options={MARITAL_STATUS_OPTIONS}
                        capitalize
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Religion</Label>
                      <HrProfileSelect
                        value={form.religion || ""}
                        onChange={v => setForm(p => ({ ...p, religion: v }))}
                        options={RELIGION_OPTIONS}
                      />
                    </div>
                  </div>

                  <div className="mt-8 border-t border-border pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                        <Landmark className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-[0.15em] text-foreground">Bank Info</h4>
                        <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Payment & account details</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-x-8 gap-y-6 relative">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Account Name</Label>
                      <Input
                        value={form.receiverName || ""}
                        onChange={e => setForm(p => ({ ...p, receiverName: e.target.value }))}
                        className="bg-muted/50 border-border"
                        placeholder="Enter account name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bank Account Number</Label>
                      <Input
                        value={form.beneficiaryBankAccountNumber || ""}
                        onChange={e => setForm(p => ({ ...p, beneficiaryBankAccountNumber: e.target.value }))}
                        className="bg-muted/50 border-border"
                        placeholder="Enter bank account number"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Routing Number</Label>
                      <Input
                        value={form.bankRoutingNumber || ""}
                        onChange={e => setForm(p => ({ ...p, bankRoutingNumber: e.target.value }))}
                        className="bg-muted/50 border-border"
                        placeholder="Enter routing number"
                      />
                    </div>
                  </div>
                  </div>
                </div>

                {/* Addresses Section */}
                <div className="bg-card rounded-2xl border border-border p-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                  <div className="flex items-center gap-4 mb-8 relative">
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                      <MapPin className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Address</h3>
                      <p className="text-[10px] text-muted-foreground font-bold mt-0.5">Residential Details</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 relative">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Present</Label>
                      <Textarea value={form.presentAddress || ""} onChange={e => setForm((p: any) => ({ ...p, presentAddress: e.target.value }))} className="min-h-[100px] bg-muted/50 border-border resize-none" placeholder="Current location..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Permanent</Label>
                      <Textarea value={form.permanentAddress || ""} onChange={e => setForm((p: any) => ({ ...p, permanentAddress: e.target.value }))} className="min-h-[100px] bg-muted/50 border-border resize-none" placeholder="Home town address..." />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* --- SHARED TABLE STYLING --- */}
              <style>{`
                .modern-container { @apply bg-card rounded-2xl border border-border shadow-sm overflow-hidden; }
                .modern-table thead th { @apply text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border py-4 px-6 bg-muted/50; }
                .modern-table tbody tr { @apply border-b border-border/50 last:border-none hover:bg-muted/50 transition-colors; }
                .modern-table tbody td { @apply py-4 px-6 text-sm text-foreground; }
              `}</style>

              {/* --- EMPLOYMENT HISTORY --- */}
              <TabsContent value="employment" className="mt-0 animate-in fade-in-50 duration-300">
                <div className="modern-container">
                  <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Professional Timeline</h3>
                    <Button onClick={() => openEmpHistoryEdit()} className="rounded-full bg-primary text-primary-foreground h-9 px-4 text-xs font-bold">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Add Record
                    </Button>
                  </div>
                  {(form.employmentHistory || []).length === 0 ? (
                    <EmptyPlaceholder icon={Briefcase} label="No career records found" />
                  ) : (
                    <Table className="modern-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Activity</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Next Milestone</TableHead>
                          <TableHead>Next Date</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(form.employmentHistory || []).map(emp => (
                          <TableRow key={emp.id} className="cursor-pointer" onClick={() => openEmpHistoryEdit(emp.id)}>
                            <TableCell className="font-semibold text-foreground">{emp.activity}</TableCell>
                            <TableCell>{emp.appraisalDate ? formatTableDate(emp.appraisalDate) : "—"}</TableCell>
                            <TableCell>{emp.nextActivity || "—"}</TableCell>
                            <TableCell>{emp.nextActivityDate ? formatTableDate(emp.nextActivityDate) : "—"}</TableCell>
                            <TableCell className="italic text-muted-foreground">{emp.remarks || "—"}</TableCell>
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label="Delete employment record"
                                onClick={() => setEmploymentHistoryDeleteId(emp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>

              {/* --- EMERGENCY CONTACT --- */}
              <TabsContent value="emergency" className="mt-0 animate-in fade-in-50 duration-300">
                <div className="modern-container">
                  <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Emergency Contacts</h3>
                    <Button onClick={() => openEmergencyContactEdit()} className="rounded-full bg-primary text-primary-foreground h-9 px-4 text-xs font-bold">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Add Contact
                    </Button>
                  </div>
                  {(form.emergencyContacts || []).length === 0 ? (
                    <EmptyPlaceholder icon={ShieldAlert} label="No emergency contacts" />
                  ) : (
                    <Table className="modern-table">
                      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Relation</TableHead><TableHead>Address</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(form.emergencyContacts || []).map(ec => (
                          <TableRow key={ec.id} className="cursor-pointer" onClick={() => openEmergencyContactEdit(ec.id)}>
                            <TableCell className="font-semibold text-foreground">{ec.name}</TableCell>
                            <TableCell className="text-foreground">{ec.phone}</TableCell>
                            <TableCell><Badge variant="outline" className="rounded-full px-3">{ec.relation}</Badge></TableCell>
                            <TableCell className="max-w-xs truncate">{ec.address}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>

              {/* --- ACADEMIC CERTIFICATIONS --- */}
              <TabsContent value="academic" className="mt-0 animate-in fade-in-50 duration-300">
                <div className="modern-container">
                  <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Educational Background</h3>
                    <Button onClick={() => openAcademicEdit()} className="rounded-full bg-primary text-primary-foreground h-9 px-4 text-xs font-bold">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Add Education
                    </Button>
                  </div>
                  {(form.academicCertifications || []).length === 0 ? (
                    <EmptyPlaceholder icon={GraduationCap} label="No education records" />
                  ) : (
                    <Table className="modern-table">
                      <TableHeader><TableRow><TableHead>Degree</TableHead><TableHead>Institute</TableHead><TableHead>Year</TableHead><TableHead>Grade</TableHead><TableHead>Attachment</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(form.academicCertifications || []).map(acad => (
                          <TableRow key={acad.id} className="cursor-pointer" onClick={() => openAcademicEdit(acad.id)}>
                            <TableCell className="font-semibold text-foreground">{acad.degree}</TableCell>
                            <TableCell>{acad.institute}</TableCell>
                            <TableCell>{acad.year}</TableCell>
                            <TableCell><Badge className="bg-muted text-foreground hover:bg-muted">{acad.grade}</Badge></TableCell>
                            <TableCell>
                              {acad.attachmentFileName ? (
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={e => { e.stopPropagation(); if (acad.attachmentData) { const l = document.createElement("a"); l.href = acad.attachmentData; l.download = acad.attachmentFileName; l.click(); } }}>
                                  <Upload className="h-3 w-3 mr-2" /> Download
                                </Button>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>

              {/* --- LEAVE BALANCE --- */}
              <TabsContent value="leave-balance" className="mt-0 animate-in fade-in-50 duration-300">
                <div className="space-y-6">
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                    <div className="relative flex items-start justify-between gap-6">
                      <div>
                        <h3 className="text-lg font-semibold">Leave Balance Management</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Set employee leave entitlement by leave type. Use decimals if needed (example: 10.5).
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full px-3 py-1 text-xs bg-primary/5 border-primary/20 text-primary"
                      >
                        {leaveBalances.length} type{leaveBalances.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>

                  {leaveBalances.length === 0 ? (
                    <div className="modern-container">
                      <EmptyPlaceholder icon={CalendarIcon} label="No active leave types available" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {leaveBalances.map((row) => (
                        <Card
                          key={row.leaveTypeId}
                          className="border-border bg-card/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="p-4 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {row.leaveTypeName}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Credited days (HR assignment)
                              </p>
                              {typeof row.remainingBalance === "number" &&
                              typeof row.additionalOutstanding === "number" ? (
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px] leading-snug">
                                  Effective remaining:{" "}
                                  <span className="font-medium text-foreground tabular-nums">
                                    {Number.isInteger(row.remainingBalance)
                                      ? row.remainingBalance
                                      : row.remainingBalance.toFixed(1)}
                                  </span>
                                  {row.additionalOutstanding > 0 ? (
                                    <>
                                      {" "}
                                      · Additional outstanding:{" "}
                                      <span className="font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                                        {Number.isInteger(row.additionalOutstanding)
                                          ? row.additionalOutstanding
                                          : row.additionalOutstanding.toFixed(1)}
                                      </span>
                                    </>
                                  ) : null}
                                </p>
                              ) : null}
                            </div>
                            <div className="relative w-[140px]">
                              <Input
                                type="number"
                                min={0}
                                step="0.5"
                                value={row.balance === 0 ? "" : row.balance}
                                onChange={(e) =>
                                  updateLeaveBalanceValue(row.leaveTypeId, e.target.value)
                                }
                                placeholder="0"
                                className="h-10 pr-10 text-right font-semibold bg-muted/40 border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                day
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Employment History Dialog */}
        <Dialog open={empHistoryOpen} onOpenChange={setEmpHistoryOpen}>
          <DialogContent className="rounded-[2rem] border-border bg-card shadow-2xl p-8 max-w-lg">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">{editingEmpHistoryId ? "Edit" : "Add"} Professional Milestone</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Activity Type</Label>
                  <Input
                    value={empHistoryForm.activity || ""}
                    onChange={(e) => setEmpHistoryForm((prev: any) => ({ ...prev, activity: e.target.value }))}
                    placeholder="e.g. Promotion"
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Activity Date</Label>
                  <Popover open={appraisalDateOpen} onOpenChange={setAppraisalDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-11 justify-start rounded-xl border-border bg-muted/30 font-normal", !empHistoryForm.appraisalDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {empHistoryForm.appraisalDate ? format(new Date(empHistoryForm.appraisalDate), "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-border shadow-xl rounded-2xl overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={empHistoryForm.appraisalDate ? new Date(empHistoryForm.appraisalDate) : undefined}
                        onSelect={(date) => {
                          setEmpHistoryForm((prev: any) => ({ ...prev, appraisalDate: date ? formatDateOnly(date) : undefined }));
                          setAppraisalDateOpen(false);
                        }}
                        captionLayout="dropdown-buttons"
                        fromYear={1900}
                        toYear={new Date().getFullYear() + 10}
                        initialFocus
                        className="p-4"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Next Activity</Label>
                  <Input
                    value={empHistoryForm.nextActivity || ""}
                    onChange={(e) => setEmpHistoryForm((prev: any) => ({ ...prev, nextActivity: e.target.value }))}
                    placeholder="e.g. Next Increment"
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Next Activity Date</Label>
                  <Popover open={nextActivityDateOpen} onOpenChange={setNextActivityDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-11 justify-start rounded-xl border-border bg-muted/30 font-normal", !empHistoryForm.nextActivityDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {empHistoryForm.nextActivityDate ? format(new Date(empHistoryForm.nextActivityDate), "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-border shadow-xl rounded-2xl overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={empHistoryForm.nextActivityDate ? new Date(empHistoryForm.nextActivityDate) : undefined}
                        onSelect={(date) => {
                          setEmpHistoryForm((prev: any) => ({ ...prev, nextActivityDate: date ? formatDateOnly(date) : undefined }));
                          setNextActivityDateOpen(false);
                        }}
                        captionLayout="dropdown-buttons"
                        fromYear={1900}
                        toYear={new Date().getFullYear() + 10}
                        initialFocus
                        className="p-4"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Remarks</Label>
                <Textarea
                  value={empHistoryForm.remarks || ""}
                  onChange={(e) => setEmpHistoryForm((prev: any) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional notes..."
                  className="min-h-[100px] rounded-xl border-border bg-muted/30 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <DialogFooter className="mt-10 gap-3">
              <Button variant="ghost" onClick={() => setEmpHistoryOpen(false)} className="rounded-full font-medium px-6">Cancel</Button>
              <Button onClick={saveEmpHistory} className="rounded-full bg-primary text-primary-foreground font-medium px-8">Save Milestone</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={employmentHistoryDeleteId !== null}
          onOpenChange={(open) => {
            if (!open && !deletingEmploymentHistory) setEmploymentHistoryDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete employment record?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the milestone from the timeline. You can add a new record later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingEmploymentHistory}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingEmploymentHistory}
                onClick={() => void confirmDeleteEmploymentHistory()}
              >
                {deletingEmploymentHistory ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Emergency Contact Dialog */}
        <Dialog open={emergencyContactOpen} onOpenChange={setEmergencyContactOpen}>
          <DialogContent className="rounded-[2rem] border-border bg-card shadow-2xl p-8 max-w-lg">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">{editingEmergencyContactId ? "Edit" : "Add"} Emergency Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input
                  value={emergencyContactForm.name || ""}
                  onChange={(e) => setEmergencyContactForm((prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contact person name"
                  className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Phone Number</Label>
                  <Input
                    value={emergencyContactForm.phone || ""}
                    onChange={(e) => setEmergencyContactForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+880..."
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Relation</Label>
                  <Input
                    value={emergencyContactForm.relation || ""}
                    onChange={(e) => setEmergencyContactForm((prev: any) => ({ ...prev, relation: e.target.value }))}
                    placeholder="e.g. Father, Spouse"
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                <Textarea
                  value={emergencyContactForm.address || ""}
                  onChange={(e) => setEmergencyContactForm((prev: any) => ({ ...prev, address: e.target.value }))}
                  placeholder="Contact person address"
                  className="min-h-[100px] rounded-xl border-border bg-muted/30 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <DialogFooter className="mt-10 gap-3">
              <Button variant="ghost" onClick={() => setEmergencyContactOpen(false)} className="rounded-full font-medium px-6">Cancel</Button>
              <Button onClick={saveEmergencyContact} className="rounded-full bg-primary text-primary-foreground font-medium px-8">Save Contact</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Academic Dialog */}
        <Dialog open={academicOpen} onOpenChange={setAcademicOpen}>
          <DialogContent className="rounded-[2rem] border-border bg-card shadow-2xl p-8 max-w-lg">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">{editingAcademicId ? "Edit" : "Add"} Education Qualification</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Degree / Qualification</Label>
                <Input
                  value={academicForm.degree || ""}
                  onChange={(e) => setAcademicForm((prev: any) => ({ ...prev, degree: e.target.value }))}
                  placeholder="e.g. B.Sc in Computer Science"
                  className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Institute</Label>
                <Input
                  value={academicForm.institute || ""}
                  onChange={(e) => setAcademicForm((prev: any) => ({ ...prev, institute: e.target.value }))}
                  placeholder="University / College name"
                  className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Passing Year</Label>
                  <Input
                    value={academicForm.year || ""}
                    onChange={(e) => setAcademicForm((prev: any) => ({ ...prev, year: e.target.value }))}
                    placeholder="YYYY"
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Grade / GPA</Label>
                  <Input
                    value={academicForm.grade || ""}
                    onChange={(e) => setAcademicForm((prev: any) => ({ ...prev, grade: e.target.value }))}
                    placeholder="e.g. 3.80 / 4.00"
                    className="h-11 rounded-xl border-border bg-muted/30 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Upload Attachment</Label>
                <div className="flex items-center gap-4">
                  <Button variant="outline" className="h-11 rounded-xl border-dashed border-2 border-border bg-muted/30 font-medium flex-1 justify-start px-4" onClick={() => document.getElementById("academic-file")?.click()}>
                    <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="truncate">{academicForm.attachmentFileName || "Select file..."}</span>
                  </Button>
                  <input type="file" id="academic-file" className="hidden" onChange={handleAcademicFile} accept=".pdf,.jpg,.jpeg,.png" />
                  {academicForm.attachmentFileName && (
                    <Button variant="ghost" size="icon" onClick={() => setAcademicForm((p: any) => ({ ...p, attachmentFileName: "", attachmentData: "" }))} className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10">
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-10 gap-3">
              <Button variant="ghost" onClick={() => setAcademicOpen(false)} className="rounded-full font-medium px-6">Cancel</Button>
              <Button onClick={saveAcademic} className="rounded-full bg-primary text-primary-foreground font-medium px-8">Save Qualification</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default HRDetails;
