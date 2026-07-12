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

const COLUMNS = ["Date", "Check in", "Check out", "Status"] as const;
const ROW_COUNT = 8;

function AttendanceHistorySkeletonRow({ index }: { index: number }) {
  const dateWidth = ["w-36", "w-32", "w-40", "w-28"][index % 4];

  return (
    <TableRow className="border-b border-slate-100">
      <TableCell className="py-3.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-sm bg-slate-100" />
          <Skeleton className={cn("h-4 bg-slate-100", dateWidth)} />
        </div>
      </TableCell>
      <TableCell className="py-3.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full bg-slate-100" />
          <Skeleton className="h-4 w-16 bg-slate-100" />
        </div>
      </TableCell>
      <TableCell className="py-3.5">
        <Skeleton className="h-4 w-16 bg-slate-100" />
      </TableCell>
      <TableCell className="py-3.5">
        <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
      </TableCell>
    </TableRow>
  );
}

export function AttendanceHistoryTableSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
            {COLUMNS.map((col) => (
              <TableHead
                key={col}
                className="h-10 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <AttendanceHistorySkeletonRow key={i} index={i} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
