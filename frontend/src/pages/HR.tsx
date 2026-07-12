import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Search,
  Users,
  Mail,
  Phone,
  Calendar,
  CalendarDays,
  UserCircle,
  CheckCircle2,
  XCircle,
  Settings2,
  BarChart3,
  Download,
  ChevronsUpDown,
  MapPin,
  Eye,
  LogIn,
  DoorOpen,
  CalendarIcon,
  FileText,
  Check,
  X,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { HrReportsPanel } from "@/components/hr/HrReportsPanel";
import { OfficeSettingsPanel } from "@/components/hr/OfficeSettingsPanel";
import { LeaveRequestDetailBody } from "@/components/leaves/LeaveRequestDetailBody";
import { LeaveApproveConfirmBody } from "@/components/leaves/LeaveApproveConfirmBody";
import { LeaveRejectConfirmBody } from "@/components/leaves/LeaveRejectConfirmBody";
import {
  leaveConfirmModalBodyWrapClass,
  leaveConfirmModalButtonClass,
  leaveConfirmModalFooterClass,
  leaveConfirmModalPrimaryButtonClass,
  leaveConfirmModalShellClass,
} from "@/components/leaves/leaveConfirmModalStyles";
import { Loader } from "@/components/ui/loader";
import { Progress } from "@/components/ui/progress";
import {
  hrApi,
  departmentsApi,
  designationsApi,
  leavesApi,
  shiftsApi,
  LeaveDto,
} from "@/lib/api";
import type {
  UserDto,
  HRInfoDto,
  DepartmentDto,
  DesignationDto,
  AttendanceDto,
  EmployeeLeaveBalanceRowDto,
  ShiftDto,
  HREmployeeListItemDto,
  HREmployeeLookupItemDto,
} from "@/lib/api";
import { useRbac } from "@/contexts/RbacContext";
import { cn } from "@/lib/utils";
import {
  computeApprovalBalancePreview,
  consumedDaysForBalance,
  type LeaveApprovalBalancePreview,
} from "@/lib/leaveBalancePreview";
import { format, startOfDay, differenceInDays, parseISO } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HrAttendancePanel } from "@/components/hr/HrAttendancePanel";
import { HREmployeeTableRow } from "@/components/hr/HREmployeeTableRow";

const EMPLOYEES_PER_PAGE = 25;

function applyEmployeeLookup(
  lookup: HREmployeeLookupItemDto[],
  setUsers: (users: UserDto[]) => void,
  setHrData: (data: Record<string, HRInfoDto>) => void,
) {
  setUsers(
    lookup.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: item.role,
      isActive: item.isActive,
      profilePicture: item.profilePicture ?? undefined,
    })),
  );
  const hrMap: Record<string, HRInfoDto> = {};
  for (const item of lookup) {
    if (!item.hr) continue;
    const h = item.hr;
    hrMap[item.id] = {
      id: h.id,
      userId: item.id,
      department: h.department,
      designation: h.designation,
      employeeType: h.employeeType,
      joiningDate: h.joiningDate ?? undefined,
      reportingManagerId: h.reportingManagerId,
      shiftId: h.shiftId,
      employeeId: h.employeeId,
      employmentHistory: [],
      emergencyContacts: [],
      academicCertifications: [],
    };
  }
  setHrData(hrMap);
}

