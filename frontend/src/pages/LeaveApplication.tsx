import React, { useState, useEffect, useRef, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LeaveApproveConfirmBody } from "@/components/leaves/LeaveApproveConfirmBody";
import { LeaveRejectConfirmBody } from "@/components/leaves/LeaveRejectConfirmBody";
import {
  leaveConfirmModalBodyWrapClass,
  leaveConfirmModalButtonClass,
  leaveConfirmModalFooterClass,
  leaveConfirmModalPrimaryButtonClass,
  leaveConfirmModalShellClass,
} from "@/components/leaves/leaveConfirmModalStyles";
import {
  computeApprovalBalancePreview,
  consumedDaysForBalance,
  type LeaveApprovalBalancePreview,
} from "@/lib/leaveBalancePreview";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Progress } from "@/components/ui/progress";
import { format, parseISO, startOfDay } from "date-fns";
import { CalendarIcon, Upload, X, FileText, Send, Clock, Check, CheckCircle2, XCircle, Plus, CalendarDays, Edit, Download, Users, AlertTriangle } from "lucide-react";
import {
  leavesApi,
  hrApi,
  LeaveTypeDto,
  LeaveDto,
  type LeaveDurationType,
  type HalfDayPeriod,
  type EmployeeLeaveBalanceRowDto,
} from "@/lib/api";
import {
  DURATION_OPTIONS,
  normalizeHalfDayPeriodValue,
  isHalfDayLeaveDetail,
} from "@/lib/leaveDisplay";
import { LeaveRequestDetailBody } from "@/components/leaves/LeaveRequestDetailBody";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  findOverlappingLeaves,
  formatConflictSummaryLines,
} from "@/lib/leaveOverlap";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { AttendanceHubHeader } from "@/components/attendance/AttendanceHubHeader";
import { LeaveFilterDateRangePicker } from "@/components/leaves/LeaveFilterDateRangePicker";
import { LeaveRequestsFilterBar } from "@/components/leaves/LeaveRequestsFilterBar";
import { LeaveStatusFilterDropdown } from "@/components/leaves/LeaveStatusFilterDropdown";
import { LeaveTypeFilterDropdown } from "@/components/leaves/LeaveTypeFilterDropdown";
import { AttendanceClearFiltersButton } from "@/components/attendance/AttendanceClearFiltersButton";
import {
  LeaveScrollableTableCard,
  LEAVE_TABLE_HEAD_CLASS,
  LEAVE_TABLE_HEAD_ROW_CLASS,
} from "@/components/leaves/LeaveScrollableTableCard";

/** Stable accent per leave type (same type always matches the same palette slot). */
function balanceAccentIndex(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) || 0;
  }
  return Math.abs(h) % modulo;
}

const LEAVE_BALANCE_ACCENTS = [
  {
    shell:
      "border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-background to-background shadow-sm shadow-indigo-500/[0.07] dark:border-indigo-900/65 dark:from-indigo-950/45 dark:via-card dark:to-card",
    rail: "bg-gradient-to-b from-indigo-500 to-violet-600",
    progressTrack: "bg-indigo-100/95 dark:bg-indigo-950/55",
    progressIndicator: "bg-gradient-to-r from-indigo-500 to-violet-600",
    emphasis: "text-indigo-950 dark:text-indigo-100",
  },
  {
    shell:
      "border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-background to-background shadow-sm shadow-teal-500/[0.07] dark:border-teal-900/65 dark:from-teal-950/40 dark:via-card dark:to-card",
    rail: "bg-gradient-to-b from-teal-500 to-cyan-600",
    progressTrack: "bg-teal-100/95 dark:bg-teal-950/55",
    progressIndicator: "bg-gradient-to-r from-teal-500 to-cyan-600",
    emphasis: "text-teal-950 dark:text-teal-100",
  },
  {
    shell:
      "border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-background to-background shadow-sm shadow-sky-500/[0.07] dark:border-sky-900/65 dark:from-sky-950/40 dark:via-card dark:to-card",
    rail: "bg-gradient-to-b from-sky-500 to-blue-600",
    progressTrack: "bg-sky-100/95 dark:bg-sky-950/55",
    progressIndicator: "bg-gradient-to-r from-sky-500 to-blue-600",
    emphasis: "text-sky-950 dark:text-sky-100",
  },
  {
    shell:
      "border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-background to-background shadow-sm shadow-violet-500/[0.07] dark:border-violet-900/65 dark:from-violet-950/40 dark:via-card dark:to-card",
    rail: "bg-gradient-to-b from-violet-500 to-fuchsia-600",
    progressTrack: "bg-violet-100/95 dark:bg-violet-950/55",
    progressIndicator: "bg-gradient-to-r from-violet-500 to-fuchsia-600",
    emphasis: "text-violet-950 dark:text-violet-100",
  },
] as const;

