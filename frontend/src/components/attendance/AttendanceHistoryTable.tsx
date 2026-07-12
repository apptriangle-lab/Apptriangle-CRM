import { format } from "date-fns";
import { Calendar, History } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceHistoryTableSkeleton } from "@/components/attendance/AttendanceHistoryTableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AttendanceHistoryPeriodDropdown } from "@/components/attendance/AttendanceHistoryPeriodDropdown";
import { ATTENDANCE_CARD, ATTENDANCE_SECTION_TITLE } from "@/components/attendance/attendanceConstants";
import { AttendanceStatusBadges } from "@/lib/attendanceStatusBadges";
import type { AttendanceHistoryPeriod } from "@/lib/attendanceDisplay";
import type { AttendanceDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  records: AttendanceDto[];
  loading: boolean;
  historyPeriod: AttendanceHistoryPeriod;
  onHistoryPeriodChange: (period: AttendanceHistoryPeriod) => void;
  /** When period filter lives in the hub toolbar above the table. */
  hidePeriodFilter?: boolean;
};

export function AttendanceHistoryTable({
  records,
  loading,
  historyPeriod,
  onHistoryPeriodChange,
  hidePeriodFilter = false,
}: Props) {
  return (
    <div
      className={cn(
        ATTENDANCE_CARD,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        hidePeriodFilter && "rounded-none border-0 bg-transparent shadow-none",
      )}
    >
      {!hidePeriodFilter ? (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 sm:px-6">
        <h2 className={ATTENDANCE_SECTION_TITLE}>Attendance history</h2>
        <AttendanceHistoryPeriodDropdown
          value={historyPeriod}
          onChange={onHistoryPeriodChange}
          align="end"
        />
      </div>
      ) : null}

      {loading ? (
        <AttendanceHistoryTableSkeleton />
      ) : records.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-12">
          <EmptyState
            icon={History}
            title="No attendance records"
            description="No records found for the selected period."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Check in
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Check out
                </TableHead>
                <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((row) => (
                <TableRow
                  key={`${row.userId}-${row.date}`}
                  className="border-b border-slate-100 text-[13px] transition-colors hover:bg-slate-50/80"
                >
                  <TableCell className="whitespace-nowrap py-3.5 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-800">
                        {row.date ? format(new Date(row.date), "EEE, MMM d, yyyy") : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-3.5">
                    {row.checkInTime ? (
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="tabular-nums text-slate-700">
                          {format(new Date(row.checkInTime), "hh:mm a")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-3.5">
                    {row.checkOutTime ? (
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span className="tabular-nums text-slate-700">
                          {format(new Date(row.checkOutTime), "hh:mm a")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-3.5">
                    <AttendanceStatusBadges row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
