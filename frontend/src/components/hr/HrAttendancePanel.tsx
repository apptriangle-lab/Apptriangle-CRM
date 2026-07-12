import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Mail,
  Calendar,
  Clock,
  Download,
  ChevronsUpDown,
  MapPin,
  LogIn,
  DoorOpen,
  CalendarIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { attendanceApi } from "@/lib/api";
import type { UserDto, HRInfoDto, AttendanceDto, ShiftDto } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import {
  getCurrentWorkWeekRange,
  getPreviousWorkWeekRange,
} from "@/lib/attendancePeriod";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ATTENDANCE_SHIFT_UNASSIGNED,
  userHasShiftAssigned,
} from "@/components/hr/hrAttendanceUtils";
import { AttendanceToolbarOutlineButton } from "@/components/attendance/AttendanceToolbarOutlineButton";
import { HrAttendanceTeamFilterBar } from "@/components/hr/HrAttendanceTeamFilterBar";
import { HrAttendanceTeamTable } from "@/components/hr/HrAttendanceTeamTable";
import { AttendanceStatusBadges } from "@/lib/attendanceStatusBadges";

export type HrAttendancePanelProps = {
  users: UserDto[];
  hrData: Record<string, HRInfoDto>;
  shifts: ShiftDto[];
  /** Extra section below the employee attendance table. */
  bottomSlot?: ReactNode;
  /** Bump to reload attendance from the API. */
  refreshToken?: number;
  /** Tighter toolbar/table spacing (e.g. embedded on Attendance → Team tab). */
  compactLayout?: boolean;
  /** Tabs or other leading content in the compact toolbar row (left side). */
  toolbarLeading?: ReactNode;
};

