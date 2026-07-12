import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  BarChart3,
  Eye,
  FileText,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { EmptyState } from "@/components/EmptyState";
import {
  HrReportAutomationFormModal,
  automationToForm,
  emptyReportAutomationForm,
  type ReportAutomationFormState,
} from "@/components/hr/HrReportAutomationFormModal";
import {
  RecipientNamesCell,
  ReportRecipientsAvatarStack,
  ReportRecipientsList,
  usersToRecipients,
} from "@/components/hr/ReportRecipientsList";
import {
  getStoredToken,
  reportAutomationsApi,
  type ReportAutomationDto,
  type ReportAutomationPayload,
  type ReportExecutionLogDto,
  type ShiftDto,
  type UserDto,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  users: UserDto[];
  shifts: ShiftDto[];
};

const LOG_PAGE_SIZE = 6;
const AUTOMATION_PAGE_SIZE = 10;

const THEME_DROPDOWN_ITEM_CLASS =
  "cursor-pointer rounded-lg focus:bg-[#EFF6FF] focus:text-[#0F172A] data-[highlighted]:bg-[#EFF6FF] data-[highlighted]:text-[#0F172A]";
const THEME_DROPDOWN_DESTRUCTIVE_ITEM_CLASS =
  "cursor-pointer rounded-lg text-[#DC2626] focus:bg-[#FEF2F2] focus:text-[#DC2626] data-[highlighted]:bg-[#FEF2F2] data-[highlighted]:text-[#DC2626]";
const THEME_ROW_ACTION_BUTTON_CLASS =
  "h-8 w-8 rounded-lg text-[#64748B] hover:!bg-[#EFF6FF] hover:!text-[#2563EB] focus-visible:ring-[#2563EB]/20";
const THEME_ROW_PRIMARY_ACTION_BUTTON_CLASS =
  "h-8 w-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:!bg-[#DBEAFE] hover:!text-[#1D4ED8] focus-visible:ring-[#2563EB]/20";

type AutomationUiStatus = "active" | "paused" | "error";

function getAutomationStatus(row: ReportAutomationDto): AutomationUiStatus {
  if (!row.isActive) return "paused";
  if (row.lastExecutionStatus === "failed") return "error";
  return "active";
}

function formatNextRunLabel(row: ReportAutomationDto): { text: string; tone: "default" | "failed" | "muted" } {
  const status = getAutomationStatus(row);
  if (status === "paused") return { text: "Paused", tone: "muted" };
  if (status === "error") return { text: "Failed", tone: "failed" };
  if (!row.nextRunAt) return { text: "—", tone: "muted" };
  try {
    return { text: format(new Date(row.nextRunAt), "MMM d, yyyy · hh:mm a"), tone: "default" };
  } catch {
    return { text: row.nextRunAt, tone: "default" };
  }
}

function formatExecutionTime12h(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function formatStartDateLabel(value?: string): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return format(new Date(year, month - 1, day), "MMM d, yyyy");
}

function formatLogTime(iso?: string) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy · hh:mm a");
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: AutomationUiStatus }) {
  const styles = {
    active: "bg-[#DCFCE7] text-[#166534]",
    paused: "bg-[#F1F5F9] text-[#64748B]",
    error: "bg-[#FEE2E2] text-[#991B1B]",
  };
  const labels = { active: "ACTIVE", paused: "PAUSED", error: "ERROR" };
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-wide", styles[status])}>
      {labels[status]}
    </span>
  );
}

function LogStatusPill({ status }: { status: "success" | "failed" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-wide",
        status === "success" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]",
      )}
    >
      {status === "success" ? "SUCCESS" : "FAILED"}
    </span>
  );
}