const LeaveApplication = () => {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDto[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalanceRowDto[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveDto[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveDto[]>([]);
  const [isReportingManager, setIsReportingManager] = useState(false);
  const [activeTab, setActiveTab] = useState<"application" | "requests">("application");
  const [loading, setLoading] = useState(true);
  const [submitting, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveDto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // For team leaves approval/rejection
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [selectedTeamLeave, setSelectedTeamLeave] = useState<LeaveDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [leaveActionPreviewLoading, setLeaveActionPreviewLoading] = useState(false);
  const [leaveActionPreviewDays, setLeaveActionPreviewDays] = useState<number | undefined>();
  const [leaveActionPreviewBalance, setLeaveActionPreviewBalance] =
    useState<LeaveApprovalBalancePreview | null>(null);

  const [form, setForm] = useState({
    leaveTypeId: "",
    durationType: "single_day" as LeaveDurationType,
    halfDayPeriod: "" as "" | HalfDayPeriod,
    startDate: "",
    endDate: "",
    reason: "",
    attachmentFileName: "",
    attachmentData: "",
  });

  const [editForm, setEditForm] = useState({
    leaveTypeId: "",
    durationType: "single_day" as LeaveDurationType,
    halfDayPeriod: "" as "" | HalfDayPeriod,
    startDate: "",
    endDate: "",
    reason: "",
    attachmentFileName: "",
    attachmentData: "",
  });

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [filterLeaveType, setFilterLeaveType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTeamUser, setFilterTeamUser] = useState<string>("all");
  const [teamFilterUsers, setTeamFilterUsers] = useState<
    { id: string; name: string; email: string; phone: string }[]
  >([]);
  
  // Working days calculation
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [calculatingDays, setCalculatingDays] = useState(false);
  const [editCalculatedDays, setEditCalculatedDays] = useState<number | null>(null);
  const [calculatingEditDays, setCalculatingEditDays] = useState(false);

  /** Server may omit workingDays on list responses; cache from calculateDays. null = fetch failed */
  const [leaveDaysCache, setLeaveDaysCache] = useState<
    Record<string, number | null>
  >({});
  const [leaveDaysLoading, setLeaveDaysLoading] = useState(false);

  const getLeaveDayCount = (leave: LeaveDto) => {
    if (typeof leave.totalLeaveDays === "number") return leave.totalLeaveDays;
    if (typeof leave.workingDays === "number") return leave.workingDays;
    const cached = leaveDaysCache[leave.id];
    if (cached === null) return undefined;
    if (typeof cached === "number") return cached;
    return undefined;
  };

  /** Numeric day count for balance (handles string decimals from API + cached working days). */
  const getConsumedDaysForBalance = (leave: LeaveDto): number => {
    const raw = leave.totalLeaveDays ?? leave.workingDays;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const n = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (Number.isFinite(n)) return n;
    }
    const cached = leaveDaysCache[leave.id];
    if (typeof cached === "number" && Number.isFinite(cached)) return cached;
    return 0;
  };

  const formatDaysSummary = (n: number) =>
    n === 0.5 ? (
      <>
        <span className="font-medium">0.5</span>{" "}
        <span className="text-muted-foreground font-normal">day</span>
      </>
    ) : (
      <>
        <span className="font-medium">{n}</span>{" "}
        <span className="text-muted-foreground font-normal">
          {n === 1 ? "day" : "days"}
        </span>
      </>
    );

  useEffect(() => {
    if (!user?.id) return;
    loadData();
    checkIfReportingManager();
  }, [user?.id]);

  useEffect(() => {
    const merged = [...myLeaves, ...teamLeaves];
    const byId = new Map(merged.map((l) => [l.id, l]));
    const list = [...byId.values()];
    const need = list.filter((l) => {
      if (
        typeof l.totalLeaveDays === "number" ||
        typeof l.workingDays === "number"
      )
        return false;
      const c = leaveDaysCache[l.id];
      return c === undefined;
    });
    if (need.length === 0) {
      setLeaveDaysLoading(false);
      return;
    }

    let cancelled = false;
    setLeaveDaysLoading(true);
    void (async () => {
      const updates: Record<string, number | null> = {};
      await Promise.all(
        need.map(async (l) => {
          try {
            const r = await leavesApi.calculateDays(
              l.startDate,
              l.endDate,
              l.userId,
            );
            updates[l.id] = r.workingDays;
          } catch {
            updates[l.id] = null;
          }
        }),
      );
      if (!cancelled) {
        setLeaveDaysCache((prev) => ({ ...prev, ...updates }));
        setLeaveDaysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myLeaves, teamLeaves, leaveDaysCache]);

  useEffect(() => {
    if (activeTab === "requests" && isReportingManager) {
      loadTeamLeaves();
    }
  }, [activeTab, isReportingManager]);

  useEffect(() => {
    if (!isReportingManager || !user?.id) {
      setTeamFilterUsers([]);
      return;
    }
    hrApi
      .lookupEmployees()
      .then((list) => {
        const directReports = list
          .filter((employee) => employee.isActive && employee.hr?.reportingManagerId === user.id)
          .map((employee) => ({
            id: employee.id,
            name: employee.name,
            email: employee.email ?? "",
            phone: employee.phone ?? "",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setTeamFilterUsers(directReports);
      })
      .catch(() => setTeamFilterUsers([]));
  }, [isReportingManager, user?.id]);

  useEffect(() => {
    if (form.durationType === "multiple_day") {
      if (form.startDate && form.endDate) {
        calculateWorkingDays(
          form.startDate,
          form.endDate,
          setCalculatedDays,
          setCalculatingDays,
        );
      } else {
        setCalculatedDays(null);
      }
      return;
    }
    if (form.startDate) {
      calculateWorkingDays(
        form.startDate,
        form.startDate,
        setCalculatedDays,
        setCalculatingDays,
      );
    } else {
      setCalculatedDays(null);
    }
  }, [form.durationType, form.startDate, form.endDate, user?.id]);

  useEffect(() => {
    if (editForm.durationType === "multiple_day") {
      if (editForm.startDate && editForm.endDate) {
        calculateWorkingDays(
          editForm.startDate,
          editForm.endDate,
          setEditCalculatedDays,
          setCalculatingEditDays,
        );
      } else {
        setEditCalculatedDays(null);
      }
      return;
    }
    if (editForm.startDate) {
      calculateWorkingDays(
        editForm.startDate,
        editForm.startDate,
        setEditCalculatedDays,
        setCalculatingEditDays,
      );
    } else {
      setEditCalculatedDays(null);
    }
  }, [editForm.durationType, editForm.startDate, editForm.endDate, user?.id]);

  const calculateWorkingDays = async (
    startDate: string,
    endDate: string,
    setDays: (days: number | null) => void,
    setCalculating: (calculating: boolean) => void
  ) => {
    if (!startDate || !endDate) {
      setDays(null);
      return;
    }
    try {
      setCalculating(true);
      const result = await leavesApi.calculateDays(
        startDate,
        endDate,
        user?.id,
      );
      setDays(result.workingDays);
    } catch (error) {
      console.error("Failed to calculate working days:", error);
      setDays(null);
    } finally {
      setCalculating(false);
    }
  };

  const checkIfReportingManager = async () => {
    if (!user) return;
    try {
      const result = await leavesApi.isReportingManager();
      setIsReportingManager(result.isReportingManager);
    } catch (error) {
      setIsReportingManager(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [types, my, balancePayload] = await Promise.all([
        leavesApi.getTypes(),
        leavesApi.getMy(),
        user?.id
          ? leavesApi.getEmployeeBalances(user.id)
          : Promise.resolve({ userId: "", balances: [] }),
      ]);
      setLeaveTypes(types);
      setMyLeaves(my);
      setLeaveBalances(balancePayload.balances || []);
    } catch (error) {
      toast.error("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLeaves = async () => {
    try {
      setLoading(true);
      const data = await leavesApi.getTeam();
      setTeamLeaves(data);
    } catch (error) {
      toast.error("Failed to load team leave requests");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({
          ...prev,
          attachmentFileName: file.name,
          attachmentData: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({
          ...prev,
          attachmentFileName: file.name,
          attachmentData: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openDetailModal = async (leave: LeaveDto) => {
    try {
      const details = await leavesApi.getDetails(leave.id);
      let resolved: LeaveDto = { ...leave, ...details };
      const tld = resolved.totalLeaveDays;
      if (typeof tld === "number") {
        resolved = { ...resolved, workingDays: tld };
      }
      if (typeof resolved.workingDays !== "number") {
        const cached = leaveDaysCache[details.id];
        if (typeof cached === "number") {
          resolved = { ...resolved, workingDays: cached };
        } else if (details.startDate && details.endDate) {
          try {
            const { workingDays } = await leavesApi.calculateDays(
              details.startDate,
              details.endDate,
              details.userId,
            );
            resolved = { ...resolved, workingDays };
            setLeaveDaysCache((p) => ({
              ...p,
              [details.id]: workingDays,
            }));
          } catch {
            /* ignore */
          }
        }
      }
      setSelectedLeave(resolved);
      const halfNorm = normalizeHalfDayPeriodValue(resolved.halfDayPeriod);
      setEditForm({
        leaveTypeId: resolved.leaveTypeId,
        durationType: resolved.durationType ?? "single_day",
        halfDayPeriod:
          isHalfDayLeaveDetail(resolved) && halfNorm ? halfNorm : "",
        startDate: resolved.startDate,
        endDate: resolved.endDate,
        reason: resolved.reason,
        attachmentFileName: resolved.attachmentFileName || "",
        attachmentData: resolved.attachmentData || "",
      });
      setIsEditing(false);
      setDetailModalOpen(true);
    } catch (error) {
      toast.error("Failed to load leave details");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave || !editForm.leaveTypeId || !editForm.reason.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (editForm.durationType === "multiple_day") {
      if (!editForm.startDate || !editForm.endDate) {
        toast.error("Please select start and end dates");
        return;
      }
    } else if (!editForm.startDate) {
      toast.error("Please select a leave date");
      return;
    }
    if (editForm.durationType === "half_day" && !editForm.halfDayPeriod) {
      toast.error("Select first half or second half");
      return;
    }
    if (editFormOverlap.hasConflict) {
      toast.error(
        "You already applied for leave on one or more selected dates.",
      );
      return;
    }

    const endDate =
      editForm.durationType === "multiple_day"
        ? editForm.endDate
        : editForm.startDate;

    try {
      setSaving(true);
      await leavesApi.update(selectedLeave.id, {
        leaveTypeId: editForm.leaveTypeId,
        durationType: editForm.durationType,
        startDate: editForm.startDate,
        endDate,
        reason: editForm.reason.trim(),
        halfDayPeriod:
          editForm.durationType === "half_day"
            ? (editForm.halfDayPeriod as HalfDayPeriod)
            : null,
        attachmentFileName: editForm.attachmentFileName,
        attachmentData: editForm.attachmentData,
      });
      toast.success("Leave request updated successfully");
      setIsEditing(false);
      setDetailModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update leave request");
    } finally {
      setSaving(false);
    }
  };

  const resetLeaveActionPreview = () => {
    setLeaveActionPreviewLoading(false);
    setLeaveActionPreviewDays(undefined);
    setLeaveActionPreviewBalance(null);
  };

  const loadLeaveActionPreview = async (leave: LeaveDto) => {
    setLeaveActionPreviewLoading(true);
    setLeaveActionPreviewDays(undefined);
    setLeaveActionPreviewBalance(null);
    try {
      const [details, bal, userLeaves] = await Promise.all([
        leavesApi.getDetails(leave.id),
        leavesApi.getEmployeeBalances(leave.userId),
        leavesApi.getAll({ userIds: [leave.userId] }),
      ]);

      let resolved: LeaveDto = { ...leave, ...details };
      let requestedDays = consumedDaysForBalance(resolved);

      if (requestedDays <= 0) {
        if ((resolved.durationType || "").toLowerCase() === "half_day") {
          requestedDays = 0.5;
        } else {
          try {
            const r = await leavesApi.calculateDays(
              resolved.startDate,
              resolved.endDate,
              resolved.userId,
            );
            requestedDays = r.workingDays;
            resolved = { ...resolved, workingDays: r.workingDays };
          } catch {
            requestedDays = consumedDaysForBalance(resolved);
          }
        }
      }

      const balanceRow = bal.balances.find((b) => b.leaveTypeId === resolved.leaveTypeId);
      const preview = computeApprovalBalancePreview(
        balanceRow,
        userLeaves,
        resolved,
        requestedDays,
      );

      setSelectedTeamLeave(resolved);
      setLeaveActionPreviewDays(requestedDays);
      setLeaveActionPreviewBalance(preview);
    } catch {
      toast.error("Failed to load leave details");
      setSelectedTeamLeave(leave);
    } finally {
      setLeaveActionPreviewLoading(false);
    }
  };

  const openApproveTeamLeaveModal = (leave: LeaveDto) => {
    setSelectedLeaveId(leave.id);
    setSelectedTeamLeave(leave);
    setApproveModalOpen(true);
    void loadLeaveActionPreview(leave);
  };

  const openRejectTeamLeaveModal = (leave: LeaveDto) => {
    setSelectedLeaveId(leave.id);
    setSelectedTeamLeave(leave);
    setRejectionReason("");
    setRejectionModalOpen(true);
    void loadLeaveActionPreview(leave);
  };

  const handleApproveTeamLeave = async () => {
    if (!selectedLeaveId) return;
    try {
      setIsApproving(true);
      await leavesApi.approve(selectedLeaveId);
      toast.success("Leave request approved");
      setApproveModalOpen(false);
      setSelectedLeaveId(null);
      setSelectedTeamLeave(null);
      resetLeaveActionPreview();
      loadTeamLeaves();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve leave");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectTeamLeave = async () => {
    if (!selectedLeaveId || !rejectionReason.trim()) return;
    try {
      setIsRejecting(true);
      await leavesApi.reject(selectedLeaveId, rejectionReason);
      toast.success("Leave request rejected");
      setRejectionModalOpen(false);
      setRejectionReason("");
      setSelectedLeaveId(null);
      setSelectedTeamLeave(null);
      resetLeaveActionPreview();
      loadTeamLeaves();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject leave");
    } finally {
      setIsRejecting(false);
    }
  };

  const downloadAttachment = (leave: LeaveDto) => {
    if (!leave.attachmentData || !leave.attachmentFileName) return;
    const link = document.createElement("a");
    link.href = leave.attachmentData;
    link.download = leave.attachmentFileName;
    link.click();
  };

  const resetForm = () => {
    setForm({
      leaveTypeId: "",
      durationType: "single_day",
      halfDayPeriod: "",
      startDate: "",
      endDate: "",
      reason: "",
      attachmentFileName: "",
      attachmentData: "",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasNoLeaveBalance) {
      toast.error(
        "You have no leave balance allocated. Please contact your administrator.",
      );
      return;
    }
    if (!form.leaveTypeId || !form.reason.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.durationType === "multiple_day") {
      if (!form.startDate || !form.endDate) {
        toast.error("Please select start and end dates");
        return;
      }
    } else if (!form.startDate) {
      toast.error("Please select a leave date");
      return;
    }
    if (form.durationType === "half_day" && !form.halfDayPeriod) {
      toast.error("Select first half or second half");
      return;
    }
    if (applyFormOverlap.hasConflict) {
      toast.error(
        "You already applied for leave on one or more selected dates.",
      );
      return;
    }

    const endDate =
      form.durationType === "multiple_day" ? form.endDate : form.startDate;

    try {
      setSaving(true);
      await leavesApi.apply({
        leaveTypeId: form.leaveTypeId,
        durationType: form.durationType,
        startDate: form.startDate,
        endDate,
        reason: form.reason.trim(),
        ...(form.durationType === "half_day"
          ? { halfDayPeriod: form.halfDayPeriod as HalfDayPeriod }
          : {}),
        attachmentFileName: form.attachmentFileName,
        attachmentData: form.attachmentData,
      });
      toast.success("Leave application submitted successfully");
      resetForm();
      setModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application");
    } finally {
      setSaving(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    let filtered = [...myLeaves];

    // Filter by leave type
    if (filterLeaveType !== "all") {
      filtered = filtered.filter(leave => leave.leaveTypeId === filterLeaveType);
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(leave => leave.status === filterStatus);
    }

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(leave => {
        const leaveStartDate = startOfDay(parseISO(leave.startDate));
        const leaveEndDate = startOfDay(parseISO(leave.endDate));

        if (dateRange.from && dateRange.to) {
          const fromDate = startOfDay(dateRange.from);
          const toDate = startOfDay(dateRange.to);
          // Check if leave overlaps with the date range
          return (leaveStartDate >= fromDate && leaveStartDate <= toDate) ||
            (leaveEndDate >= fromDate && leaveEndDate <= toDate) ||
            (leaveStartDate <= fromDate && leaveEndDate >= toDate);
        } else if (dateRange.from) {
          const fromDate = startOfDay(dateRange.from);
          return leaveEndDate >= fromDate;
        } else if (dateRange.to) {
          const toDate = startOfDay(dateRange.to);
          return leaveStartDate <= toDate;
        }
        return true;
      });
    }

    return filtered;
  }, [myLeaves, filterLeaveType, filterStatus, dateRange]);

  // Filter team leaves - must be before early return to follow Rules of Hooks
  const teamUserFilterOptions = useMemo(() => {
    const byId = new Map(
      teamFilterUsers.map((member) => [member.id, member]),
    );
    for (const leave of teamLeaves) {
      if (leave.userId && !byId.has(leave.userId)) {
        byId.set(leave.userId, {
          id: leave.userId,
          name: leave.userName || "Unknown",
          email: "",
          phone: "",
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamFilterUsers, teamLeaves]);

  const filteredTeamLeaves = useMemo(() => {
    let filtered = [...teamLeaves];
    if (filterTeamUser !== "all") {
      filtered = filtered.filter((leave) => leave.userId === filterTeamUser);
    }
    if (filterLeaveType !== "all") {
      filtered = filtered.filter(leave => leave.leaveTypeId === filterLeaveType);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter(leave => leave.status === filterStatus);
    }
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(leave => {
        const leaveStartDate = startOfDay(parseISO(leave.startDate));
        const leaveEndDate = startOfDay(parseISO(leave.endDate));
        if (dateRange.from && dateRange.to) {
          const fromDate = startOfDay(dateRange.from);
          const toDate = startOfDay(dateRange.to);
          return (leaveStartDate >= fromDate && leaveStartDate <= toDate) ||
            (leaveEndDate >= fromDate && leaveEndDate <= toDate) ||
            (leaveStartDate <= fromDate && leaveEndDate >= toDate);
        } else if (dateRange.from) {
          const fromDate = startOfDay(dateRange.from);
          return leaveEndDate >= fromDate;
        } else if (dateRange.to) {
          const toDate = startOfDay(dateRange.to);
          return leaveStartDate <= toDate;
        }
        return true;
      });
    }
    return filtered;
  }, [teamLeaves, filterTeamUser, filterLeaveType, filterStatus, dateRange]);

  /** No allocated days for any leave type — user cannot submit new applications. */
  const hasNoLeaveBalance = useMemo(() => {
    if (leaveBalances.length === 0) return true;
    return !leaveBalances.some((b) => Number(b.balance) > 0);
  }, [leaveBalances]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLeaveDays = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  /** Days taken from quota for one leave (excludes additional portion). */
  const getDaysFromEntitlement = (l: LeaveDto) => {
    const days = getConsumedDaysForBalance(l);
    const add = Number(l.additionalLeaveDays) || 0;
    return Math.max(0, days - add);
  };

  /** Preview whether this application will be flagged as additional leave (matches server logic). */
  const applyFormAdditionalPreview = useMemo(() => {
    if (!form.leaveTypeId) return null;

    const balanceRow = leaveBalances.find(
      (b) => b.leaveTypeId === form.leaveTypeId,
    );
    /** HR credited days (same as backend _entitlement_for_leave_type). */
    const entitlement = Math.max(0, Number(balanceRow?.balance) || 0);

    const approvedForType = myLeaves.filter(
      (l) =>
        l.status === "approved" && l.leaveTypeId === form.leaveTypeId,
    );
    const usedFromEntitlement = approvedForType.reduce(
      (sum, l) => sum + getDaysFromEntitlement(l),
      0,
    );
    /** Approved additional only — pending additional does not affect balance until approved. */
    const addUsed = approvedForType.reduce(
      (sum, l) => sum + (Number(l.additionalLeaveDays) || 0),
      0,
    );
    /**
     * Mirror backend _effective_remaining_quota / _effective_balance_display:
     * remainingAfterNorm = max(0, B - norm_used); offset = min(that, add_used);
     * effective remaining = remainingAfterNorm - offset.
     * Do not use API remainingBalance here — it can be stale vs myLeaves; the
     * old fallback (B - norm only) missed the offset and understated additional.
     */
    const remainingAfterNorm = Math.max(0, entitlement - usedFromEntitlement);
    const offset = Math.min(remainingAfterNorm, addUsed);
    const remainingEffective = remainingAfterNorm - offset;

    let requested: number | null = null;

    if (form.durationType === "multiple_day") {
      if (!form.startDate || !form.endDate) return null;
      if (calculatingDays || calculatedDays === null) return null;
      requested = calculatedDays;
    } else if (form.durationType === "half_day") {
      if (!form.startDate || !form.halfDayPeriod) return null;
      if (calculatingDays || calculatedDays === null) return null;
      if (calculatedDays < 1) {
        return { kind: "invalid" as const, remaining: remainingEffective, entitlement };
      }
      requested = 0.5;
    } else {
      if (!form.startDate) return null;
      if (calculatingDays || calculatedDays === null) return null;
      if (calculatedDays < 1) {
        return { kind: "invalid" as const, remaining: remainingEffective, entitlement };
      }
      requested = 1;
    }

    const additional = Math.max(0, requested - remainingEffective);
    return {
      kind: "ready" as const,
      remaining: remainingEffective,
      entitlement,
      requested,
      additional,
    };
  }, [
    form.leaveTypeId,
    form.durationType,
    form.startDate,
    form.endDate,
    form.halfDayPeriod,
    calculatedDays,
    calculatingDays,
    leaveBalances,
    myLeaves,
    leaveDaysCache,
  ]);

  const applyFormRequestRange = useMemo(() => {
    if (form.durationType === "multiple_day") {
      if (!form.startDate || !form.endDate) return null;
      return { start: form.startDate, end: form.endDate };
    }
    if (!form.startDate) return null;
    return { start: form.startDate, end: form.startDate };
  }, [form.durationType, form.startDate, form.endDate]);

  const applyFormOverlap = useMemo(() => {
    if (!applyFormRequestRange) {
      return { hasConflict: false, overlaps: [] as LeaveDto[] };
    }
    const overlaps = findOverlappingLeaves(
      applyFormRequestRange.start,
      applyFormRequestRange.end,
      myLeaves,
    );
    return { hasConflict: overlaps.length > 0, overlaps };
  }, [applyFormRequestRange, myLeaves]);

  const editFormRequestRange = useMemo(() => {
    if (editForm.durationType === "multiple_day") {
      if (!editForm.startDate || !editForm.endDate) return null;
      return { start: editForm.startDate, end: editForm.endDate };
    }
    if (!editForm.startDate) return null;
    return { start: editForm.startDate, end: editForm.startDate };
  }, [editForm.durationType, editForm.startDate, editForm.endDate]);

  const editFormOverlap = useMemo(() => {
    if (!editFormRequestRange || !selectedLeave) {
      return { hasConflict: false, overlaps: [] as LeaveDto[] };
    }
    const overlaps = findOverlappingLeaves(
      editFormRequestRange.start,
      editFormRequestRange.end,
      myLeaves,
      { excludeLeaveId: selectedLeave.id },
    );
    return { hasConflict: overlaps.length > 0, overlaps };
  }, [editFormRequestRange, myLeaves, selectedLeave]);

  const leaveBalanceChips = useMemo(() => {
    if (leaveBalances.length === 0) return null;
    return leaveBalances.map((b) => {
      const total = Math.max(0, Number(b.balance) || 0);
      const approvedForType = myLeaves.filter(
        (l) =>
          l.status === "approved" && l.leaveTypeId === b.leaveTypeId,
      );
      const usedFromEntitlement = approvedForType.reduce(
        (sum, l) => sum + getDaysFromEntitlement(l),
        0,
      );
      const additionalApprovedOnly = approvedForType.reduce(
        (sum, l) => sum + (Number(l.additionalLeaveDays) || 0),
        0,
      );
      const useServerBalance =
        typeof b.remainingBalance === "number" &&
        typeof b.additionalOutstanding === "number";
      const remaining = useServerBalance
        ? Math.max(0, b.remainingBalance)
        : Math.max(0, total - usedFromEntitlement);
      /** Balance summary: approved additional only (matches server). */
      const additionalShow = useServerBalance
        ? Math.max(0, b.additionalOutstanding)
        : additionalApprovedOnly;
      const pct =
        total > 0
          ? Math.min(100, ((total - remaining) / total) * 100)
          : 0;
      const accent =
        LEAVE_BALANCE_ACCENTS[balanceAccentIndex(b.leaveTypeId, LEAVE_BALANCE_ACCENTS.length)];
      const tip = `${b.leaveTypeName}: ${formatLeaveDays(remaining)} left of ${formatLeaveDays(total)} credited${additionalShow > 0 ? ` · Additional ${formatLeaveDays(additionalShow)} day(s)` : ""}`;
      const depleted = remaining <= 0 && total > 0;

      return (
        <div
          key={b.leaveTypeId}
          role="group"
          aria-label={tip}
          title={tip}
          className={cn(
            "relative min-w-0 w-full overflow-hidden rounded-xl border px-2 py-1.5 ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:px-2.5 sm:py-2",
            accent.shell,
          )}
        >
          <div
            className={cn("absolute left-0 top-0 h-full w-0.5 rounded-l-xl sm:w-1", accent.rail)}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col gap-1.5 pl-1.5 sm:pl-2">
            <div className="flex min-w-0 items-center justify-between gap-1.5">
              <p className="truncate text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]">
                {b.leaveTypeName}
              </p>
              {depleted ? (
                <span className="shrink-0 rounded-full bg-slate-200/90 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Used
                </span>
              ) : null}
            </div>

            <Progress
              value={pct}
              className={cn("h-1.5 rounded-full", accent.progressTrack)}
              indicatorClassName={accent.progressIndicator}
            />

            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p
                  className={cn(
                    "text-[11px] font-semibold tabular-nums leading-tight sm:text-xs",
                    remaining > 0 ? accent.emphasis : "text-muted-foreground",
                  )}
                >
                  {formatLeaveDays(remaining)} left
                </p>
                <p className="text-[10px] tabular-nums leading-tight text-muted-foreground">
                  Credited {formatLeaveDays(total)} days
                </p>
              </div>
              {additionalShow > 0 ? (
                <div className="max-w-[55%] shrink-0 text-right">
                  <p className="text-[10px] font-semibold tabular-nums leading-tight text-amber-800 dark:text-amber-300">
                    +{formatLeaveDays(additionalShow)} add.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    });
  }, [leaveBalances, myLeaves, leaveDaysCache]);

  if (loading) {
    return (
      <Layout>
        <div className="-m-6 flex h-full min-h-0 flex-1 items-center justify-center bg-[#f8f9fb]">
          <Loader message="Loading leave data..." size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="-m-6 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        {isReportingManager ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "application" | "requests")}
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="shrink-0 px-4 pt-4 sm:px-5">
            <AttendanceHubHeader
              tabs={
                <TabsList className="h-9 gap-1 bg-transparent p-0">
                  <TabsTrigger
                    value="application"
                    className="h-9 rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Application
                  </TabsTrigger>
                  <TabsTrigger
                    value="requests"
                    className="h-9 rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Requests
                  </TabsTrigger>
                </TabsList>
              }
              toolbar={
                activeTab === "requests" ? (
                  <LeaveRequestsFilterBar
                    filterTeamUser={filterTeamUser}
                    onFilterTeamUserChange={setFilterTeamUser}
                    teamUsers={teamUserFilterOptions}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    filterLeaveType={filterLeaveType}
                    onFilterLeaveTypeChange={setFilterLeaveType}
                    leaveTypes={leaveTypes}
                    filterStatus={filterStatus}
                    onFilterStatusChange={setFilterStatus}
                    hasActiveFilters={
                      filterLeaveType !== "all" ||
                      filterStatus !== "all" ||
                      filterTeamUser !== "all" ||
                      Boolean(dateRange.from || dateRange.to)
                    }
                    onClearFilters={() => {
                      setDateRange({});
                      setFilterLeaveType("all");
                      setFilterStatus("all");
                      setFilterTeamUser("all");
                    }}
                  />
                ) : (
                  <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto scrollbar-thinner">
                    <LeaveFilterDateRangePicker
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
                    />

                    <LeaveTypeFilterDropdown
                      value={filterLeaveType}
                      onChange={setFilterLeaveType}
                      leaveTypes={leaveTypes}
                    />

                    <LeaveStatusFilterDropdown
                      value={filterStatus}
                      onChange={setFilterStatus}
                    />

                    {(filterLeaveType !== "all" ||
                      filterStatus !== "all" ||
                      dateRange.from ||
                      dateRange.to) && (
                      <AttendanceClearFiltersButton
                        onClick={() => {
                          setDateRange({});
                          setFilterLeaveType("all");
                          setFilterStatus("all");
                        }}
                      />
                    )}

                    <Button
                      onClick={() => setModalOpen(true)}
                      className="h-9 shrink-0 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Apply for Leave
                    </Button>
                  </div>
                )
              }
            />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-5 sm:pb-5">
            {activeTab === "application" ? (
        <LeaveScrollableTableCard
          className="h-full"
          top={
            leaveBalanceChips ? (
              <div className="shrink-0 border-b border-border/40 p-3 sm:p-4">
                <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {leaveBalanceChips}
                </div>
              </div>
            ) : undefined
          }
        >
            <Table>
              <TableHeader>
                <TableRow className={LEAVE_TABLE_HEAD_ROW_CLASS}>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Leave Type</TableHead>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Start Date</TableHead>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>End Date</TableHead>
                  <TableHead className={cn(LEAVE_TABLE_HEAD_CLASS, "w-[100px]")}>
                    Days
                  </TableHead>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Reason</TableHead>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Status</TableHead>
                  <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Applied On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-muted-foreground font-medium">
                          {myLeaves.length === 0
                            ? "No leave requests found"
                            : "No leave requests match your filters"}
                        </p>
                        {myLeaves.length === 0 ? (
                          <p className="text-sm text-muted-foreground/70">Click "Apply for Leave" to submit your first request</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves.map(leave => (
                    <TableRow 
                      key={leave.id} 
                      className="hover:bg-primary/5 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(leave)}
                    >
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-medium">
                            {leave.leaveTypeName}
                          </Badge>
                          {(Number(leave.additionalLeaveDays) || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400 text-xs font-medium"
                            >
                              Additional
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {format(parseISO(leave.startDate), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {format(parseISO(leave.endDate), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {(() => {
                          const n = getLeaveDayCount(leave);
                          if (n !== undefined) {
                            return <>{formatDaysSummary(n)}</>;
                          }
                          return leaveDaysLoading ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            "—"
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[250px] truncate" title={leave.reason}>
                          {leave.reason}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {leave.createdAt ? format(parseISO(leave.createdAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </LeaveScrollableTableCard>
            ) : null}

            {activeTab === "requests" ? (
              <LeaveScrollableTableCard
                className="h-full"
                loading={loading}
                loadingMessage="Loading team leave requests..."
                header={
                  <CardHeader className="shrink-0 border-b border-border/40 bg-gradient-to-r from-muted/30 to-transparent">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Team Leave Requests
                      <Badge variant="outline" className="ml-2 bg-primary/5 border-primary/20 text-primary">
                        {filteredTeamLeaves.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                }
              >
                    <Table>
                      <TableHeader>
                        <TableRow className={LEAVE_TABLE_HEAD_ROW_CLASS}>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Employee</TableHead>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Leave Type</TableHead>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Start Date</TableHead>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>End Date</TableHead>
                          <TableHead className={cn(LEAVE_TABLE_HEAD_CLASS, "w-[100px]")}>
                            Days
                          </TableHead>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Reason</TableHead>
                          <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Status</TableHead>
                          <TableHead className={cn(LEAVE_TABLE_HEAD_CLASS, "text-right")}>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTeamLeaves.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-16">
                              <div className="flex flex-col items-center gap-3">
                                <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
                                <p className="text-muted-foreground font-medium">
                                  {teamLeaves.length === 0
                                    ? "No leave requests from your team members"
                                    : "No leave requests match your filters"}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTeamLeaves.map((leave) => (
                            <TableRow key={leave.id} className="hover:bg-muted/30">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs">
                                    {leave.userName?.charAt(0).toUpperCase() || "?"}
                                  </div>
                                  <span className="font-medium">{leave.userName || "Unknown"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                                    {leave.leaveTypeName}
                                  </Badge>
                                  {(Number(leave.additionalLeaveDays) || 0) > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400 text-xs font-medium"
                                    >
                                      Additional
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{format(parseISO(leave.startDate), "MMM d, yyyy")}</TableCell>
                              <TableCell>{format(parseISO(leave.endDate), "MMM d, yyyy")}</TableCell>
                              <TableCell className="text-sm tabular-nums">
                                {(() => {
                                  const n = getLeaveDayCount(leave);
                                  if (n !== undefined) {
                                    return <>{formatDaysSummary(n)}</>;
                                  }
                                  return leaveDaysLoading ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "—"
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px] truncate" title={leave.reason}>
                                  {leave.reason}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(leave.status)}</TableCell>
                              <TableCell className="text-right">
                                {leave.status === "pending" && (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-9 px-3 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50/80 dark:hover:bg-green-950/30 border border-green-200/50 dark:border-green-800/30 hover:border-green-300 dark:hover:border-green-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                                      onClick={() => openApproveTeamLeaveModal(leave)}
                                      title="Approve Leave"
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                      Approve
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-9 px-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50/80 dark:hover:bg-red-950/30 border border-red-200/50 dark:border-red-800/30 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                                      onClick={() => openRejectTeamLeaveModal(leave)}
                                      title="Reject Leave"
                                    >
                                      <XCircle className="h-4 w-4 mr-1.5" />
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
              </LeaveScrollableTableCard>
            ) : null}
            </div>
          </Tabs>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
            {/* Filters and Add Button */}
            <div className="mb-4 flex shrink-0 flex-wrap items-center justify-end gap-2">
              <LeaveFilterDateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />

              <LeaveTypeFilterDropdown
                value={filterLeaveType}
                onChange={setFilterLeaveType}
                leaveTypes={leaveTypes}
              />

              <LeaveStatusFilterDropdown
                value={filterStatus}
                onChange={setFilterStatus}
              />

              {(filterLeaveType !== "all" ||
                filterStatus !== "all" ||
                dateRange.from ||
                dateRange.to) && (
                <AttendanceClearFiltersButton
                  onClick={() => {
                    setDateRange({});
                    setFilterLeaveType("all");
                    setFilterStatus("all");
                  }}
                />
              )}

              <Button
                onClick={() => setModalOpen(true)}
                className="h-9 shrink-0 rounded-lg bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Apply for Leave
              </Button>
            </div>

            <LeaveScrollableTableCard
              className="h-full"
              top={
                leaveBalanceChips ? (
                  <div className="shrink-0 border-b border-border/40 p-3 sm:p-4">
                    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {leaveBalanceChips}
                    </div>
                  </div>
                ) : undefined
              }
            >
                <Table>
                  <TableHeader>
                    <TableRow className={LEAVE_TABLE_HEAD_ROW_CLASS}>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Leave Type</TableHead>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Start Date</TableHead>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>End Date</TableHead>
                      <TableHead className={cn(LEAVE_TABLE_HEAD_CLASS, "w-[100px]")}>
                        Days
                      </TableHead>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Reason</TableHead>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Status</TableHead>
                      <TableHead className={LEAVE_TABLE_HEAD_CLASS}>Applied On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3">
                            <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
                            <p className="text-muted-foreground font-medium">
                              {myLeaves.length === 0
                                ? "No leave requests found"
                                : "No leave requests match your filters"}
                            </p>
                            {myLeaves.length === 0 ? (
                              <p className="text-sm text-muted-foreground/70">Click "Apply for Leave" to submit your first request</p>
                            ) : (
                              <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeaves.map(leave => (
                        <TableRow 
                          key={leave.id} 
                          className="hover:bg-primary/5 transition-colors cursor-pointer"
                          onClick={() => openDetailModal(leave)}
                        >
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-medium">
                                {leave.leaveTypeName}
                              </Badge>
                              {(Number(leave.additionalLeaveDays) || 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400 text-xs font-medium"
                                >
                                  Additional
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {format(parseISO(leave.startDate), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {format(parseISO(leave.endDate), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {(() => {
                              const n = getLeaveDayCount(leave);
                              if (n !== undefined) {
                                return <>{formatDaysSummary(n)}</>;
                              }
                              return leaveDaysLoading ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                "—"
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm max-w-[250px] truncate" title={leave.reason}>
                              {leave.reason}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {leave.createdAt ? format(parseISO(leave.createdAt), "MMM d, yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </LeaveScrollableTableCard>
          </div>
        )}
      </div>

      {/* Application Form Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 sm:w-full [&>button.absolute]:hidden border-border/60 shadow-xl">
          <DialogHeader className={cn(
            "p-6 pb-4 border-b sticky top-0 z-10 bg-gradient-to-r from-primary/5 to-transparent"
          )}>
            <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="block">Apply for leave</span>
                <span className="text-sm font-normal text-muted-foreground mt-0.5 block">
                  Fill in the details below. Dates are checked for overlaps automatically.
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {hasNoLeaveBalance && (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/5 text-foreground [&>svg]:text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No leave balance</AlertTitle>
                <AlertDescription className="text-destructive/90 dark:text-destructive/90">
                  You have no leave balance allocated. Please contact your administrator.
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 space-y-4 shadow-sm">
             
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Leave type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.leaveTypeId} onValueChange={v => setForm(p => ({ ...p, leaveTypeId: v }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/80 border-border/60">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Duration <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.durationType}
                    onValueChange={(v) => {
                      const dt = v as LeaveDurationType;
                      setForm((p) => {
                        if (dt === "single_day" || dt === "half_day") {
                          const d = p.startDate || p.endDate;
                          return {
                            ...p,
                            durationType: dt,
                            startDate: d,
                            endDate: d,
                            halfDayPeriod:
                              dt === "half_day" ? p.halfDayPeriod : "",
                          };
                        }
                        return { ...p, durationType: dt, halfDayPeriod: "" };
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-background/80 border-border/60">
                      <SelectValue placeholder="How long?" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.durationType === "half_day" && (
                <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-3 space-y-3">
                  <Label className="text-sm font-medium">
                    Session <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={form.halfDayPeriod || undefined}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        halfDayPeriod: v as HalfDayPeriod,
                      }))
                    }
                    className="flex flex-wrap gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="first_half" id="apply-first-half" />
                      <Label htmlFor="apply-first-half" className="font-normal cursor-pointer">
                        First half
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="second_half" id="apply-second-half" />
                      <Label htmlFor="apply-second-half" className="font-normal cursor-pointer">
                        Second half
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
                  {form.durationType === "multiple_day" ? (
                    <>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Date range <span className="text-destructive">*</span>
                      </Label>
                      <DateRangePicker
                        dateRange={{
                          from: form.startDate ? parseISO(form.startDate) : undefined,
                          to: form.endDate ? parseISO(form.endDate) : undefined,
                        }}
                        onSelect={(range) => {
                          setForm((p) => ({
                            ...p,
                            startDate: range.from ? format(range.from, "yyyy-MM-dd") : "",
                            endDate: range.to
                              ? format(range.to, "yyyy-MM-dd")
                              : range.from
                                ? format(range.from, "yyyy-MM-dd")
                                : "",
                          }));
                        }}
                        placeholder="Select start and end dates"
                        showQuickSelect={false}
                        className="w-full min-w-0 h-11 justify-start rounded-xl"
                      />
                    </>
                  ) : (
                    <>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full h-11 justify-start rounded-xl bg-background/80 border-border/60 font-normal",
                              !form.startDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            {form.startDate
                              ? format(parseISO(form.startDate), "MMMM d, yyyy")
                              : "Choose date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.startDate ? parseISO(form.startDate) : undefined}
                            onSelect={(d) => {
                              const s = d ? format(d, "yyyy-MM-dd") : "";
                              setForm((p) => ({
                                ...p,
                                startDate: s,
                                endDate: s,
                              }));
                              setStartDateOpen(false);
                            }}
                            captionLayout="dropdown"
                            fromYear={2020}
                            toYear={2030}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
                <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Attachment
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 min-w-0 rounded-xl border-dashed border-2 border-border/50 bg-muted/20 hover:bg-muted/40 justify-start px-3"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                      <span className="truncate text-sm text-left">
                        {form.attachmentFileName || "Select file…"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    {form.attachmentFileName && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setForm(p => ({ ...p, attachmentFileName: "", attachmentData: "" }))}
                        className="h-11 w-11 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {(form.durationType === "multiple_day"
              ? form.startDate && form.endDate
              : form.startDate) && (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Working-day total</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      {form.durationType === "multiple_day"
                        ? "Weekends and company holidays are excluded from this count."
                        : "The selected date must be a working day."}
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    {calculatingDays ? (
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Calculating…</span>
                      </div>
                    ) : calculatedDays !== null ? (
                      form.durationType === "multiple_day" ? (
                        <div>
                          <span className="text-3xl font-bold tabular-nums text-primary">
                            {calculatedDays}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">
                            {calculatedDays === 1 ? "day" : "days"}
                          </span>
                        </div>
                      ) : calculatedDays < 1 ? (
                        <p className="text-sm text-amber-600 dark:text-amber-500 max-w-[220px] sm:ml-auto">
                          This date is not a working day.
                        </p>
                      ) : form.durationType === "single_day" ? (
                        <div>
                          <span className="text-3xl font-bold tabular-nums text-primary">1</span>
                          <span className="text-sm text-muted-foreground ml-1">day</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-3xl font-bold tabular-nums text-primary">0.5</span>
                          <span className="text-sm text-muted-foreground ml-1">day</span>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>

                {applyFormOverlap.hasConflict && applyFormOverlap.overlaps.length > 0 && (
                  <Alert
                    className="border-amber-500/45 bg-amber-500/[0.12] dark:bg-amber-950/30 text-foreground [&>svg]:text-amber-600"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <div>
                      <AlertTitle className="text-amber-950 dark:text-amber-100 mb-1.5">
                        Selected dates overlap an existing request
                      </AlertTitle>
                      <AlertDescription className="text-amber-900/95 dark:text-amber-100/90 space-y-2">
                        <p>
                          You already applied for leave on one or more of these dates. Change your dates or resolve the existing request first.
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {formatConflictSummaryLines(applyFormOverlap.overlaps).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {applyFormAdditionalPreview?.kind === "ready" &&
                  applyFormAdditionalPreview.additional > 0 && (
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 space-y-1">
                      <p className="font-semibold">Additional leave</p>
                      <p className="text-amber-900/90 dark:text-amber-200/90 leading-snug">
                        This submission will count as additional leave:{" "}
                        <span className="font-semibold tabular-nums">
                          {formatLeaveDays(applyFormAdditionalPreview.additional)}
                        </span>{" "}
                        {applyFormAdditionalPreview.additional === 1
                          ? "day"
                          : "days"}{" "}
                        beyond your remaining quota (
                        {formatLeaveDays(applyFormAdditionalPreview.remaining)} left
                        of {formatLeaveDays(applyFormAdditionalPreview.entitlement)}{" "}
                        total).
                      </p>
                    </div>
                  )}
              </div>
            )}

            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 space-y-3 shadow-sm">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                Reason <span className="text-destructive">*</span>
              </Label>

              <Textarea
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Explain why you need to take leave..."
                className="min-h-[120px] rounded-xl bg-background/80 border-border/60 resize-none"
              />
            </div>

            <DialogFooter className="pt-2 gap-3 sm:gap-4 flex-col-reverse sm:flex-row sm:justify-end border-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                disabled={submitting}
                className="rounded-xl px-6 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  applyFormOverlap.hasConflict ||
                  hasNoLeaveBalance
                }
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-11 font-semibold shadow-md w-full sm:w-auto disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit application
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave Details Modal */}
      <Dialog open={detailModalOpen} onOpenChange={(open) => {
        setDetailModalOpen(open);
        if (!open) {
          setIsEditing(false);
          setSelectedLeave(null);
        }
      }}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 sm:w-full [&>button.absolute]:hidden">
          {selectedLeave && (
            <>
              <DialogHeader className={cn(
                "p-6 pb-4 border-b sticky top-0 z-10 bg-gradient-to-r from-primary/5 to-transparent"
              )}>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-2xl font-semibold flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <span>Leave Request Details</span>
                  </DialogTitle>
                  {selectedLeave.status === "pending" && !isEditing && (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="rounded-full"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      Leave Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={editForm.leaveTypeId} onValueChange={v => setEditForm(p => ({ ...p, leaveTypeId: v }))}>
                      <SelectTrigger className="h-11 bg-background/50 border-border/60">
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      Duration type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={editForm.durationType}
                      onValueChange={(v) => {
                        const dt = v as LeaveDurationType;
                        setEditForm((p) => {
                          if (dt === "single_day" || dt === "half_day") {
                            const d = p.startDate || p.endDate;
                            return {
                              ...p,
                              durationType: dt,
                              startDate: d,
                              endDate: d,
                              halfDayPeriod:
                                dt === "half_day" ? p.halfDayPeriod : "",
                            };
                          }
                          return { ...p, durationType: dt, halfDayPeriod: "" };
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 bg-background/50 border-border/60">
                        <SelectValue placeholder="How long is your leave?" />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.durationType === "half_day" && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
                      <Label className="text-sm font-semibold text-foreground">
                        Which half? <span className="text-destructive">*</span>
                      </Label>
                      <RadioGroup
                        value={editForm.halfDayPeriod || undefined}
                        onValueChange={(v) =>
                          setEditForm((p) => ({
                            ...p,
                            halfDayPeriod: v as HalfDayPeriod,
                          }))
                        }
                        className="flex flex-wrap gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="first_half" id="edit-first-half" />
                          <Label htmlFor="edit-first-half" className="font-normal cursor-pointer">
                            First half
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="second_half" id="edit-second-half" />
                          <Label htmlFor="edit-second-half" className="font-normal cursor-pointer">
                            Second half
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {editForm.durationType === "multiple_day" ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                        Date range <span className="text-destructive">*</span>
                      </Label>
                      <DateRangePicker
                        dateRange={{
                          from: editForm.startDate
                            ? parseISO(editForm.startDate)
                            : undefined,
                          to: editForm.endDate
                            ? parseISO(editForm.endDate)
                            : undefined,
                        }}
                        onSelect={(range) => {
                          setEditForm((p) => ({
                            ...p,
                            startDate: range.from
                              ? format(range.from, "yyyy-MM-dd")
                              : "",
                            endDate: range.to
                              ? format(range.to, "yyyy-MM-dd")
                              : range.from
                                ? format(range.from, "yyyy-MM-dd")
                                : "",
                          }));
                        }}
                        placeholder="Select start and end dates"
                        showQuickSelect={false}
                        className="w-full min-w-0 h-11 justify-start"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                        Leave date <span className="text-destructive">*</span>
                      </Label>
                      <Popover
                        open={editStartDateOpen}
                        onOpenChange={setEditStartDateOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-11 justify-start bg-background/50 border-border/60 font-normal",
                              !editForm.startDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editForm.startDate
                              ? format(parseISO(editForm.startDate), "MMMM d, yyyy")
                              : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              editForm.startDate
                                ? parseISO(editForm.startDate)
                                : undefined
                            }
                            onSelect={(d) => {
                              const s = d ? format(d, "yyyy-MM-dd") : "";
                              setEditForm((p) => ({
                                ...p,
                                startDate: s,
                                endDate: s,
                              }));
                              setEditStartDateOpen(false);
                            }}
                            captionLayout="dropdown"
                            fromYear={2020}
                            toYear={2030}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {(editForm.durationType === "multiple_day"
                    ? editForm.startDate && editForm.endDate
                    : editForm.startDate) && (
                    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Leave total</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {editForm.durationType === "multiple_day"
                              ? "Working days in range (weekends & holidays excluded)"
                              : "Must fall on a working day"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {calculatingEditDays ? (
                            <div className="flex items-center gap-2 justify-end">
                              <Loader className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Calculating...</span>
                            </div>
                          ) : editCalculatedDays !== null ? (
                            editForm.durationType === "multiple_day" ? (
                              <div>
                                <span className="text-2xl font-bold text-primary">
                                  {editCalculatedDays}
                                </span>
                                <span className="text-sm text-muted-foreground ml-1">
                                  {editCalculatedDays === 1 ? "day" : "days"}
                                </span>
                              </div>
                            ) : editCalculatedDays < 1 ? (
                              <p className="text-sm text-amber-600 dark:text-amber-500 max-w-[200px]">
                                This date is not a working day.
                              </p>
                            ) : editForm.durationType === "single_day" ? (
                              <div>
                                <span className="text-2xl font-bold text-primary">1</span>
                                <span className="text-sm text-muted-foreground ml-1">day</span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-2xl font-bold text-primary">0.5</span>
                                <span className="text-sm text-muted-foreground ml-1">day</span>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}

                  {editFormOverlap.hasConflict && editFormOverlap.overlaps.length > 0 && (
                    <Alert className="border-amber-500/45 bg-amber-500/[0.12] dark:bg-amber-950/30 text-foreground [&>svg]:text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        <AlertTitle className="text-amber-950 dark:text-amber-100 mb-1.5">
                          Selected dates overlap an existing request
                        </AlertTitle>
                        <AlertDescription className="text-amber-900/95 dark:text-amber-100/90 space-y-2">
                          <p>
                            You already applied for leave on one or more of these dates. Change your dates before saving.
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {formatConflictSummaryLines(editFormOverlap.overlaps).map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      Reason for Leave <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      value={editForm.reason}
                      onChange={e => setEditForm(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Explain why you need to take leave..."
                      className="min-h-[120px] bg-background/50 border-border/60 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground">Upload Attachment</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1 border-dashed border-2 border-border/60 bg-muted/30 hover:bg-muted/50 justify-start px-4"
                        onClick={() => editFileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {editForm.attachmentFileName || "Select file..."}
                        </span>
                      </Button>
                      <input
                        type="file"
                        ref={editFileInputRef}
                        className="hidden"
                        onChange={handleEditFileChange}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      {editForm.attachmentFileName && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditForm(p => ({ ...p, attachmentFileName: "", attachmentData: "" }))}
                          className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="pt-4 border-t gap-3 sticky bottom-0 bg-background z-10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={submitting}
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || editFormOverlap.hasConflict}
                      className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-11 font-semibold shadow-lg shadow-primary/20"
                    >
                      {submitting ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Update Request
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <LeaveRequestDetailBody
                  leave={selectedLeave}
                  getDayCount={getLeaveDayCount}
                  daysLoading={leaveDaysLoading}
                  variant="employee"
                  footer={
                    <DialogFooter className="pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setDetailModalOpen(false)}
                        className="w-full sm:w-auto px-6"
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  }
                />
              )}
            </>
          )}
        </DialogContent>
        </Dialog>

        {/* Approve Leave Confirmation Modal */}
        <Dialog
          open={approveModalOpen}
          onOpenChange={(open) => {
            setApproveModalOpen(open);
            if (!open) {
              setSelectedLeaveId(null);
              setSelectedTeamLeave(null);
              resetLeaveActionPreview();
            }
          }}
        >
          <DialogContent showClose={false} className={leaveConfirmModalShellClass}>
            <DialogTitle className="sr-only">Confirm Approval</DialogTitle>
            <div className={leaveConfirmModalBodyWrapClass}>
              {selectedTeamLeave ? (
                <LeaveApproveConfirmBody
                  leave={selectedTeamLeave}
                  loading={leaveActionPreviewLoading}
                  requestedDays={leaveActionPreviewDays}
                  balance={leaveActionPreviewBalance}
                />
              ) : null}
            </div>

            <div className={leaveConfirmModalFooterClass}>
              <Button
                variant="outline"
                onClick={() => setApproveModalOpen(false)}
                disabled={isApproving}
                className={leaveConfirmModalButtonClass}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveTeamLeave}
                disabled={isApproving || leaveActionPreviewLoading}
                className={cn(leaveConfirmModalPrimaryButtonClass, "bg-emerald-800 hover:bg-emerald-900")}
              >
                {isApproving ? (
                  <>
                    <Check className="mr-2 h-4 w-4 stroke-[3] opacity-80" />
                    <span className="animate-pulse">Approving…</span>
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4 stroke-[3]" />
                    Confirm Approval
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Leave Confirmation Modal */}
        <Dialog
          open={rejectionModalOpen}
          onOpenChange={(open) => {
            setRejectionModalOpen(open);
            if (!open) {
              setSelectedLeaveId(null);
              setSelectedTeamLeave(null);
              setRejectionReason("");
              resetLeaveActionPreview();
            }
          }}
        >
          <DialogContent showClose={false} className={leaveConfirmModalShellClass}>
            <DialogTitle className="sr-only">Confirm Rejection</DialogTitle>
            <div className={leaveConfirmModalBodyWrapClass}>
              {selectedTeamLeave ? (
                <LeaveRejectConfirmBody
                  leave={selectedTeamLeave}
                  loading={leaveActionPreviewLoading}
                  requestedDays={leaveActionPreviewDays}
                  balance={leaveActionPreviewBalance}
                  rejectionReason={rejectionReason}
                  onRejectionReasonChange={setRejectionReason}
                />
              ) : null}
            </div>

            <div className={leaveConfirmModalFooterClass}>
              <Button
                variant="outline"
                onClick={() => setRejectionModalOpen(false)}
                disabled={isRejecting}
                className={leaveConfirmModalButtonClass}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectTeamLeave}
                disabled={isRejecting || leaveActionPreviewLoading || !rejectionReason.trim()}
                className={cn(leaveConfirmModalPrimaryButtonClass, "bg-red-800 hover:bg-red-900")}
              >
                {isRejecting ? (
                  <>
                    <X className="mr-2 h-4 w-4 stroke-[3] opacity-80" />
                    <span className="animate-pulse">Rejecting…</span>
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4 stroke-[3]" />
                    Confirm Rejection
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  };

  export default LeaveApplication;
