import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import {
  CalendarDays,
  Clock,
  Settings2,
  Plus,
  Search,
  Check,
  Trash2,
  FileText,
} from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, isSameDay } from "date-fns";
import {
  leavesApi,
  shiftsApi,
  type UserDto,
  type HRInfoDto,
  type ShiftDto,
  type HolidayDto,
} from "@/lib/api";

const WEEKDAY_CHIPS = [
  { day: 0, name: "Mon" },
  { day: 1, name: "Tue" },
  { day: 2, name: "Wed" },
  { day: 3, name: "Thu" },
  { day: 4, name: "Fri" },
  { day: 5, name: "Sat" },
  { day: 6, name: "Sun" },
] as const;

function formatHolidayRange(h: HolidayDto): string {
  const s = h.startDate || h.date;
  const e = h.endDate || h.date;
  if (!s) return "—";
  const ds = parseISO(s);
  const de = parseISO(e || s);
  if (isSameDay(ds, de)) return format(ds, "MMM d, yyyy");
  return `${format(ds, "MMM d")} – ${format(de, "MMM d, yyyy")}`;
}

export interface OfficeSettingsPanelProps {
  users: UserDto[];
  hrData: Record<string, HRInfoDto>;
  onHrDataRefresh: () => Promise<void>;
}

function formatTime12h(timeStr: string) {
  if (!timeStr) return "";
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch {
    return timeStr;
  }
}

