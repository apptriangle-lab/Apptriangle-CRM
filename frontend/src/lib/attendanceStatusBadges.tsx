import type { AttendanceDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type Row = AttendanceDto | null | undefined;

const STATUS_PILL: Record<string, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-700",
  late: "border-amber-200 bg-amber-50 text-amber-800",
  absent: "border-slate-200 bg-slate-50 text-slate-600",
  half_day: "border-sky-200 bg-sky-50 text-sky-700",
  holiday: "border-indigo-200 bg-indigo-50 text-indigo-700",
  leave: "border-violet-200 bg-violet-50 text-violet-700",
  off_day: "border-slate-200 bg-slate-100 text-slate-600",
  no_shift: "border-slate-200 bg-slate-100 text-slate-600",
};

function StatusPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold capitalize",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Primary attendance status + optional "Reconciled" chip when an approved reconciliation exists.
 */
export function AttendanceStatusBadges({
  row,
  className,
}: {
  row: Row;
  className?: string;
}) {
  const status = row?.status || "absent";
  const reconciled = row?.reconciliationApproved === true;
  const isLate = status === "late";
  const isPresent = status === "present" || isLate;
  const isAbsent = !row || status === "absent";

  if (["half_day", "holiday", "leave", "off_day", "no_shift"].includes(status)) {
    const labels: Record<string, string> = {
      half_day: "Half day",
      holiday: "Holiday",
      leave: "Leave",
      off_day: "Off day",
      no_shift: "No shift",
    };
    return (
      <StatusPill
        label={labels[status] ?? status.replace(/_/g, " ")}
        className={cn(STATUS_PILL[status], className)}
      />
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {isPresent ? (
        isLate && !reconciled ? (
          <StatusPill label="Late" className={STATUS_PILL.late} />
        ) : (
          <StatusPill label="Present" className={STATUS_PILL.present} />
        )
      ) : isAbsent ? (
        <StatusPill label="Absent" className={STATUS_PILL.absent} />
      ) : (
        <StatusPill label="—" className={STATUS_PILL.absent} />
      )}
      {reconciled && status === "present" ? (
        <span
          title={
            row?.reconciliationRequestId
              ? `Reconciliation request ${row.reconciliationRequestId}`
              : "Marked present via approved late reconciliation"
          }
        >
          <StatusPill label="Reconciled" className="border-violet-200 bg-violet-50 text-violet-800" />
        </span>
      ) : null}
    </div>
  );
}