export default function HR() {
  const { user } = useAuth();
  const { canAccessModule, loading: rbacLoading } = useRbac();
  const canAccessHr = canAccessModule("hr");
  const [users, setUsers] = useState<UserDto[]>([]);
  const [hrData, setHrData] = useState<Record<string, HRInfoDto>>({});
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [designations, setDesignations] = useState<DesignationDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterDesignation, setFilterDesignation] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [employees, setEmployees] = useState<HREmployeeListItemDto[]>([]);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [employeesTotal, setEmployeesTotal] = useState(0);
  const [employeesTotalPages, setEmployeesTotalPages] = useState(1);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "attendance";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Leave state
  const [leaves, setLeaves] = useState<LeaveDto[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveDto[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveDto[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [isReportingManager, setIsReportingManager] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveDto | null>(null);
  const [hrLeaveDetailOpen, setHrLeaveDetailOpen] = useState(false);
  const [hrLeaveDetail, setHrLeaveDetail] = useState<LeaveDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [leaveActionPreviewLoading, setLeaveActionPreviewLoading] = useState(false);
  const [leaveActionPreviewDays, setLeaveActionPreviewDays] = useState<number | undefined>();
  const [leaveActionPreviewBalance, setLeaveActionPreviewBalance] =
    useState<LeaveApprovalBalancePreview | null>(null);

  const [hrLeaveDaysCache, setHrLeaveDaysCache] = useState<
    Record<string, number | null>
  >({});
  const [hrLeaveDaysLoading, setHrLeaveDaysLoading] = useState(false);

  const [leaveDateRange, setLeaveDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});
  const [leaveUserFilterOpen, setLeaveUserFilterOpen] = useState(false);
  const [leaveFilterUserIds, setLeaveFilterUserIds] = useState<string[]>([]);
  const [leaveEmployeeSearch, setLeaveEmployeeSearch] = useState("");
  const [hrLeaveBalanceRows, setHrLeaveBalanceRows] = useState<
    EmployeeLeaveBalanceRowDto[]
  >([]);
  const [hrBalanceUserLeaves, setHrBalanceUserLeaves] = useState<LeaveDto[]>(
    [],
  );
  const [hrLeaveBalanceLoading, setHrLeaveBalanceLoading] = useState(false);

  const getHrLeaveDayCount = (leave: LeaveDto) => {
    if (typeof leave.totalLeaveDays === "number") return leave.totalLeaveDays;
    if (typeof leave.workingDays === "number") return leave.workingDays;
    const c = hrLeaveDaysCache[leave.id];
    if (c === null) return undefined;
    if (typeof c === "number") return c;
    return undefined;
  };

  const getHrConsumedDaysForBalance = useCallback(
    (leave: LeaveDto): number => {
      const raw = leave.totalLeaveDays ?? leave.workingDays;
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        const n = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (Number.isFinite(n)) return n;
      }
      const cached = hrLeaveDaysCache[leave.id];
      if (typeof cached === "number" && Number.isFinite(cached)) return cached;
      return 0;
    },
    [hrLeaveDaysCache],
  );

  const getHrDaysFromEntitlement = (leave: LeaveDto) => {
    const days = getHrConsumedDaysForBalance(leave);
    const add = Number(leave.additionalLeaveDays) || 0;
    return Math.max(0, days - add);
  };

  const formatHrLeaveDays = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);

  // Update activeTab when URL param changes
  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };


  useEffect(() => {
    if (rbacLoading || !canAccessHr) return;
    loadData();
  }, [rbacLoading, canAccessHr]);

  const checkIfReportingManager = async () => {
    try {
      const result = await leavesApi.isReportingManager();
      setIsReportingManager(result.isReportingManager);
    } catch (error) {
      // If error, user is not a reporting manager
      setIsReportingManager(false);
    }
  };

  const loadLeaves = useCallback(async () => {
    try {
      setLoadingLeaves(true);
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (leaveDateRange.from) {
        startDate = format(startOfDay(leaveDateRange.from), "yyyy-MM-dd");
        endDate = leaveDateRange.to
          ? format(startOfDay(leaveDateRange.to), "yyyy-MM-dd")
          : startDate;
      }
      const data = await leavesApi.getAll({
        startDate,
        endDate,
        userIds:
          leaveFilterUserIds.length > 0 ? leaveFilterUserIds : undefined,
      });
      setLeaves(data);
    } catch (error) {
      toast.error("Failed to load leave requests");
    } finally {
      setLoadingLeaves(false);
    }
  }, [leaveDateRange.from, leaveDateRange.to, leaveFilterUserIds]);

  const loadHrSingleUserBalance = useCallback(async () => {
    if (activeTab !== "leaves" || leaveFilterUserIds.length !== 1) {
      setHrLeaveBalanceRows([]);
      setHrBalanceUserLeaves([]);
      return;
    }
    const uid = leaveFilterUserIds[0];
    setHrLeaveBalanceLoading(true);
    try {
      const [bal, allLeaves] = await Promise.all([
        leavesApi.getEmployeeBalances(uid),
        leavesApi.getAll({ userIds: [uid] }),
      ]);
      setHrLeaveBalanceRows(bal.balances);
      setHrBalanceUserLeaves(allLeaves);
    } catch {
      toast.error("Failed to load employee leave balance");
      setHrLeaveBalanceRows([]);
      setHrBalanceUserLeaves([]);
    } finally {
      setHrLeaveBalanceLoading(false);
    }
  }, [activeTab, leaveFilterUserIds]);

  useEffect(() => {
    void loadHrSingleUserBalance();
  }, [loadHrSingleUserBalance]);

  useEffect(() => {
    if (activeTab === "leaves") {
      void loadLeaves();
    }
    if (user) {
      void checkIfReportingManager();
    }
  }, [activeTab, user, loadLeaves]);

  const filteredLeaveUserChoices = useMemo(() => {
    const q = leaveEmployeeSearch.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, leaveEmployeeSearch]);

  const leaveFilteredDaysTotal = useMemo((): number | "pending" | null => {
    if (leaveFilterUserIds.length === 0) return null;
    if (leaves.length === 0) return 0;

    let sum = 0;
    for (const leave of leaves) {
      let n: number | undefined;
      if (typeof leave.totalLeaveDays === "number") {
        n = leave.totalLeaveDays;
      } else if (typeof leave.workingDays === "number") {
        n = leave.workingDays;
      } else {
        const c = hrLeaveDaysCache[leave.id];
        if (typeof c === "number") n = c;
        else if (c === null) n = 0;
        else return "pending";
      }
      sum += n;
    }
    return sum;
  }, [leaves, hrLeaveDaysCache, leaveFilterUserIds]);

  const allLeavesForHrDayCache = useMemo(() => {
    const byId = new Map<string, LeaveDto>();
    for (const l of leaves) byId.set(l.id, l);
    for (const l of hrBalanceUserLeaves) byId.set(l.id, l);
    return [...byId.values()];
  }, [leaves, hrBalanceUserLeaves]);

  useEffect(() => {
    const need = allLeavesForHrDayCache.filter((l) => {
      if (
        typeof l.totalLeaveDays === "number" ||
        typeof l.workingDays === "number"
      )
        return false;
      const c = hrLeaveDaysCache[l.id];
      return c === undefined;
    });
    if (need.length === 0) {
      setHrLeaveDaysLoading(false);
      return;
    }

    let cancelled = false;
    setHrLeaveDaysLoading(true);
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
        setHrLeaveDaysCache((prev) => ({ ...prev, ...updates }));
        setHrLeaveDaysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allLeavesForHrDayCache, hrLeaveDaysCache]);

  const hrLeaveBalanceChips = useMemo(() => {
    if (leaveFilterUserIds.length !== 1) return null;
    if (hrLeaveBalanceRows.length === 0) return null;
    const uid = leaveFilterUserIds[0];
    return hrLeaveBalanceRows.map((b) => {
      const total = Math.max(0, Number(b.balance) || 0);
      const approvedForType = hrBalanceUserLeaves.filter(
        (l) =>
          l.userId === uid &&
          l.status === "approved" &&
          l.leaveTypeId === b.leaveTypeId,
      );
      const usedFromEntitlement = approvedForType.reduce(
        (sum, l) => sum + getHrDaysFromEntitlement(l),
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
      const additionalShow = useServerBalance
        ? Math.max(0, b.additionalOutstanding)
        : additionalApprovedOnly;
      const pct =
        total > 0
          ? Math.min(100, ((total - remaining) / total) * 100)
          : 0;
      return (
        <div
          key={b.leaveTypeId}
          className="min-w-0 w-full rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 sm:px-2.5"
          title={`${b.leaveTypeName}: ${formatHrLeaveDays(remaining)} left of ${formatHrLeaveDays(total)} credited${additionalShow > 0 ? ` · Additional ${formatHrLeaveDays(additionalShow)} day(s)` : ""}`}
        >
          <p className="text-[10px] font-medium truncate leading-tight">
            {b.leaveTypeName}
          </p>
          <Progress value={pct} className="h-1.5 mt-1.5" />
          <div className="mt-1 flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold tabular-nums text-foreground leading-tight">
                {formatHrLeaveDays(remaining)} left
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground leading-tight">
                Credited {formatHrLeaveDays(total)} days
              </p>
            </div>
            {additionalShow > 0 ? (
              <div className="shrink-0 text-right space-y-0.5 max-w-[55%]">
                <p className="text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400 leading-tight">
                  Additional {formatHrLeaveDays(additionalShow)}{" "}
                  {additionalShow === 1 ? "day" : "days"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      );
    });
  }, [
    leaveFilterUserIds,
    hrLeaveBalanceRows,
    hrBalanceUserLeaves,
    getHrConsumedDaysForBalance,
  ]);

  const loadTeamLeaves = async () => {
    try {
      setLoadingLeaves(true);
      const data = await leavesApi.getTeam();
      setTeamLeaves(data);
    } catch (error) {
      toast.error("Failed to load team leave requests");
    } finally {
      setLoadingLeaves(false);
    }
  };

  const loadMyLeaves = async () => {
    try {
      setLoadingLeaves(true);
      const data = await leavesApi.getMy();
      setMyLeaves(data);
    } catch (error) {
      toast.error("Failed to load my leave requests");
    } finally {
      setLoadingLeaves(false);
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

      const balanceRow = bal.balances.find(
        (b) => b.leaveTypeId === resolved.leaveTypeId,
      );
      const preview = computeApprovalBalancePreview(
        balanceRow,
        userLeaves,
        resolved,
        requestedDays,
      );

      setSelectedLeave(resolved);
      setLeaveActionPreviewDays(requestedDays);
      setLeaveActionPreviewBalance(preview);
    } catch {
      toast.error("Failed to load leave details");
      setSelectedLeave(leave);
    } finally {
      setLeaveActionPreviewLoading(false);
    }
  };

  const openApproveLeaveModal = (leave: LeaveDto) => {
    setSelectedLeaveId(leave.id);
    setSelectedLeave(leave);
    setApproveModalOpen(true);
    void loadLeaveActionPreview(leave);
  };

  const openRejectLeaveModal = (leave: LeaveDto) => {
    setSelectedLeaveId(leave.id);
    setSelectedLeave(leave);
    setRejectionReason("");
    setRejectionModalOpen(true);
    void loadLeaveActionPreview(leave);
  };

  const handleApproveLeave = async () => {
    if (!selectedLeaveId) return;
    const leaveId = selectedLeaveId;
    try {
      setIsApproving(true);
      await leavesApi.approve(leaveId);
      toast.success("Leave request approved");
      setApproveModalOpen(false);
      setSelectedLeaveId(null);
      setSelectedLeave(null);
      resetLeaveActionPreview();
      if (hrLeaveDetail?.id === leaveId) {
        setHrLeaveDetailOpen(false);
        setHrLeaveDetail(null);
      }
      loadLeaves();
      void loadHrSingleUserBalance();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve leave");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeaveId || !rejectionReason.trim()) return;
    const leaveId = selectedLeaveId;
    try {
      setIsRejecting(true);
      await leavesApi.reject(leaveId, rejectionReason);
      toast.success("Leave request rejected");
      setRejectionModalOpen(false);
      setRejectionReason("");
      setSelectedLeaveId(null);
      setSelectedLeave(null);
      resetLeaveActionPreview();
      if (hrLeaveDetail?.id === leaveId) {
        setHrLeaveDetailOpen(false);
        setHrLeaveDetail(null);
      }
      loadLeaves();
      void loadHrSingleUserBalance();
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

  const openHrLeaveDetail = async (leave: LeaveDto) => {
    try {
      const details = await leavesApi.getDetails(leave.id);
      let resolved: LeaveDto = { ...leave, ...details };
      const tld = resolved.totalLeaveDays;
      if (typeof tld === "number") {
        resolved = { ...resolved, workingDays: tld };
      }
      setHrLeaveDetail(resolved);
      setHrLeaveDetailOpen(true);
    } catch {
      toast.error("Failed to load leave details");
    }
  };

  const loadEmployeesPage = useCallback(
    async (page: number) => {
      setEmployeesLoading(true);
      try {
        const res = await hrApi.listEmployees({
          page,
          perPage: EMPLOYEES_PER_PAGE,
          search: debouncedSearch.trim() || undefined,
          department:
            filterDepartment !== "all" ? filterDepartment : undefined,
          designation:
            filterDesignation !== "all" ? filterDesignation : undefined,
          role: filterRole !== "all" ? filterRole : undefined,
        });
        setEmployees(res.items);
        setEmployeesTotal(res.total);
        setEmployeesTotalPages(res.totalPages);
        setEmployeesPage(res.page);
      } catch {
        toast.error("Failed to load employees");
      } finally {
        setEmployeesLoading(false);
      }
    },
    [debouncedSearch, filterDepartment, filterDesignation, filterRole],
  );

  const refreshUsersAndHr = useCallback(async () => {
    try {
      const lookup = await hrApi.lookupEmployees();
      applyEmployeeLookup(lookup, setUsers, setHrData);
      if (activeTab === "profiles") {
        await loadEmployeesPage(employeesPage);
      }
    } catch {
      toast.error("Failed to refresh employee data");
    }
  }, [activeTab, employeesPage, loadEmployeesPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lookup, deptList, desigList, shiftList] = await Promise.all([
        hrApi.lookupEmployees(),
        departmentsApi.list(),
        designationsApi.list(),
        shiftsApi.list().catch(() => [] as ShiftDto[]),
      ]);
      applyEmployeeLookup(lookup, setUsers, setHrData);
      setDepartments(deptList);
      setDesignations(desigList);
      setShifts(shiftList);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!loading && activeTab === "profiles") {
      void loadEmployeesPage(employeesPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load current page when opening Profiles tab
  }, [activeTab, loading]);

  useEffect(() => {
    if (!loading && activeTab === "profiles") {
      setEmployeesPage(1);
      void loadEmployeesPage(1);
    }
  }, [
    debouncedSearch,
    filterDepartment,
    filterDesignation,
    filterRole,
    loading,
    activeTab,
    loadEmployeesPage,
  ]);

  const goToEmployeesPage = (page: number) => {
    setEmployeesPage(page);
    void loadEmployeesPage(page);
  };

  if (rbacLoading || !canAccessHr) {
    return (
      <Layout>
        <div className="min-h-[60vh]" />
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader message="Loading HR data..." size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Tabs Section */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-3xl mb-6 grid-cols-5 h-auto p-1">
          <TabsTrigger
            value="attendance"
            className="flex items-center justify-center gap-2 px-2 py-2 data-[state=active]:shadow-sm"
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="truncate">Attendance</span>
          </TabsTrigger>

          <TabsTrigger
            value="leaves"
            className="flex items-center justify-center gap-2 px-2 py-2"
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">Leaves</span>
          </TabsTrigger>

          <TabsTrigger
            value="profiles"
            className="flex items-center justify-center gap-2 px-2 py-2"
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">Profiles</span>
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="flex items-center justify-center gap-2 px-2 py-2"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="truncate">Reports</span>
          </TabsTrigger>

          <TabsTrigger
            value="shifts"
            className="flex items-center justify-center gap-2 px-2 py-2"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Office Setup</span>
          </TabsTrigger>
        </TabsList>


        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <HrAttendancePanel users={users} hrData={hrData} shifts={shifts} />
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-6">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-border/40 flex flex-nowrap items-center justify-between gap-4 min-w-0 overflow-x-auto">
              <div className="flex flex-nowrap items-center gap-4 min-w-0">
                <div className="min-w-0 shrink-0 pr-2">
                  <h3 className="text-lg font-semibold leading-tight whitespace-nowrap">
                    Leave Requests
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-nowrap">
                    Manage employee leave applications
                  </p>
                </div>
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                <Popover
                  open={leaveUserFilterOpen}
                  onOpenChange={(open) => {
                    setLeaveUserFilterOpen(open);
                    if (!open) setLeaveEmployeeSearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={leaveUserFilterOpen}
                      className="w-[min(100%,220px)] h-9 justify-between bg-background/50 border-border/60"
                    >
                      {leaveFilterUserIds.length === 0
                        ? "All employees"
                        : leaveFilterUserIds.length === 1
                          ? users.find((u) => u.id === leaveFilterUserIds[0])
                              ?.name ?? "1 employee"
                          : `${leaveFilterUserIds.length} employees`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(90vw,280px)] p-0" align="start">
                    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                      <span className="text-sm font-medium">Filter by employee</span>
                      {leaveFilterUserIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setLeaveFilterUserIds([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search by name or email..."
                        value={leaveEmployeeSearch}
                        onChange={(e) => setLeaveEmployeeSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                      {filteredLeaveUserChoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-2 py-3 text-center">
                          No employees match
                        </p>
                      ) : (
                        filteredLeaveUserChoices.map((u) => (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={leaveFilterUserIds.includes(u.id)}
                              onCheckedChange={(checked) => {
                                setLeaveFilterUserIds((prev) =>
                                  checked === true
                                    ? prev.includes(u.id)
                                      ? prev
                                      : [...prev, u.id]
                                    : prev.filter((id) => id !== u.id),
                                );
                              }}
                            />
                            <span className="truncate">{u.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[min(100%,240px)] h-9 justify-start text-left font-normal bg-background/50 border-border/60",
                        !leaveDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {leaveDateRange.from
                        ? leaveDateRange.to
                          ? `${format(leaveDateRange.from, "MMM d, yyyy")} – ${format(leaveDateRange.to, "MMM d, yyyy")}`
                          : format(leaveDateRange.from, "MMM d, yyyy")
                        : "Date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={
                        leaveDateRange.from
                          ? {
                              from: leaveDateRange.from,
                              to: leaveDateRange.to,
                            }
                          : undefined
                      }
                      onSelect={(range) => {
                        setLeaveDateRange({
                          from: range?.from,
                          to: range?.to,
                        });
                      }}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2030}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {(leaveDateRange.from || leaveFilterUserIds.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setLeaveDateRange({});
                      setLeaveFilterUserIds([]);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-9"
                onClick={() => {
                  void loadLeaves();
                  void loadHrSingleUserBalance();
                }}
                disabled={loadingLeaves}
              >
                Refresh
              </Button>
            </div>

            {leaveFilterUserIds.length === 1 && (
              <div className="px-4 pb-4 border-b border-border/40 flex flex-col gap-2 min-w-0">
                {hrLeaveBalanceLoading ? (
                  <div
                    className="flex items-center justify-center py-3"
                    role="status"
                    aria-label="Loading balance"
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : hrLeaveBalanceChips ? (
                  <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {hrLeaveBalanceChips}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-1">
                    No leave balances configured for this employee.
                  </p>
                )}
              </div>
            )}

            {loadingLeaves ? (
              <div className="flex items-center justify-center py-12">
                <Loader message="Loading leave requests..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">
                        Employee ({leaves.length})
                      </TableHead>
                      <TableHead className="font-semibold">
                        Leave Type
                      </TableHead>
                      <TableHead className="font-semibold">
                        Start Date
                      </TableHead>
                      <TableHead className="font-semibold">End Date</TableHead>
                      <TableHead className="font-semibold w-[100px]">
                        {leaveFilterUserIds.length === 0 ? (
                          "Days"
                        ) : leaveFilteredDaysTotal === "pending" ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            Days
                            <Loader className="h-3.5 w-3.5 animate-spin shrink-0" />
                          </span>
                        ) : (
                          `Days(${
                            Number.isInteger(leaveFilteredDaysTotal)
                              ? leaveFilteredDaysTotal
                              : leaveFilteredDaysTotal
                                  .toFixed(1)
                                  .replace(/\.0$/, "")
                          })`
                        )}
                      </TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="font-semibold">
                        Attachment
                      </TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-12 text-muted-foreground"
                        >
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaves.map((leave) => (
                        <TableRow
                          key={leave.id}
                          className="cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => void openHrLeaveDetail(leave)}
                        >
                          <TableCell>
                            <div className="font-medium">{leave.userName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="bg-primary/5 border-primary/20 text-primary"
                              >
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
                            <span className="text-sm">
                              {format(parseISO(leave.startDate), "MMM d, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(parseISO(leave.endDate), "MMM d, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {(() => {
                              const n = getHrLeaveDayCount(leave);
                              if (n !== undefined) {
                                return (
                                  <span className="font-medium">
                                    {n === 0.5 ? (
                                      <>
                                        0.5{" "}
                                        <span className="text-muted-foreground font-normal">
                                          day
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        {n}{" "}
                                        <span className="text-muted-foreground font-normal">
                                          {n === 1 ? "day" : "days"}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                );
                              }
                              return hrLeaveDaysLoading ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                "—"
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div
                              className="text-sm max-w-[200px] truncate"
                              title={leave.reason}
                            >
                              {leave.reason}
                            </div>
                          </TableCell>
                          <TableCell
                            onClick={(e) => e.stopPropagation()}
                          >
                            {leave.attachmentFileName ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                onClick={async () => {
                                  try {
                                    const details = await leavesApi.getDetails(
                                      leave.id,
                                    );
                                    downloadAttachment(details);
                                  } catch (error) {
                                    toast.error(
                                      "Failed to download attachment",
                                    );
                                  }
                                }}
                              >
                                <Download className="h-3 w-3 mr-1.5" />
                                Download
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {leave.status === "pending" ? (
                              <Badge
                                variant="outline"
                                className="bg-orange-500/10 text-orange-600 border-orange-500/20"
                              >
                                Pending
                              </Badge>
                            ) : leave.status === "approved" ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-600 border-green-500/20"
                              >
                                Approved
                              </Badge>
                            ) : (
                              <div className="space-y-1">
                                <Badge
                                  variant="outline"
                                  className="bg-red-500/10 text-red-600 border-red-500/20"
                                >
                                  Rejected
                                </Badge>
                                {leave.rejectionReason && (
                                  <div className="text-[10px] text-muted-foreground italic max-w-[120px] truncate">
                                    {leave.rejectionReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {leave.status === "pending" && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-3 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50/80 dark:hover:bg-green-950/30 border border-green-200/50 dark:border-green-800/30 hover:border-green-300 dark:hover:border-green-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                                  onClick={() => openApproveLeaveModal(leave)}
                                  title="Approve Leave"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 px-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50/80 dark:hover:bg-red-950/30 border border-red-200/50 dark:border-red-800/30 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                                  onClick={() => openRejectLeaveModal(leave)}
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
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          {/* Filters Section */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, employee ID..."
                className="pl-9 h-10 bg-background/50 border-border/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={filterDepartment}
              onValueChange={setFilterDepartment}
            >
              <SelectTrigger className="w-[180px] h-10 bg-background/50 border-border/60">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments
                  .filter((d) => d.isActive)
                  .map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={filterDesignation}
              onValueChange={setFilterDesignation}
            >
              <SelectTrigger className="w-[180px] h-10 bg-background/50 border-border/60">
                <SelectValue placeholder="All Designations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                {designations
                  .filter((d) => d.isActive)
                  .map((desig) => (
                    <SelectItem key={desig.id} value={desig.name}>
                      {desig.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[140px] h-10 bg-background/50 border-border/60">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>

            {(filterDepartment !== "all" ||
              filterDesignation !== "all" ||
              filterRole !== "all" ||
              search) && (
              <button
                onClick={() => {
                  setFilterDepartment("all");
                  setFilterDesignation("all");
                  setFilterRole("all");
                  setSearch("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table Section */}
          {employeesLoading && employees.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader message="Loading employees..." size="md" />
            </div>
          ) : employeesTotal === 0 && !employeesLoading ? (
            <EmptyState
              icon={Users}
              title={
                search ||
                filterDepartment !== "all" ||
                filterDesignation !== "all" ||
                filterRole !== "all"
                  ? "No employees found"
                  : "No employees yet"
              }
              description={
                search ||
                filterDepartment !== "all" ||
                filterDesignation !== "all" ||
                filterRole !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Employee records will appear here once they are added to the system."
              }
            />
          ) : (
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="relative">
                {employeesLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">
                        Employee ({employeesTotal})
                      </TableHead>
                      <TableHead className="font-semibold">
                        Designation
                      </TableHead>
                      <TableHead className="font-semibold">
                        Joining Date
                      </TableHead>
                      <TableHead className="font-semibold">
                        Reporting Manager
                      </TableHead>
                      <TableHead className="font-semibold">
                        Employment Type
                      </TableHead>
                      <TableHead className="font-semibold">
                        Next Action
                      </TableHead>
                      <TableHead className="font-semibold">
                        Remaining Days
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <HREmployeeTableRow key={employee.id} employee={employee} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                <p className="text-sm text-muted-foreground">
                  Page {employeesPage} of {employeesTotalPages} · {employeesTotal} employees
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={employeesPage <= 1 || employeesLoading}
                    onClick={() => goToEmployeesPage(employeesPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      employeesPage >= employeesTotalPages || employeesLoading
                    }
                    onClick={() => goToEmployeesPage(employeesPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent
          value="reports"
          className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none"
        >
          <HrReportsPanel users={users} shifts={shifts} />
        </TabsContent>

        <TabsContent
          value="shifts"
          className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500 focus-visible:outline-none"
        >
          <OfficeSettingsPanel
            users={users}
            hrData={hrData}
            onHrDataRefresh={refreshUsersAndHr}
          />
        </TabsContent>
      </Tabs>


      {/* HR Leave request details (same layout as Leave Application page) */}
      <Dialog
        open={hrLeaveDetailOpen}
        onOpenChange={(open) => {
          setHrLeaveDetailOpen(open);
          if (!open) setHrLeaveDetail(null);
        }}
      >
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 sm:w-full [&>button.absolute]:hidden">
          {hrLeaveDetail && (
            <>
              <DialogHeader
                className={cn(
                  "p-6 pb-4 border-b sticky top-0 z-10 bg-gradient-to-r from-primary/5 to-transparent",
                )}
              >
                <DialogTitle className="text-2xl font-semibold flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span>Leave Request Details</span>
                </DialogTitle>
              </DialogHeader>
              <LeaveRequestDetailBody
                leave={hrLeaveDetail}
                getDayCount={getHrLeaveDayCount}
                daysLoading={hrLeaveDaysLoading}
                employeeName={hrLeaveDetail.userName}
                variant="admin"
                footer={
                  <DialogFooter className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setHrLeaveDetailOpen(false)}
                      className="w-full sm:w-auto px-6"
                    >
                      Close
                    </Button>
                  </DialogFooter>
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Approval Confirmation Modal */}
      <Dialog
        open={approveModalOpen}
        onOpenChange={(open) => {
          setApproveModalOpen(open);
          if (!open) {
            setSelectedLeaveId(null);
            setSelectedLeave(null);
            resetLeaveActionPreview();
          }
        }}
      >
        <DialogContent showClose={false} className={leaveConfirmModalShellClass}>
          <DialogTitle className="sr-only">Confirm Approval</DialogTitle>
          <div className={leaveConfirmModalBodyWrapClass}>
            {selectedLeave ? (
              <LeaveApproveConfirmBody
                leave={selectedLeave}
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
              onClick={handleApproveLeave}
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

      {/* Leave Rejection Confirmation Modal */}
      <Dialog
        open={rejectionModalOpen}
        onOpenChange={(open) => {
          setRejectionModalOpen(open);
          if (!open) {
            setSelectedLeaveId(null);
            setSelectedLeave(null);
            setRejectionReason("");
            resetLeaveActionPreview();
          }
        }}
      >
        <DialogContent showClose={false} className={leaveConfirmModalShellClass}>
          <DialogTitle className="sr-only">Confirm Rejection</DialogTitle>
          <div className={leaveConfirmModalBodyWrapClass}>
            {selectedLeave ? (
              <LeaveRejectConfirmBody
                leave={selectedLeave}
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
              onClick={handleRejectLeave}
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
}