export function OfficeSettingsPanel({
  users,
  hrData,
  onHrDataRefresh,
}: OfficeSettingsPanelProps) {
  const [officeSubTab, setOfficeSubTab] = useState<"holidays" | "shifts">(
    "shifts",
  );

  const [holidays, setHolidays] = useState<HolidayDto[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayStartDate, setNewHolidayStartDate] = useState("");
  const [newHolidayEndDate, setNewHolidayEndDate] = useState("");
  const [editingHoliday, setEditingHoliday] = useState<HolidayDto | null>(null);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [holidayDeleteConfirmOpen, setHolidayDeleteConfirmOpen] =
    useState(false);
  const [isDeletingHoliday, setIsDeletingHoliday] = useState(false);

  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [shiftEditorMode, setShiftEditorMode] = useState<"idle" | "create" | "edit">(
    "idle",
  );
  const [editingShift, setEditingShift] = useState<ShiftDto | null>(null);
  const [shiftName, setShiftName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("09:00");
  const [shiftEndTime, setShiftEndTime] = useState("18:00");
  const [shiftWeekendDays, setShiftWeekendDays] = useState<number[]>([5, 6]);
  const [shiftGracePeriod, setShiftGracePeriod] = useState(0);
  const [shiftEmployeeIds, setShiftEmployeeIds] = useState<string[]>([]);
  const [shiftEmployeeSearch, setShiftEmployeeSearch] = useState("");
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [shiftDeleteConfirmOpen, setShiftDeleteConfirmOpen] = useState(false);
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  const loadHolidays = useCallback(async () => {
    try {
      setLoadingHolidays(true);
      const holidaysData = await leavesApi.getHolidays();
      setHolidays(holidaysData);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load holidays");
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  const loadShifts = useCallback(async () => {
    try {
      setLoadingShifts(true);
      const data = await shiftsApi.list();
      setShifts(data);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setLoadingShifts(false);
    }
  }, []);

  useEffect(() => {
    void loadHolidays();
    void loadShifts();
  }, [loadHolidays, loadShifts]);

  const resetHolidayForm = () => {
    setNewHolidayName("");
    setNewHolidayStartDate("");
    setNewHolidayEndDate("");
    setEditingHoliday(null);
  };

  const closeHolidayModal = () => {
    setHolidayModalOpen(false);
    setHolidayDeleteConfirmOpen(false);
    resetHolidayForm();
  };

  const openAddHoliday = () => {
    setHolidayDeleteConfirmOpen(false);
    resetHolidayForm();
    setHolidayModalOpen(true);
  };

  const openEditHoliday = (h: HolidayDto) => {
    setHolidayDeleteConfirmOpen(false);
    setEditingHoliday(h);
    setNewHolidayName(h.name);
    setNewHolidayStartDate(h.startDate || h.date || "");
    setNewHolidayEndDate(h.endDate || h.date || "");
    setHolidayModalOpen(true);
  };

  const handleSaveHoliday = async () => {
    if (!newHolidayName.trim() || !newHolidayStartDate || !newHolidayEndDate) {
      toast.error("Name, start date, and end date are required");
      return;
    }
    if (newHolidayEndDate < newHolidayStartDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    try {
      setIsSavingHoliday(true);
      if (editingHoliday) {
        await leavesApi.updateHoliday(editingHoliday.id, {
          name: newHolidayName.trim(),
          startDate: newHolidayStartDate,
          endDate: newHolidayEndDate,
        });
        toast.success("Holiday updated successfully");
      } else {
        await leavesApi.createHoliday(
          newHolidayName.trim(),
          newHolidayStartDate,
          newHolidayEndDate,
        );
        toast.success("Holiday added successfully");
      }
      closeHolidayModal();
      await loadHolidays();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to save holiday";
      toast.error(msg);
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!editingHoliday) return;
    const holidayId = editingHoliday.id;
    try {
      setIsDeletingHoliday(true);
      await leavesApi.deleteHoliday(holidayId);
      await loadHolidays();
      setHolidayDeleteConfirmOpen(false);
      closeHolidayModal();
      toast.success("Holiday removed");
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to remove holiday";
      toast.error(msg);
    } finally {
      setIsDeletingHoliday(false);
    }
  };

  const closeShiftEditor = () => {
    setShiftEditorMode("idle");
    setEditingShift(null);
    setShiftDeleteConfirmOpen(false);
    setShiftEmployeeSearch("");
  };

  const openCreateShift = () => {
    setShiftEditorMode("create");
    setEditingShift(null);
    setShiftName("");
    setShiftStartTime("09:00");
    setShiftEndTime("18:00");
    setShiftWeekendDays([5, 6]);
    setShiftGracePeriod(0);
    setShiftEmployeeIds([]);
    setShiftDeleteConfirmOpen(false);
    setShiftEmployeeSearch("");
  };

  const openEditShift = (shift: ShiftDto) => {
    setShiftEditorMode("edit");
    setEditingShift(shift);
    setShiftName(shift.name);
    setShiftStartTime(shift.startTime);
    setShiftEndTime(shift.endTime);
    setShiftWeekendDays(shift.weekendDays);
    setShiftGracePeriod(shift.gracePeriod);
    const assignedIds = Object.entries(hrData)
      .filter(([, hr]) => hr.shiftId === shift.id)
      .map(([userId]) => userId);
    setShiftEmployeeIds(assignedIds);
    setShiftDeleteConfirmOpen(false);
    setShiftEmployeeSearch("");
  };

  const handleSaveShift = async () => {
    if (!shiftName.trim()) {
      toast.error("Shift name is required");
      return;
    }
    try {
      setIsSavingShift(true);
      const payload = {
        name: shiftName,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        weekendDays: shiftWeekendDays,
        gracePeriod: shiftGracePeriod,
        employeeIds: shiftEmployeeIds,
      };

      if (editingShift) {
        await shiftsApi.update(editingShift.id, payload);
        toast.success("Shift updated successfully");
      } else {
        await shiftsApi.create(payload);
        toast.success("Shift created successfully");
      }
      closeShiftEditor();
      await loadShifts();
      await onHrDataRefresh();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to save shift";
      toast.error(msg);
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;
    try {
      setIsDeletingShift(true);
      await shiftsApi.delete(editingShift.id);
      toast.success("Shift deleted successfully");
      closeShiftEditor();
      await loadShifts();
      await onHrDataRefresh();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to delete shift";
      toast.error(msg);
    } finally {
      setIsDeletingShift(false);
      setShiftDeleteConfirmOpen(false);
    }
  };

  const filteredUsersForShift = useMemo(() => {
    const term = shiftEmployeeSearch.toLowerCase().trim();
    return users.filter((u) => {
      if (!u.isActive) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    });
  }, [users, shiftEmployeeSearch]);

  const shiftEditorOpen = shiftEditorMode !== "idle";

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6 md:px-8">
      <Tabs
        value={officeSubTab}
        onValueChange={(v) => setOfficeSubTab(v as "holidays" | "shifts")}
        className="w-full space-y-6"
      >
        <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1.5 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="shifts"
            className="flex-1 gap-2 px-4 py-2.5 text-sm data-[state=active]:bg-background sm:flex-none"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            Shifts
          </TabsTrigger>
          <TabsTrigger
            value="holidays"
            className="flex-1 gap-2 px-4 py-2.5 text-sm data-[state=active]:bg-background sm:flex-none"
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            Holidays
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holidays" className="mt-0 space-y-6 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Holidays
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Excluded from leave-day calculations.
              </p>
            </div>
            <Button
              onClick={openAddHoliday}
              className="rounded-xl shadow-lg shadow-primary/15"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add holiday
            </Button>
          </div>

          <Card
            className={cn(
              "rounded-2xl overflow-hidden transition-shadow",
              loadingHolidays || holidays.length > 0
                ? "border border-border/50"
                : "border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-muted/40 shadow-sm",
            )}
          >
            {loadingHolidays ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Loader className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">Loading holidays…</p>
              </div>
            ) : holidays.length === 0 ? (
              <div className="relative px-6 py-14 sm:px-10 sm:py-16">
                <div
                  className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/15 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 -translate-x-1/4 translate-y-1/4 rounded-full bg-primary/5 blur-3xl"
                  aria-hidden
                />
                <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-background/80 shadow-lg shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-sm">
                    <CalendarDays
                      className="h-8 w-8 text-primary"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h4 className="text-lg font-semibold tracking-tight sm:text-xl">
                    No holidays configured
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    Company and public holidays you add here are excluded from
                    leave working-day totals, so balances stay accurate.
                  </p>
                  <Button
                    onClick={openAddHoliday}
                    size="lg"
                    className="mt-8 rounded-xl shadow-lg shadow-primary/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add holiday
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow
                      key={h.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => openEditHoliday(h)}
                      aria-label={`Edit holiday ${h.name}`}
                    >
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatHolidayRange(h)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="mt-0 space-y-8 focus-visible:outline-none">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Shifts
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Every employee must be assigned to a shift for attendance. Configure
                hours, weekend days, grace period, and team members per shift.
              </p>
            </div>
            <Button
              onClick={openCreateShift}
              className="rounded-xl shadow-lg shadow-primary/15"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new shift
            </Button>
          </div>

          {loadingShifts ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <Loader className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">Loading shifts…</p>
            </div>
          ) : shifts.length === 0 ? (
            <Card className="rounded-2xl overflow-hidden border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-muted/40 shadow-sm transition-shadow">
              <div className="relative px-6 py-14 sm:px-10 sm:py-16">
                <div
                  className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/15 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 -translate-x-1/4 translate-y-1/4 rounded-full bg-primary/5 blur-3xl"
                  aria-hidden
                />
                <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-background/80 shadow-lg shadow-primary/10 ring-1 ring-primary/10 backdrop-blur-sm">
                    <Settings2
                      className="h-8 w-8 text-primary"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h4 className="text-lg font-semibold tracking-tight sm:text-xl">
                    No shifts configured
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    Employees need a shift before they can check in or out. Create
                    a shift, set hours and weekend days, then assign team members.
                  </p>
                  <Button
                    onClick={openCreateShift}
                    size="lg"
                    className="mt-8 rounded-xl shadow-lg shadow-primary/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create new shift
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {shifts.map((shift) => {
                const assigned = users.filter(
                  (u) => hrData[u.id]?.shiftId === shift.id,
                );
                return (
                  <Card
                    key={shift.id}
                    className="rounded-2xl border border-border/50 p-6 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                    onClick={() => openEditShift(shift)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-lg">{shift.name}</h4>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-1">
                          {formatTime12h(shift.startTime)} —{" "}
                          {formatTime12h(shift.endTime)}
                        </p>
                      </div>
                      <Clock className="h-5 w-5 text-primary shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-4">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "h-7 w-7 rounded-md flex items-center justify-center text-[9px] font-bold",
                            shift.weekendDays.includes(idx)
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : "bg-primary/5 text-primary/70 border border-primary/10",
                          )}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      {assigned.length} member
                      {assigned.length !== 1 ? "s" : ""}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={holidayModalOpen}
        onOpenChange={(open) => {
          if (!open) closeHolidayModal();
        }}
      >
        <DialogContent className="max-w-md w-[95vw] gap-6 p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? "Edit holiday" : "Add holiday"}
            </DialogTitle>
            <DialogDescription>
              Inclusive range (start through end). Use the same date twice for a
              single-day holiday. These days are excluded from leave working-day
              totals.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Name</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="holiday-name"
                  placeholder="e.g. Eid holidays"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="holiday-start">Start date</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="holiday-start"
                    type="date"
                    value={newHolidayStartDate}
                    onChange={(e) => setNewHolidayStartDate(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday-end">End date</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="holiday-end"
                    type="date"
                    value={newHolidayEndDate}
                    min={newHolidayStartDate || undefined}
                    onChange={(e) => setNewHolidayEndDate(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2 pt-2 border-t sm:flex-nowrap">
            {editingHoliday ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setHolidayDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            ) : null}
            <div className="min-w-2 flex-1" aria-hidden />
            <div className="flex flex-row items-center gap-2 sm:ml-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeHolidayModal}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSaveHoliday()}
                disabled={
                  isSavingHoliday ||
                  !newHolidayName.trim() ||
                  !newHolidayStartDate ||
                  !newHolidayEndDate
                }
              >
                {isSavingHoliday
                  ? "Saving…"
                  : editingHoliday
                    ? "Update"
                    : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={holidayDeleteConfirmOpen && !!editingHoliday}
        onOpenChange={(open) => {
          if (!open && !isDeletingHoliday) {
            setHolidayDeleteConfirmOpen(false);
          }
        }}
      >
        <AlertDialogContent className="sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this holiday?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    {editingHoliday?.name}
                  </span>
                  {editingHoliday ? (
                    <>
                      {" · "}
                      {formatHolidayRange(editingHoliday)}
                    </>
                  ) : null}{" "}
                  will be removed from the calendar. Leave calculations will
                  update accordingly.
                </p>
                <p>This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingHoliday}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingHoliday}
              onClick={() => void handleConfirmDeleteHoliday()}
            >
              {isDeletingHoliday ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={shiftEditorOpen}
        onOpenChange={(open) => {
          if (!open) closeShiftEditor();
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto gap-6 p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle>
              {shiftEditorMode === "create"
                ? "Create shift"
                : shiftEditorMode === "edit"
                  ? "Edit shift"
                  : "Shift"}
            </DialogTitle>
            <DialogDescription>
              Configure times, weekend days, and assigned employees.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="shift-name">Shift name</Label>
                <Input
                  id="shift-name"
                  placeholder="e.g. Morning shift"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shift-start">Start</Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-end">End</Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="shift-grace">Grace period (minutes)</Label>
                  <span className="text-xs text-muted-foreground">
                    {shiftGracePeriod} min
                  </span>
                </div>
                <Input
                  id="shift-grace"
                  type="number"
                  min={0}
                  value={shiftGracePeriod}
                  onChange={(e) =>
                    setShiftGracePeriod(parseInt(e.target.value, 10) || 0)
                  }
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Weekend days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_CHIPS.map(({ day, name }) => {
                    const isSelected = shiftWeekendDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setShiftWeekendDays(
                              shiftWeekendDays.filter((d) => d !== day),
                            );
                          } else {
                            setShiftWeekendDays(
                              [...shiftWeekendDays, day].sort(),
                            );
                          }
                        }}
                        className={cn(
                          "h-10 px-3 rounded-lg text-xs font-semibold border-2 transition-all",
                          isSelected
                            ? "bg-destructive/10 border-destructive text-destructive"
                            : "bg-muted/30 border-transparent text-muted-foreground",
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Team assignment</Label>
                <Badge variant="outline">{shiftEmployeeIds.length} selected</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees…"
                  value={shiftEmployeeSearch}
                  onChange={(e) => setShiftEmployeeSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <div className="rounded-xl border bg-muted/20 max-h-[min(360px,40vh)] overflow-y-auto p-2 space-y-1">
                {filteredUsersForShift.map((u) => {
                  const isSelected = shiftEmployeeIds.includes(u.id);
                  const otherShift = shifts.find(
                    (s) =>
                      s.id !== editingShift?.id &&
                      hrData[u.id]?.shiftId === s.id,
                  );
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!!otherShift}
                      onClick={() => {
                        if (otherShift) return;
                        if (isSelected) {
                          setShiftEmployeeIds(
                            shiftEmployeeIds.filter((id) => id !== u.id),
                          );
                        } else {
                          setShiftEmployeeIds([...shiftEmployeeIds, u.id]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/80 border border-transparent",
                        otherShift && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          {u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {u.name}
                          </div>
                          {otherShift ? (
                            <div className="text-[10px] text-orange-600">
                              In: {otherShift.name}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-4 pt-2 border-t">
            <div>
              {editingShift && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShiftDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete shift
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" onClick={closeShiftEditor}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveShift()}
                disabled={isSavingShift || !shiftName.trim()}
              >
                {isSavingShift
                  ? "Saving…"
                  : editingShift
                    ? "Update shift"
                    : "Create shift"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={shiftDeleteConfirmOpen && !!editingShift}
        onOpenChange={(open) => {
          if (!open && !isDeletingShift) {
            setShiftDeleteConfirmOpen(false);
          }
        }}
      >
        <AlertDialogContent className="sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  You are about to delete{" "}
                  <span className="font-semibold text-foreground">
                    {editingShift?.name}
                  </span>
                  . Anyone assigned to it will fall back to organization default
                  hours and weekends.
                </p>
                <p>This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingShift}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingShift}
              onClick={() => void handleDeleteShift()}
            >
              {isDeletingShift ? "Deleting…" : "Delete shift"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