export function HrReportsPanel({ users, shifts }: Props) {
  const [automations, setAutomations] = useState<ReportAutomationDto[]>([]);
  const [logs, setLogs] = useState<ReportExecutionLogDto[]>([]);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<ReportAutomationDto | null>(null);
  const [viewing, setViewing] = useState<ReportAutomationDto | null>(null);
  const [form, setForm] = useState<ReportAutomationFormState>(emptyReportAutomationForm());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportAutomationDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [automationPage, setAutomationPage] = useState(0);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const list = await reportAutomationsApi.list();
      setAutomations(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (page: number, options?: { silent?: boolean }) => {
    if (!options?.silent) setLogsLoading(true);
    try {
      const offset = page * LOG_PAGE_SIZE;
      const res = await reportAutomationsApi.listExecutionLogs(undefined, {
        limit: LOG_PAGE_SIZE,
        offset,
      });
      setLogs(res.items);
      setLogsHasMore(res.hasMore);
      setLogsTotal(res.total);
      setLogsPage(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load execution history");
    } finally {
      if (!options?.silent) setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const filteredAutomations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return automations;
    return automations.filter((row) => {
      const hay = [
        row.reportName,
        row.reportTypeLabel,
        formatExecutionTime12h(row.executionTime || "09:00"),
        row.scheduleType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [automations, search]);

  const automationPageCount = Math.max(1, Math.ceil(filteredAutomations.length / AUTOMATION_PAGE_SIZE));
  const pagedAutomations = filteredAutomations.slice(
    automationPage * AUTOMATION_PAGE_SIZE,
    automationPage * AUTOMATION_PAGE_SIZE + AUTOMATION_PAGE_SIZE,
  );

  useEffect(() => {
    setAutomationPage(0);
  }, [search]);

  const openHistoryModal = useCallback(async () => {
    setHistoryOpen(true);
    await loadLogs(0);
  }, [loadLogs]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyReportAutomationForm());
    setModalOpen(true);
  };

  const openEdit = (row: ReportAutomationDto) => {
    setEditing(row);
    setForm(automationToForm(row));
    setModalOpen(true);
  };

  const openView = (row: ReportAutomationDto) => {
    setViewing(row);
    setViewOpen(true);
  };

  const validate = () => {
    if (!form.reportName.trim()) {
      toast.error("Report name is required");
      return false;
    }
    if (!form.shiftIds.length) {
      toast.error("Select at least one shift");
      return false;
    }
    if (!form.recipientUserIds.length) {
      toast.error("Select at least one recipient");
      return false;
    }
    if (!form.startDate) {
      toast.error("Start date is required");
      return false;
    }
    if (!form.executionTime) {
      toast.error("Execution time is required");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload: ReportAutomationPayload = {
      reportName: form.reportName.trim(),
      reportType: form.reportType,
      description: form.description?.trim() ?? "",
      scheduleType: form.scheduleType,
      startDate: form.startDate.slice(0, 10),
      executionTime: form.executionTime,
      timezone: form.timezone,
      isActive: form.isActive,
      shiftIds: form.shiftIds,
      recipientUserIds: form.recipientUserIds,
    };
    try {
      if (editing) {
        await reportAutomationsApi.update(editing.id, payload);
        toast.success("Report automation updated");
      } else {
        await reportAutomationsApi.create(payload);
        toast.success("Report automation created");
      }
      setModalOpen(false);
      await loadAutomations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async (row: ReportAutomationDto) => {
    setSendingId(row.id);
    let showHistory = false;
    try {
      const res = await reportAutomationsApi.sendNow(row.id);
      toast.success(`Report sent to ${res.recipientCount} recipient(s)`);
      await loadAutomations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
      showHistory = true;
    } finally {
      setSendingId(null);
      if (showHistory) {
        setHistoryOpen(true);
        await loadLogs(0);
      } else if (historyOpen) {
        await loadLogs(logsPage, { silent: true });
      }
    }
  };

  const handleToggle = async (row: ReportAutomationDto) => {
    try {
      await reportAutomationsApi.toggle(row.id, !row.isActive);
      toast.success(row.isActive ? "Automation disabled" : "Automation enabled");
      await loadAutomations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await reportAutomationsApi.delete(deleteTarget.id);
      toast.success("Automation deleted");
      setDeleteTarget(null);
      await loadAutomations();
      if (historyOpen) {
        await loadLogs(logsPage, { silent: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const downloadLog = async (log: ReportExecutionLogDto) => {
    const token = getStoredToken();
    const url = reportAutomationsApi.downloadLogUrl(log.id);
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = log.filePath?.split("/").pop()?.split("_").slice(1).join("_") || "attendance_report.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <div className="space-y-6 font-['Hanken_Grotesk',sans-serif]">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Report automation</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Schedule attendance reports or send them manually to selected users
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void openHistoryModal()}
            className="h-10 rounded-xl border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <History className="mr-2 h-4 w-4 text-[#64748B]" />
            Execution history
          </Button>
          <Button onClick={openCreate} className="h-10 rounded-xl bg-[#2563EB] px-5 hover:bg-[#1D4ED8]">
            <Plus className="mr-2 h-4 w-4" />
            New automation
          </Button>
        </div>
      </div>

      {/* Main table card */}
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] px-4 py-3">
          <div className="relative min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter automations..."
              className="h-10 rounded-xl border-[#E2E8F0] pl-9"
            />
          </div>
        </div>

        {loading ? (
          <Loader className="py-20" message="Loading automations…" />
        ) : filteredAutomations.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No report automations"
            description="Create an attendance report automation to email scheduled reports to your team."
            actionLabel="New automation"
            onAction={openCreate}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["REPORT NAME", "TYPE", "SCHEDULE", "NEXT RUN", "RECIPIENTS", "STATUS", "ACTIONS"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-[#64748B]"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagedAutomations.map((row) => {
                    const uiStatus = getAutomationStatus(row);
                    const nextRun = formatNextRunLabel(row);
                    const recipients = usersToRecipients(row.recipientUserIds, users);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-[#F1F5F9]",
                          uiStatus === "paused"
                            ? "bg-[#FEF2F2] hover:bg-[#FEE2E2]"
                            : "hover:bg-[#FAFBFC]",
                        )}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                              <FileText className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-[#0F172A]">{row.reportName}</span>
                            {uiStatus === "error" ? (
                              <AlertCircle className="h-4 w-4 text-[#DC2626]" />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#64748B]">
                          {row.reportTypeLabel ?? "Attendance Report"}
                        </td>
                        <td className="max-w-[220px] px-4 py-4 text-sm text-[#64748B]">
                          {formatExecutionTime12h(row.executionTime || "09:00")}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={cn(
                              nextRun.tone === "failed" && "font-medium text-[#DC2626]",
                              nextRun.tone === "muted" && "text-[#64748B]",
                              nextRun.tone === "default" && "text-[#0F172A]",
                            )}
                          >
                            {nextRun.text}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <ReportRecipientsAvatarStack recipients={recipients} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={uiStatus} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={THEME_ROW_PRIMARY_ACTION_BUTTON_CLASS}
                              title="Send now"
                              disabled={sendingId === row.id}
                              onClick={() => handleSendNow(row)}
                            >
                              {sendingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className={THEME_ROW_ACTION_BUTTON_CLASS}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl border-[#E2E8F0]">
                                <DropdownMenuItem className={THEME_DROPDOWN_ITEM_CLASS} onClick={() => openView(row)}>
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem className={THEME_DROPDOWN_ITEM_CLASS} onClick={() => openEdit(row)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className={THEME_DROPDOWN_ITEM_CLASS} onClick={() => handleToggle(row)}>
                                  <Power className="mr-2 h-4 w-4" />
                                  {row.isActive ? "Pause" : "Enable"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className={THEME_DROPDOWN_DESTRUCTIVE_ITEM_CLASS}
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-4 py-3">
              <p className="text-sm text-[#64748B]">
                Showing {pagedAutomations.length} of {filteredAutomations.length} automations
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-[#E2E8F0]"
                  disabled={automationPage === 0}
                  onClick={() => setAutomationPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                {Array.from({ length: automationPageCount }, (_, i) => (
                  <Button
                    key={i}
                    variant={automationPage === i ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 w-8 rounded-lg p-0",
                      automationPage === i
                        ? "bg-[#2563EB] hover:bg-[#1D4ED8]"
                        : "border-[#E2E8F0]",
                    )}
                    onClick={() => setAutomationPage(i)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-[#E2E8F0]"
                  disabled={automationPage >= automationPageCount - 1}
                  onClick={() => setAutomationPage((p) => Math.min(automationPageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Execution history modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-[#E2E8F0] p-0 font-['Hanken_Grotesk',sans-serif]">
          <div className="flex items-start gap-4 border-b border-[#E2E8F0] px-6 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">Execution History</h2>
              <p className="text-sm text-[#64748B]">Log of all automated report generation events.</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {logsLoading ? (
              <Loader className="py-20" message="Loading history…" />
            ) : logs.length === 0 ? (
              <p className="px-6 py-20 text-center text-sm text-[#64748B]">No executions yet</p>
            ) : (
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["EXECUTION TIME", "REPORT", "STATUS", "RECIPIENTS", "DOWNLOAD", "ERROR"].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-[#64748B]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F1F5F9]">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[#64748B]">
                        {formatLogTime(log.executionTime)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[#0F172A]">
                        {log.reportName || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <LogStatusPill status={log.status} />
                      </td>
                      <td className="max-w-[200px] px-4 py-4">
                        <RecipientNamesCell recipients={log.recipients ?? []} />
                      </td>
                      <td className="px-4 py-4">
                        {log.filePath && log.status === "success" ? (
                          <button
                            type="button"
                            onClick={() => downloadLog(log)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            PDF
                          </button>
                        ) : (
                          <span className="text-[#CBD5E1]">⊘</span>
                        )}
                      </td>
                      <td className="max-w-[240px] px-4 py-4 text-sm">
                        {log.errorMessage ? (
                          <span className="italic text-[#DC2626]">{log.errorMessage}</span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#FAFBFC] px-6 py-4">
            <p className="text-sm text-[#64748B]">
              Showing {logs.length} of {logsTotal} executions
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-[#E2E8F0]"
                disabled={logsPage === 0 || logsLoading}
                onClick={() => void loadLogs(logsPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-[#E2E8F0]"
                disabled={!logsHasMore || logsLoading}
                onClick={() => void loadLogs(logsPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HrReportAutomationFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        form={form}
        onChange={setForm}
        shifts={shifts}
        users={users}
        saving={saving}
        onSubmit={handleSave}
      />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg rounded-2xl font-['Hanken_Grotesk',sans-serif]">
          <h2 className="text-xl font-bold text-[#0F172A]">{viewing?.reportName}</h2>
          {viewing ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Type</dt>
                <dd className="font-medium text-[#0F172A]">{viewing.reportTypeLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Start date</dt>
                <dd className="font-medium text-[#0F172A]">{formatStartDateLabel(viewing.startDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Schedule</dt>
                <dd className="text-right font-medium text-[#0F172A]">
                  {formatExecutionTime12h(viewing.executionTime || "09:00")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Next run</dt>
                <dd className="font-medium text-[#0F172A]">{formatNextRunLabel(viewing).text}</dd>
              </div>
              <div>
                <dt className="mb-2 text-[#64748B]">Recipients</dt>
                <dd>
                  <ReportRecipientsList recipients={usersToRecipients(viewing.recipientUserIds, users)} />
                </dd>
              </div>
              {viewing.description ? (
                <div>
                  <dt className="mb-1 text-[#64748B]">Description</dt>
                  <dd className="rounded-xl bg-[#F8FAFC] p-3 text-[#0F172A]">{viewing.description}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.reportName}&quot; and its configuration. Execution logs are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
