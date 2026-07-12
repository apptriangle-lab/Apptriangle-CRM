import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  attendanceReconciliationApi,
  type AttendanceReconciliationDto,
  type AttendanceReconciliationStatus,
  type UserDto,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReconciliationRequestsTableSkeleton } from "@/components/attendance/ReconciliationRequestsTableSkeleton";
import { ReconciliationReviewModal } from "@/components/attendance/ReconciliationReviewModal";
import { AttendanceHubHeader } from "@/components/attendance/AttendanceHubHeader";
import {
  ReconciliationFilterBar,
  type ReconciliationStatusFilter,
} from "@/components/attendance/ReconciliationFilterBar";
import { toast } from "sonner";
import { format } from "date-fns";
import { ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { formatAttendanceHhmm12h } from "@/lib/attendanceDisplay";
import { cn } from "@/lib/utils";

type ReconciliationRequestsPanelProps = {
  isAttendanceAdmin: boolean;
  refreshToken?: number;
  onAfterReview?: () => void;
  adminFilterUsers?: UserDto[];
  /** Tabs on the left of the admin filter row (Attendance page). */
  toolbarLeading?: ReactNode;
};

function statusBadge(status: AttendanceReconciliationStatus) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-50 text-rose-800 border-rose-200",
  };
  return (
    <Badge variant="outline" className={cn("font-normal capitalize", map[status] ?? "")}>
      {status}
    </Badge>
  );
}

export function ReconciliationRequestsPanel({
  isAttendanceAdmin,
  refreshToken = 0,
  onAfterReview,
  adminFilterUsers = [],
  toolbarLeading,
}: ReconciliationRequestsPanelProps) {
  const [rows, setRows] = useState<AttendanceReconciliationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminStatusFilter, setAdminStatusFilter] = useState<ReconciliationStatusFilter>("pending");
  const [adminUserFilter, setAdminUserFilter] = useState<string>("all");
  const [adminDateRange, setAdminDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [reviewRow, setReviewRow] = useState<AttendanceReconciliationDto | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected" | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);

  const sortedFilterUsers = useMemo(
    () => [...adminFilterUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [adminFilterUsers],
  );

  const adminDateFromKey = adminDateRange.from?.getTime();
  const adminDateToKey = adminDateRange.to?.getTime();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAttendanceAdmin) {
        const dateFrom =
          adminDateRange.from != null ? format(adminDateRange.from, "yyyy-MM-dd") : undefined;
        const dateTo =
          adminDateRange.to != null
            ? format(adminDateRange.to, "yyyy-MM-dd")
            : adminDateRange.from != null
              ? format(adminDateRange.from, "yyyy-MM-dd")
              : undefined;
        const data = await attendanceReconciliationApi.list({
          status: adminStatusFilter === "all" ? undefined : adminStatusFilter,
          userId: adminUserFilter === "all" ? undefined : adminUserFilter,
          dateFrom,
          dateTo,
        });
        setRows(data);
      } else {
        const data = await attendanceReconciliationApi.list();
        setRows(data);
      }
    } catch {
      toast.error("Failed to load reconciliation requests");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAttendanceAdmin, adminStatusFilter, adminUserFilter, adminDateFromKey, adminDateToKey]);

  const hasActiveAdminFilters =
    isAttendanceAdmin &&
    (adminStatusFilter !== "pending" ||
      adminUserFilter !== "all" ||
      !!adminDateRange.from);

  const clearAdminFilters = () => {
    setAdminStatusFilter("pending");
    setAdminUserFilter("all");
    setAdminDateRange({});
  };

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const openReview = (row: AttendanceReconciliationDto, decision: "approved" | "rejected") => {
    setReviewRow(row);
    setReviewDecision(decision);
  };

  const closeReview = () => {
    if (reviewSaving) return;
    setReviewRow(null);
    setReviewDecision(null);
  };

  const submitReview = async (reviewNote: string) => {
    if (!reviewRow || !reviewDecision) return;
    setReviewSaving(true);
    try {
      await attendanceReconciliationApi.review(reviewRow.id, {
        status: reviewDecision,
        reviewNote: reviewNote.trim() || undefined,
      });
      toast.success(reviewDecision === "approved" ? "Request approved" : "Request rejected");
      closeReview();
      await load();
      onAfterReview?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setReviewSaving(false);
    }
  };

  const tableSection = (
    <Card
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        !isAttendanceAdmin && "border-slate-200",
      )}
    >
      {!isAttendanceAdmin ? (
        <CardHeader className="border-b border-slate-100 px-6 py-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              My reconciliation requests
            </CardTitle>
            <p className="text-sm text-slate-500">
              Your submitted reason appears below; track pending, approved, or rejected requests.
            </p>
          </div>
        </CardHeader>
      ) : (
        <div className="border-b border-slate-100 px-4 py-2.5 sm:px-6">
          <p className="text-sm text-slate-500">
            {loading ? "Loading requests…" : `${rows.length} request(s)`}
          </p>
        </div>
      )}
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
            <ReconciliationRequestsTableSkeleton isAttendanceAdmin={isAttendanceAdmin} />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No requests in this view.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow className="border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                  {isAttendanceAdmin && (
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </TableHead>
                  )}
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Check-in time
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reason
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </TableHead>
                  {isAttendanceAdmin && (
                    <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="border-slate-100 text-[13px] hover:bg-slate-50/80">
                    {isAttendanceAdmin && (
                      <TableCell className="max-w-[160px]">
                        <div className="truncate font-medium text-slate-900">{r.requesterName}</div>
                        <div className="truncate text-xs text-slate-500">{r.requesterEmail}</div>
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {r.attendanceDate
                        ? format(new Date(r.attendanceDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-800">
                      {formatAttendanceHhmm12h(r.requestedCheckInTime)}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="line-clamp-2 text-slate-700">{r.reason}</p>
                      {r.applicantNote ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{r.applicantNote}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    {isAttendanceAdmin && (
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              title="Approve request"
                              onClick={() => openReview(r, "approved")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 text-[13px] font-medium text-emerald-800 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              Approve
                            </button>
                            <button
                              type="button"
                              title="Reject request"
                              onClick={() => openReview(r, "rejected")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-[13px] font-medium text-rose-700 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {r.reviewedByName ? `By ${r.reviewedByName}` : "—"}
                            {r.reviewedAt
                              ? ` · ${format(new Date(r.reviewedAt), "MMM d, HH:mm")}`
                              : ""}
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {isAttendanceAdmin ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-3">
          <ReconciliationFilterBar
            leadingSlot={toolbarLeading}
            status={adminStatusFilter}
            onStatusChange={setAdminStatusFilter}
            employeeId={adminUserFilter}
            onEmployeeChange={setAdminUserFilter}
            employees={sortedFilterUsers}
            dateRange={adminDateRange}
            onDateRangeChange={setAdminDateRange}
            onClearFilters={clearAdminFilters}
            hasActiveFilters={hasActiveAdminFilters}
          />
          {tableSection}
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-3">
          {toolbarLeading ? <AttendanceHubHeader tabs={toolbarLeading} /> : null}
          {tableSection}
        </div>
      )}

      <ReconciliationReviewModal
        open={Boolean(reviewRow && reviewDecision)}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
        row={reviewRow}
        decision={reviewDecision}
        saving={reviewSaving}
        onConfirm={(note) => void submitReview(note)}
      />
    </div>
  );
}
