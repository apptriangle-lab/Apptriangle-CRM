import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const RFQ_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_rbac: "Pending pricing",
  pending_system: "Pending approval",
  reapplied: "Reapplied",
  approved: "Approved",
  rejected: "Rejected",
};

const RFQ_STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  pending_rbac: "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
  pending_system: "bg-sky-100 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100",
  reapplied: "bg-violet-100 text-violet-950 dark:bg-violet-950/45 dark:text-violet-100",
  approved: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100",
};

export function RfqStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-lg border-0 px-2.5 py-0.5 text-xs font-semibold",
        RFQ_STATUS_CLASS[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800",
        className,
      )}
    >
      {RFQ_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** Shown when an RFQ has been reopened at least once (version &gt; 1). */
export function RfqReopenedChip({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 rounded-lg border border-red-400/90 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-950 shadow-sm dark:border-red-500 dark:bg-red-950 dark:text-red-50",
        className,
      )}
    >
      Reopened
    </Badge>
  );
}
