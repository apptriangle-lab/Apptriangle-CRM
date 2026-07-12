import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROW_COUNT = 8;

function ReconciliationSkeletonRow({
  index,
  isAttendanceAdmin,
}: {
  index: number;
  isAttendanceAdmin: boolean;
}) {
  const reasonWidth = ["w-full max-w-[12rem]", "w-full max-w-[10rem]", "w-full max-w-[14rem]"][
    index % 3
  ];

  return (
    <TableRow className="border-b border-slate-100">
      {isAttendanceAdmin ? (
        <TableCell className="py-3.5">
          <Skeleton className="h-4 w-28 bg-slate-100" />
          <Skeleton className="mt-1.5 h-3 w-36 bg-slate-100" />
        </TableCell>
      ) : null}
      <TableCell className="py-3.5">
        <Skeleton className="h-4 w-24 bg-slate-100" />
      </TableCell>
      <TableCell className="py-3.5">
        <Skeleton className="h-4 w-16 bg-slate-100" />
      </TableCell>
      <TableCell className="py-3.5">
        <Skeleton className={cn("h-4 bg-slate-100", reasonWidth)} />
      </TableCell>
      <TableCell className="py-3.5">
        <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
      </TableCell>
      {isAttendanceAdmin ? (
        <TableCell className="py-3.5 text-right">
          <div className="flex justify-end gap-1.5">
            <Skeleton className="h-8 w-20 rounded-lg bg-slate-100" />
            <Skeleton className="h-8 w-16 rounded-lg bg-slate-100" />
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

export function ReconciliationRequestsTableSkeleton({
  isAttendanceAdmin,
}: {
  isAttendanceAdmin: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
            {isAttendanceAdmin ? (
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Employee
              </TableHead>
            ) : null}
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
            {isAttendanceAdmin ? (
              <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <ReconciliationSkeletonRow key={i} index={i} isAttendanceAdmin={isAttendanceAdmin} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