export function HrAttendancePanel({
  users,
  hrData,
  shifts,
  bottomSlot,
  refreshToken = 0,
  compactLayout = false,
  toolbarLeading,
}: HrAttendancePanelProps) {
  const [employeeAttendance, setEmployeeAttendance] = useState<
    Record<string, AttendanceDto>
  >({});
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDto[]>(
    [],
  );
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceDetailsModalOpen, setAttendanceDetailsModalOpen] =
    useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<{
    user: UserDto;
    attendance: AttendanceDto | null;
  } | null>(null);

  // Location name cache
  const [locationNames, setLocationNames] = useState<Record<string, string>>(
    {},
  );
  const [loadingLocations, setLoadingLocations] = useState<Set<string>>(
    new Set(),
  );

  // Attendance filters
  const [attendancePeriod, setAttendancePeriod] = useState<
    | "today"
    | "yesterday"
    | "week"
    | "last_week"
    | "month"
    | "last_month"
    | "year"
    | "last_year"
  >("today");
  const [attendanceDateRange, setAttendanceDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});
  const [filterAttendanceUser, setFilterAttendanceUser] = useState("all");
  const [filterAttendanceShift, setFilterAttendanceShift] = useState("all");
  const [employeeFilterOpen, setEmployeeFilterOpen] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const reverseGeocode = async (
    coordinates: string,
  ): Promise<string | null> => {
    if (!coordinates) return null;

    // Check cache first
    if (locationNames[coordinates]) {
      return locationNames[coordinates];
    }

    // Check if already loading
    if (loadingLocations.has(coordinates)) {
      return null;
    }

    try {
      setLoadingLocations((prev) => new Set(prev).add(coordinates));

      const coords = coordinates.split(",").map((c) => c.trim());
      if (coords.length !== 2) return null;

      const [lat, lng] = coords;
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "CRM-App/1.0", // Required by Nominatim
        },
      });

      if (!response.ok) return null;

      const data = await response.json();

      // Extract location name from response
      let locationName = coordinates; // Fallback to coordinates

      if (data.address) {
        // Try to get a meaningful address
        const addr = data.address;
        if (addr.road && addr.house_number) {
          locationName = `${addr.road} ${addr.house_number}`;
        } else if (addr.road) {
          locationName = addr.road;
        } else if (addr.suburb || addr.neighbourhood) {
          locationName = addr.suburb || addr.neighbourhood || "";
          if (addr.city || addr.town || addr.village) {
            locationName += `, ${addr.city || addr.town || addr.village}`;
          }
        } else if (addr.city || addr.town || addr.village) {
          locationName = addr.city || addr.town || addr.village || "";
        } else if (data.display_name) {
          // Use display name as fallback
          const parts = data.display_name.split(",");
          locationName = parts.slice(0, 2).join(", ").trim();
        }
      } else if (data.display_name) {
        const parts = data.display_name.split(",");
        locationName = parts.slice(0, 2).join(", ").trim();
      }

      // Cache the result
      setLocationNames((prev) => ({ ...prev, [coordinates]: locationName }));
      return locationName;
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      return null;
    } finally {
      setLoadingLocations((prev) => {
        const next = new Set(prev);
        next.delete(coordinates);
        return next;
      });
    }
  };

  // Load location names for all attendance records
  useEffect(() => {
    const loadLocationNames = async () => {
      const coordinatesToGeocode = new Set<string>();

      Object.values(employeeAttendance).forEach((attendance) => {
        if (
          attendance.checkInLocation &&
          !locationNames[attendance.checkInLocation]
        ) {
          coordinatesToGeocode.add(attendance.checkInLocation);
        }
        if (
          attendance.checkOutLocation &&
          !locationNames[attendance.checkOutLocation]
        ) {
          coordinatesToGeocode.add(attendance.checkOutLocation);
        }
      });

      // Geocode all unique coordinates (with delay to respect rate limits)
      const coordinatesArray = Array.from(coordinatesToGeocode);
      for (let i = 0; i < coordinatesArray.length; i++) {
        await reverseGeocode(coordinatesArray[i]);
        // Add delay to respect Nominatim rate limit (1 request per second)
        if (i < coordinatesArray.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
      }
    };

    if (Object.keys(employeeAttendance).length > 0) {
      loadLocationNames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeAttendance]);
  const attendanceEmployeeOptions = useMemo(() => {
    let list = users;
    if (filterAttendanceShift === ATTENDANCE_SHIFT_UNASSIGNED) {
      list = list.filter((u) => !userHasShiftAssigned(hrData[u.id]));
    } else if (filterAttendanceShift !== "all") {
      list = list.filter(
        (u) => (hrData[u.id]?.shiftId || "").trim() === filterAttendanceShift,
      );
    }
    const q = attendanceSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (hrData[u.id]?.employeeId && hrData[u.id]!.employeeId!.toLowerCase().includes(q)) ||
        (hrData[u.id]?.department && hrData[u.id]!.department!.toLowerCase().includes(q)) ||
        (hrData[u.id]?.designation && hrData[u.id]!.designation!.toLowerCase().includes(q)),
    );
  }, [users, hrData, filterAttendanceShift, attendanceSearch]);

  const employeeFilterUsers = useMemo(() => {
    let list = users;
    if (filterAttendanceShift === ATTENDANCE_SHIFT_UNASSIGNED) {
      list = list.filter((u) => !userHasShiftAssigned(hrData[u.id]));
    } else if (filterAttendanceShift !== "all") {
      list = list.filter(
        (u) => (hrData[u.id]?.shiftId || "").trim() === filterAttendanceShift,
      );
    }
    return list;
  }, [users, hrData, filterAttendanceShift]);

  const hasAttendanceFilters =
    filterAttendanceUser !== "all" ||
    filterAttendanceShift !== "all" ||
    attendanceSearch.trim() !== "" ||
    !!attendanceDateRange.from ||
    attendancePeriod !== "today";

  const clearAttendanceFilters = () => {
    setAttendanceDateRange({});
    setAttendancePeriod("today");
    setFilterAttendanceUser("all");
    setFilterAttendanceShift("all");
    setAttendanceSearch("");
  };

  const visibleAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      if (
        filterAttendanceUser !== "all" &&
        record.userId !== filterAttendanceUser
      ) {
        return false;
      }
      if (!users.some((u) => u.id === record.userId)) return false;
      const hr = hrData[record.userId];
      if (filterAttendanceShift === "all") return true;
      if (filterAttendanceShift === ATTENDANCE_SHIFT_UNASSIGNED) {
        return !userHasShiftAssigned(hr);
      }
      return (hr?.shiftId || "").trim() === filterAttendanceShift;
    });
  }, [
    attendanceRecords,
    filterAttendanceUser,
    filterAttendanceShift,
    users,
    hrData,
  ]);

  /** Rows shown in the table: period/user/shift filters + toolbar search (name, email, employee ID, etc.). */
  const displayedAttendanceRecords = useMemo(() => {
    const q = attendanceSearch.trim();
    if (!q) return visibleAttendanceRecords;
    const allowed = new Set(attendanceEmployeeOptions.map((u) => u.id));
    return visibleAttendanceRecords.filter((r) => allowed.has(r.userId));
  }, [
    visibleAttendanceRecords,
    attendanceEmployeeOptions,
    attendanceSearch,
  ]);

  const displayedAttendanceEmployeeCount = useMemo(() => {
    return new Set(displayedAttendanceRecords.map((r) => r.userId)).size;
  }, [displayedAttendanceRecords]);

  useEffect(() => {
    if (filterAttendanceUser === "all") return;
    const hr = hrData[filterAttendanceUser];
    if (filterAttendanceShift === "all") return;
    if (filterAttendanceShift === ATTENDANCE_SHIFT_UNASSIGNED) {
      if (userHasShiftAssigned(hr)) setFilterAttendanceUser("all");
      return;
    }
    if ((hr?.shiftId || "").trim() !== filterAttendanceShift) {
      setFilterAttendanceUser("all");
    }
  }, [filterAttendanceShift, filterAttendanceUser, hrData]);

  const getUserHRInfo = (userId: string) => hrData[userId];

  const teamPeriodSummary = useMemo(() => {
    const employees =
      filterAttendanceUser === "all"
        ? `${displayedAttendanceEmployeeCount} employees`
        : "1 employee";

    if (attendanceDateRange.from) {
      const from = format(attendanceDateRange.from, "MMM d, yyyy");
      if (attendanceDateRange.to) {
        return `${employees} · ${from} – ${format(attendanceDateRange.to, "MMM d, yyyy")}`;
      }
      return `${employees} · from ${from}`;
    }

    const labels: Record<string, string> = {
      today: "Today",
      yesterday: "Yesterday",
      week: "This week",
      last_week: "Last week",
      month: "This month",
      last_month: "Last month",
      year: "This year",
      last_year: "Last year",
    };
    return `${employees} · ${labels[attendancePeriod] ?? "Today"}`;
  }, [
    filterAttendanceUser,
    displayedAttendanceEmployeeCount,
    attendanceDateRange.from,
    attendanceDateRange.to,
    attendancePeriod,
  ]);

  const exportAttendanceReport = () => {
    try {
      // Same scope as the table: shift + search + optional single-employee filter
      let filteredUsersList = attendanceEmployeeOptions;
      if (filterAttendanceUser !== "all") {
        filteredUsersList = filteredUsersList.filter(
          (u) => u.id === filterAttendanceUser,
        );
      }

      // Create new PDF document
      const doc = new jsPDF();

      // Set up title and header
      let periodLabel = "Today";
      if (attendanceDateRange.from) {
        if (attendanceDateRange.to) {
          periodLabel = `${format(attendanceDateRange.from, "MMM d, yyyy")} – ${format(attendanceDateRange.to, "MMM d, yyyy")}`;
        } else {
          periodLabel = format(attendanceDateRange.from, "MMM d, yyyy");
        }
      } else {
        periodLabel =
          attendancePeriod === "today"
            ? "Today"
            : attendancePeriod === "yesterday"
              ? "Yesterday"
              : attendancePeriod === "week"
                ? "This Week"
                : attendancePeriod === "last_week"
                  ? "Last Week"
                  : attendancePeriod === "month"
                    ? "This Month"
                    : attendancePeriod === "last_month"
                      ? "Last Month"
                      : attendancePeriod === "year"
                        ? "This Year"
                        : attendancePeriod === "last_year"
                          ? "Last Year"
                          : "Today";
      }
      const dateStr = format(new Date(), "MMMM dd, yyyy");

      doc.setFontSize(18);
      doc.text("Employee Attendance Report", 14, 20);

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Period: ${periodLabel}`, 14, 30);
      doc.text(`Generated: ${dateStr}`, 14, 37);
      doc.text(`Total Employees: ${filteredUsersList.length}`, 14, 44);

      // Prepare table data
      const tableData = filteredUsersList.map((user) => {
        const attendance = employeeAttendance[user.id];

        const checkInTime = attendance?.checkInTime;
        const checkOutTime = attendance?.checkOutTime;

        // Format times
        const inTimeStr = checkInTime
          ? format(new Date(checkInTime), "hh:mm a")
          : "—";
        const outTimeStr = checkOutTime
          ? format(new Date(checkOutTime), "hh:mm a")
          : "—";

        // Get status from database (hardcoded when attendance was created)
        const dbStatus = attendance?.status || "absent";
        let status = "Absent";
        if (dbStatus === "late") {
          status = "Late";
        } else if (dbStatus === "present") {
          status = attendance?.reconciliationApproved ? "Present (Reconciled)" : "Present";
        } else {
          status = "Absent";
        }

        return [
          user.name || "—",
          user.email || "—",
          inTimeStr,
          outTimeStr,
          status,
        ];
      });

      // Add table using autoTable
      autoTable(doc, {
        head: [["Name", "Email", "In", "Out", "Status"]],
        body: tableData.map((row) => [
          row[0], // Name
          row[1], // Email
          row[2], // In
          row[3], // Out
          row[4], // Status
        ]),
        startY: 50,
        styles: {
          fontSize: 10,
          cellPadding: 3,
          overflow: "linebreak",
          cellWidth: "wrap",
        },
        headStyles: {
          fillColor: [59, 130, 246], // Blue color
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { cellWidth: 50 }, // Name
          1: { cellWidth: 60 }, // Email
          2: { cellWidth: 25 }, // In
          3: { cellWidth: 25 }, // Out
          4: { cellWidth: 30 }, // Status
        },
        margin: { top: 50, left: 10, right: 10 },
        tableWidth: "wrap",
      });

      // Generate filename
      let periodLabelFile = "Today";
      if (attendanceDateRange.from) {
        if (attendanceDateRange.to) {
          periodLabelFile = `${format(attendanceDateRange.from, "yyyy-MM-dd")}-to-${format(attendanceDateRange.to, "yyyy-MM-dd")}`;
        } else {
          periodLabelFile = format(attendanceDateRange.from, "yyyy-MM-dd");
        }
      } else {
        periodLabelFile =
          attendancePeriod === "today"
            ? "Today"
            : attendancePeriod === "yesterday"
              ? "Yesterday"
              : attendancePeriod === "week"
                ? "ThisWeek"
                : attendancePeriod === "last_week"
                  ? "LastWeek"
                  : attendancePeriod === "month"
                    ? "ThisMonth"
                    : attendancePeriod === "last_month"
                      ? "LastMonth"
                      : attendancePeriod === "year"
                        ? "ThisYear"
                        : attendancePeriod === "last_year"
                          ? "LastYear"
                          : "Today";
      }
      const dateStrFile = format(new Date(), "yyyy-MM-dd");
      const filename = `attendance-report-${periodLabelFile}-${dateStrFile}.pdf`;

      // Save PDF
      doc.save(filename);

      toast.success("Attendance report exported successfully");
    } catch (err) {
      console.error("Failed to export attendance report:", err);
      toast.error("Failed to export attendance report");
    }
  };

  const loadAttendanceData = async () => {
    setLoadingAttendance(true);
    try {
      const userId =
        filterAttendanceUser !== "all" ? filterAttendanceUser : undefined;

      // If date range is selected, fetch year data and filter by range
      // Otherwise, use period filter
      let records: AttendanceDto[];
      let periodStartDate: Date | null = null;
      let periodEndDate: Date | null = null;

      if (attendanceDateRange.from) {
        // Fetch year data to ensure we have enough records for the date range
        records = await attendanceApi.getAll("year", userId);

        // Filter by date range
        const fromDate = attendanceDateRange.from
          ? startOfDay(attendanceDateRange.from)
          : null;
        const toDate = attendanceDateRange.to
          ? startOfDay(attendanceDateRange.to)
          : null;
        periodStartDate = fromDate;
        periodEndDate = toDate;

        records = records.filter((record) => {
          if (!record.date) return false;
          const recordDate = startOfDay(new Date(record.date));

          if (fromDate && toDate) {
            return recordDate >= fromDate && recordDate <= toDate;
          } else if (fromDate) {
            return recordDate >= fromDate;
          }
          return false;
        });
      } else {
        // Use period filter (today/yesterday/week/last_week/month/last_month/year/last_year)
        // Calculate period dates for additional filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (attendancePeriod === "today") {
          periodStartDate = startOfDay(today);
          periodEndDate = startOfDay(today);
        } else if (attendancePeriod === "yesterday") {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          periodStartDate = startOfDay(yesterday);
          periodEndDate = startOfDay(yesterday);
        } else if (attendancePeriod === "week") {
          const { from, to } = getCurrentWorkWeekRange(today);
          periodStartDate = from;
          periodEndDate = to;
        } else if (attendancePeriod === "last_week") {
          const { from, to } = getPreviousWorkWeekRange(today);
          periodStartDate = from;
          periodEndDate = to;
        } else if (attendancePeriod === "month") {
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          periodStartDate = startOfDay(firstDay);
          periodEndDate = startOfDay(today);
        } else if (attendancePeriod === "last_month") {
          const lastMonth = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1,
          );
          const lastDayOfLastMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            0,
          );
          periodStartDate = startOfDay(lastMonth);
          periodEndDate = startOfDay(lastDayOfLastMonth);
        } else if (attendancePeriod === "year") {
          const firstDay = new Date(today.getFullYear(), 0, 1);
          periodStartDate = startOfDay(firstDay);
          periodEndDate = startOfDay(today);
        } else if (attendancePeriod === "last_year") {
          const firstDay = new Date(today.getFullYear() - 1, 0, 1);
          const lastDay = new Date(today.getFullYear() - 1, 11, 31);
          periodStartDate = startOfDay(firstDay);
          periodEndDate = startOfDay(lastDay);
        }

        records = await attendanceApi.getAll(attendancePeriod, userId);

        // Additional client-side filtering to ensure we only show records within the period
        if (periodStartDate && periodEndDate) {
          records = records.filter((record) => {
            if (!record.date) return false;
            const recordDate = startOfDay(new Date(record.date));
            return (
              recordDate >= periodStartDate! && recordDate <= periodEndDate!
            );
          });
        }
      }

      // Store all records for the period (to show multiple records per employee if they have attendance on multiple days)
      setAttendanceRecords(records);

      // Also maintain the map for backward compatibility (shows most recent per user)
      // This is used for single-day views or when we want to show one row per employee
      const attendanceMap: Record<string, AttendanceDto> = {};
      records.forEach((record) => {
        // Only store if we don't have a record for this user yet, or if this record is more recent
        if (
          !attendanceMap[record.userId] ||
          (record.date &&
            attendanceMap[record.userId].date &&
            new Date(record.date) >
              new Date(attendanceMap[record.userId].date!))
        ) {
          attendanceMap[record.userId] = record;
        }
      });

      setEmployeeAttendance(attendanceMap);
    } catch (err) {
      console.error("Failed to load attendance:", err);
      toast.error("Failed to load attendance data");
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (users.length === 0) return;
    void loadAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length, attendancePeriod, attendanceDateRange, filterAttendanceUser, refreshToken]);

  const attendanceTableSection = (
    <div className={cn(compactLayout && "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-3")}>
      {compactLayout ? (
        <HrAttendanceTeamFilterBar
          leadingSlot={toolbarLeading}
          search={attendanceSearch}
          onSearchChange={setAttendanceSearch}
          period={attendancePeriod}
          onPeriodChange={(v) => {
            setAttendancePeriod(v);
            setAttendanceDateRange({});
          }}
          periodDisabled={!!attendanceDateRange.from}
          shiftId={filterAttendanceShift}
          onShiftChange={setFilterAttendanceShift}
          shifts={shifts}
          employeeId={filterAttendanceUser}
          onEmployeeChange={setFilterAttendanceUser}
          employees={employeeFilterUsers}
          dateRange={attendanceDateRange}
          onDateRangeChange={(range) => {
            setAttendanceDateRange(range);
            if (range.from) setAttendancePeriod("today");
          }}
          onClearFilters={clearAttendanceFilters}
          hasActiveFilters={hasAttendanceFilters}
          onExport={exportAttendanceReport}
          exportDisabled={loadingAttendance}
        />
      ) : (
          <Card className="overflow-hidden border-border/40 bg-card/50 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Left side: Title, Search, Filters */}
              <div className="flex flex-wrap items-center flex-1 gap-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, employee ID..."
                    className="h-9 pl-9 text-[13px] shadow-sm border-border/60 bg-background/50"
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                  />
                </div>

                {/* Period Filter */}
                <Select
                  value={attendancePeriod}
                  onValueChange={(v) => {
                    setAttendancePeriod(
                      v as
                        | "today"
                        | "yesterday"
                        | "week"
                        | "last_week"
                        | "month"
                        | "last_month"
                        | "year"
                        | "last_year",
                    );
                    // Clear date range when period is selected
                    setAttendanceDateRange({});
                  }}
                  disabled={!!attendanceDateRange.from}
                >
                  <SelectTrigger className="w-[160px] h-9 bg-background/50 border-border/60">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="last_week">Last Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                  </SelectContent>
                </Select>

                {/* Shift filter */}
                <Select
                  value={filterAttendanceShift}
                  onValueChange={setFilterAttendanceShift}
                >
                  <SelectTrigger className="w-[180px] h-9 bg-background/50 border-border/60">
                    <SelectValue placeholder="Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All shifts</SelectItem>
                    <SelectItem value={ATTENDANCE_SHIFT_UNASSIGNED}>
                      No shift assigned
                    </SelectItem>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Employee Filter - Searchable */}
                <Popover
                  open={employeeFilterOpen}
                  onOpenChange={setEmployeeFilterOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeeFilterOpen}
                      className="w-[200px] h-9 bg-background/50 border-border/60 justify-between"
                    >
                      {filterAttendanceUser === "all"
                        ? "All Employees"
                        : users.find((user) => user.id === filterAttendanceUser)
                            ?.name || "Select employee..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search employee..." />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setFilterAttendanceUser("all");
                              setEmployeeFilterOpen(false);
                            }}
                          >
                            All Employees
                          </CommandItem>
                          {attendanceEmployeeOptions.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.name} ${user.email}`}
                              onSelect={() => {
                                setFilterAttendanceUser(user.id);
                                setEmployeeFilterOpen(false);
                              }}
                            >
                              {user.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Date Range Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] h-9 justify-start text-left font-normal bg-background/50 border-border/60",
                        !attendanceDateRange.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {attendanceDateRange.from
                        ? attendanceDateRange.to
                          ? `${format(attendanceDateRange.from, "MMM d")} – ${format(attendanceDateRange.to, "MMM d")}`
                          : format(attendanceDateRange.from, "MMM d")
                        : "Select date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={
                        attendanceDateRange.from
                          ? {
                              from: attendanceDateRange.from,
                              to: attendanceDateRange.to,
                            }
                          : undefined
                      }
                      onSelect={(range) => {
                        setAttendanceDateRange({
                          from: range?.from,
                          to: range?.to,
                        });
                        // Reset period to today when date range is selected
                        if (range?.from) {
                          setAttendancePeriod("today");
                        }
                      }}
                      numberOfMonths={2}
                      captionLayout="dropdown"
                      fromYear={2020}
                      toYear={2030}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear Filters Button (conditional) */}
                {hasAttendanceFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAttendanceFilters}
                    className="text-sm text-muted-foreground hover:text-foreground h-9"
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              {/* Right side: Export */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={exportAttendanceReport}
                  className="flex items-center gap-2 h-9"
                  disabled={loadingAttendance}
                >
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
              </div>
            </div>
          </Card>
      )}

          {compactLayout ? (
            <HrAttendanceTeamTable
              records={displayedAttendanceRecords}
              users={users}
              hrData={hrData}
              loading={loadingAttendance}
              locationNames={locationNames}
              recordCount={displayedAttendanceRecords.length}
              periodSummary={teamPeriodSummary}
              onRowClick={(user, attendance) => {
                setSelectedAttendance({ user, attendance });
                setAttendanceDetailsModalOpen(true);
              }}
            />
          ) : (
          <Card className="overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm">
            <div
              className={cn(
                "border-b border-border/40",
                compactLayout ? "px-3 py-2" : "p-4",
              )}
            >
              <h3
                className={cn(
                  "font-semibold",
                  compactLayout ? "text-base" : "text-lg",
                )}
              >
                Employee Attendance
              </h3>
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  compactLayout ? "mt-0.5" : "mt-1",
                )}
              >
                Showing {displayedAttendanceRecords.length} attendance record(s)
                for{" "}
                {filterAttendanceUser === "all"
                  ? displayedAttendanceEmployeeCount
                  : 1}{" "}
                employee(s)
                {attendanceDateRange.from ? (
                  <span>
                    {" "}
                    from {format(attendanceDateRange.from, "MMM d, yyyy")}
                    {attendanceDateRange.to &&
                      ` to ${format(attendanceDateRange.to, "MMM d, yyyy")}`}
                  </span>
                ) : (
                  <span>
                    {" "}
                    for{" "}
                    {attendancePeriod === "today"
                      ? "Today"
                      : attendancePeriod === "yesterday"
                        ? "Yesterday"
                        : attendancePeriod === "week"
                          ? "This Week"
                          : attendancePeriod === "last_week"
                            ? "Last Week"
                            : attendancePeriod === "month"
                              ? "This Month"
                              : attendancePeriod === "last_month"
                                ? "Last Month"
                                : attendancePeriod === "year"
                                  ? "This Year"
                                  : attendancePeriod === "last_year"
                                    ? "Last Year"
                                    : "Today"}
                  </span>
                )}
                {loadingAttendance && (
                  <span className="ml-2">(Loading...)</span>
                )}
              </p>
            </div>
            {loadingAttendance ? (
              <div className="flex items-center justify-center py-12">
                <Loader message="Loading attendance data..." />
              </div>
            ) : (
              <TooltipProvider delayDuration={150}>
                <div className={cn(compactLayout && "min-h-0 flex-1 overflow-auto scrollbar-table")}>
                  <Table>
                    <TableHeader>
                      <TableRow
                        className={cn(
                          "hover:bg-muted/30",
                          compactLayout
                            ? "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95"
                            : "bg-muted/30",
                        )}
                      >
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          Date
                        </TableHead>
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          Employee
                        </TableHead>
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          Department
                        </TableHead>
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          In Time
                        </TableHead>
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          Out Time
                        </TableHead>
                        <TableHead
                          className={cn(
                            "font-semibold",
                            compactLayout && "h-10 px-3",
                          )}
                        >
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedAttendanceRecords.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No attendance records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedAttendanceRecords.map((attendance) => {
                            const user = users.find(
                              (u) => u.id === attendance.userId,
                            );
                            if (!user) return null;

                            const hr = getUserHRInfo(user.id);
                            const initials = user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2);

                            const checkInTime = attendance?.checkInTime;
                            const checkOutTime = attendance?.checkOutTime;
                            const hasInTime = !!checkInTime;
                            const hasOutTime = !!checkOutTime;

                            // Format times for display
                            const inTimeStr = checkInTime
                              ? format(new Date(checkInTime), "hh:mm a")
                              : "";
                            const outTimeStr = checkOutTime
                              ? format(new Date(checkOutTime), "hh:mm a")
                              : "";

                            return (
                              <TableRow
                                key={`${attendance.userId}_${attendance.date}`}
                                className="hover:bg-primary/5 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedAttendance({
                                    user,
                                    attendance: attendance || null,
                                  });
                                  setAttendanceDetailsModalOpen(true);
                                }}
                              >
                                <TableCell>
                                  <span className="text-sm font-medium">
                                    {attendance.date
                                      ? format(
                                          new Date(attendance.date),
                                          "MMM d, yyyy",
                                        )
                                      : "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-sm text-primary">
                                      {initials}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-foreground">
                                        {user.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {user.email}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    {hr?.department || "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {hasInTime ? (
                                    <div className="space-y-1">
                                      {attendance?.checkInLocation ? (
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <div className="space-y-1 cursor-pointer">
                                              <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                                  <LogIn className="h-3.5 w-3.5 text-green-600" />
                                                </div>
                                                <span className="text-sm font-medium">
                                                  {inTimeStr}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1.5 pl-8">
                                                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">
                                                  {locationNames[
                                                    attendance.checkInLocation
                                                  ] ||
                                                    attendance.checkInLocation}
                                                </span>
                                              </div>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="right"
                                            sideOffset={6}
                                            align="start"
                                            className="p-0 border-0 bg-transparent shadow-none max-w-none z-[99999] pointer-events-auto"
                                            style={{ zIndex: 99999 }}
                                          >
                                            {(() => {
                                              const coords =
                                                attendance.checkInLocation
                                                  .split(",")
                                                  .map((c) => c.trim());
                                              if (coords.length === 2) {
                                                const [lat, lng] = coords;
                                                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lng) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`;
                                                return (
                                                  <div className="relative w-[360px] h-[280px] rounded-xl overflow-hidden border-2 border-primary/20 shadow-2xl bg-background">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none z-10" />
                                                    <div className="absolute top-2 left-2 z-20 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50 shadow-sm">
                                                      <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 text-green-600" />
                                                        <span className="text-xs font-medium text-foreground">
                                                          Check In Location
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <iframe
                                                      width="100%"
                                                      height="100%"
                                                      frameBorder="0"
                                                      scrolling="no"
                                                      marginHeight={0}
                                                      marginWidth={0}
                                                      src={mapUrl}
                                                      className="w-full h-full relative z-0"
                                                      title="Check In Location Map"
                                                      style={{ zIndex: 0 }}
                                                    />
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                              <LogIn className="h-3.5 w-3.5 text-green-600" />
                                            </div>
                                            <span className="text-sm font-medium">
                                              {inTimeStr}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {hasOutTime ? (
                                    <div className="space-y-1">
                                      {attendance?.checkOutLocation ? (
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <div className="space-y-1 cursor-pointer">
                                              <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                                                  <DoorOpen className="h-3.5 w-3.5 text-orange-600" />
                                                </div>
                                                <span className="text-sm font-medium">
                                                  {outTimeStr}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1.5 pl-8">
                                                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate">
                                                  {locationNames[
                                                    attendance.checkOutLocation
                                                  ] ||
                                                    attendance.checkOutLocation}
                                                </span>
                                              </div>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="right"
                                            sideOffset={6}
                                            align="start"
                                            className="p-0 border-0 bg-transparent shadow-none max-w-none z-[99999] pointer-events-auto"
                                            style={{ zIndex: 99999 }}
                                          >
                                            {(() => {
                                              const coords =
                                                attendance.checkOutLocation
                                                  .split(",")
                                                  .map((c) => c.trim());
                                              if (coords.length === 2) {
                                                const [lat, lng] = coords;
                                                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lng) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`;
                                                return (
                                                  <div className="relative w-[360px] h-[280px] rounded-xl overflow-hidden border-2 border-primary/20 shadow-2xl bg-background">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none z-10" />
                                                    <div className="absolute top-2 left-2 z-20 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50 shadow-sm">
                                                      <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 text-orange-600" />
                                                        <span className="text-xs font-medium text-foreground">
                                                          Check Out Location
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <iframe
                                                      width="100%"
                                                      height="100%"
                                                      frameBorder="0"
                                                      scrolling="no"
                                                      marginHeight={0}
                                                      marginWidth={0}
                                                      src={mapUrl}
                                                      className="w-full h-full relative z-0"
                                                      title="Check Out Location Map"
                                                      style={{ zIndex: 0 }}
                                                    />
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                                              <DoorOpen className="h-3.5 w-3.5 text-orange-600" />
                                            </div>
                                            <span className="text-sm font-medium">
                                              {outTimeStr}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <AttendanceStatusBadges row={attendance} />
                                </TableCell>
                              </TableRow>
                            );
                          })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </Card>
          )}
    </div>
  );

  return (
    <>
      {compactLayout ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {attendanceTableSection}
          {bottomSlot}
        </div>
      ) : (
        <>
          {attendanceTableSection}
          {bottomSlot}
        </>
      )}
      {/* Attendance Details Modal */}
      <Dialog
        open={attendanceDetailsModalOpen}
        onOpenChange={setAttendanceDetailsModalOpen}
      >
        <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-0 sm:p-0">
          <div className="relative overflow-hidden">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border/40 p-4 sm:p-6">
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-lg shadow-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Attendance Details
                    </span>
                  </DialogTitle>
                </div>
                {/* Employee Info Card */}
                {selectedAttendance && (
                  <Card className="bg-background/80 backdrop-blur-sm border-border/60 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-primary/30 shadow-lg shadow-primary/10 flex items-center justify-center font-bold text-lg sm:text-xl text-primary flex-shrink-0">
                          {selectedAttendance.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-lg sm:text-xl truncate mb-1">
                            {selectedAttendance.user.name}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground truncate flex items-center gap-1.5">
                            <Mail className="h-3 w-3" />
                            {selectedAttendance.user.email}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </DialogHeader>
            </div>
          </div>

          {selectedAttendance && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Attendance Details */}
              {selectedAttendance.attendance ? (
                <div className="space-y-4 sm:space-y-6">
                  {/* Date and Status Card */}
                  <Card className="bg-gradient-to-br from-background to-muted/20 border-border/60 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            Date
                          </Label>
                          <div className="text-base sm:text-lg font-bold">
                            {selectedAttendance.attendance.date
                              ? format(
                                  new Date(selectedAttendance.attendance.date),
                                  "MMMM dd, yyyy",
                                )
                              : "—"}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Status
                          </Label>
                          <div className="space-y-2">
                            <AttendanceStatusBadges
                              row={selectedAttendance.attendance}
                              className="gap-2"
                            />
                            {selectedAttendance.attendance.reconciliationRequestId ? (
                              <p className="text-xs text-muted-foreground font-mono">
                                Reconciliation id:{" "}
                                {selectedAttendance.attendance.reconciliationRequestId}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Time Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Check In Card */}
                    <Card className="bg-gradient-to-br from-green-50/50 to-green-50/20 dark:from-green-950/20 dark:to-green-950/10 border-green-200/60 dark:border-green-800/40 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-5">
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <LogIn className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            Check In
                          </Label>
                          {selectedAttendance.attendance.checkInTime ? (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 border-2 border-green-500/30 shadow-lg shadow-green-500/10 flex items-center justify-center flex-shrink-0">
                                <LogIn className="h-6 w-6 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <div className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400 font-mono">
                                  {format(
                                    new Date(
                                      selectedAttendance.attendance.checkInTime,
                                    ),
                                    "hh:mm",
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                  {format(
                                    new Date(
                                      selectedAttendance.attendance.checkInTime,
                                    ),
                                    "a",
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              —
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Check Out Card */}
                    <Card className="bg-gradient-to-br from-orange-50/50 to-orange-50/20 dark:from-orange-950/20 dark:to-orange-950/10 border-orange-200/60 dark:border-orange-800/40 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-5">
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <DoorOpen className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            Check Out
                          </Label>
                          {selectedAttendance.attendance.checkOutTime ? (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 border-2 border-orange-500/30 shadow-lg shadow-orange-500/10 flex items-center justify-center flex-shrink-0">
                                <DoorOpen className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div>
                                <div className="text-2xl sm:text-3xl font-bold text-orange-700 dark:text-orange-400 font-mono">
                                  {format(
                                    new Date(
                                      selectedAttendance.attendance
                                        .checkOutTime,
                                    ),
                                    "hh:mm",
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                  {format(
                                    new Date(
                                      selectedAttendance.attendance
                                        .checkOutTime,
                                    ),
                                    "a",
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              —
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Location Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <h4 className="font-bold text-sm sm:text-base">
                        Location Information
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Check In Location Card */}
                      {selectedAttendance.attendance.checkInLocation ? (
                        <Card className="bg-gradient-to-br from-blue-50/50 to-blue-50/20 dark:from-blue-950/20 dark:to-blue-950/10 border-blue-200/60 dark:border-blue-800/40 shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4 sm:p-5 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <LogIn className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              Check In Location
                            </Label>
                            <div className="flex items-start gap-2.5">
                              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                              <span
                                className="text-sm font-medium break-words min-w-0 flex-1"
                                title={
                                  selectedAttendance.attendance.checkInLocation
                                }
                              >
                                {locationNames[
                                  selectedAttendance.attendance.checkInLocation
                                ] ||
                                  selectedAttendance.attendance.checkInLocation}
                              </span>
                            </div>
                            {(() => {
                              const coords =
                                selectedAttendance.attendance.checkInLocation
                                  .split(",")
                                  .map((c) => c.trim());
                              if (coords.length === 2) {
                                const [lat, lng] = coords;
                                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lng) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`;
                                return (
                                  <div className="w-full h-40 sm:h-48 rounded-xl overflow-hidden border-2 border-blue-200/60 dark:border-blue-800/40 shadow-inner">
                                    <iframe
                                      width="100%"
                                      height="100%"
                                      frameBorder="0"
                                      scrolling="no"
                                      marginHeight={0}
                                      marginWidth={0}
                                      src={mapUrl}
                                      className="w-full h-full"
                                      title="Check In Location Map"
                                    />
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </CardContent>
                        </Card>
                      ) : null}

                      {/* Check Out Location Card */}
                      {selectedAttendance.attendance.checkOutLocation ? (
                        <Card className="bg-gradient-to-br from-purple-50/50 to-purple-50/20 dark:from-purple-950/20 dark:to-purple-950/10 border-purple-200/60 dark:border-purple-800/40 shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4 sm:p-5 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <DoorOpen className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              Check Out Location
                            </Label>
                            <div className="flex items-start gap-2.5">
                              <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                              <span
                                className="text-sm font-medium break-words min-w-0 flex-1"
                                title={
                                  selectedAttendance.attendance.checkOutLocation
                                }
                              >
                                {locationNames[
                                  selectedAttendance.attendance.checkOutLocation
                                ] ||
                                  selectedAttendance.attendance
                                    .checkOutLocation}
                              </span>
                            </div>
                            {(() => {
                              const coords =
                                selectedAttendance.attendance.checkOutLocation
                                  .split(",")
                                  .map((c) => c.trim());
                              if (coords.length === 2) {
                                const [lat, lng] = coords;
                                const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lng) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`;
                                return (
                                  <div className="w-full h-40 sm:h-48 rounded-xl overflow-hidden border-2 border-purple-200/60 dark:border-purple-800/40 shadow-inner">
                                    <iframe
                                      width="100%"
                                      height="100%"
                                      frameBorder="0"
                                      scrolling="no"
                                      marginHeight={0}
                                      marginWidth={0}
                                      src={mapUrl}
                                      className="w-full h-full"
                                      title="Check Out Location Map"
                                    />
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>

                    {!selectedAttendance.attendance.checkInLocation &&
                      !selectedAttendance.attendance.checkOutLocation && (
                        <Card className="bg-muted/30 border-dashed">
                          <CardContent className="p-8 text-center">
                            <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                            <div className="text-sm text-muted-foreground">
                              No location information available
                            </div>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                </div>
              ) : (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <div className="text-base font-medium text-muted-foreground">
                      No attendance record found for this date.
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-2 sm:gap-3 pt-4 border-t border-border/40">
                <AttendanceToolbarOutlineButton
                  onClick={() => setAttendanceDetailsModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Close
                </AttendanceToolbarOutlineButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
