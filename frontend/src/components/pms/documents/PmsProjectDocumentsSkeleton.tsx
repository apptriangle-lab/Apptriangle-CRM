import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PmsDocumentViewMode } from "@/components/pms/documents/pmsDocumentVisuals";
import { cn } from "@/lib/utils";

const SKELETON_ROW_COUNT = 7;
const NAME_WIDTHS = ["w-[72%]", "w-[58%]", "w-[80%]", "w-[64%]", "w-[70%]"] as const;

export function PmsProjectDocumentsStatsSkeleton() {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-16 bg-slate-100" />
            <Skeleton className="h-6 w-10 bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableRowSkeleton({ index }: { index: number }) {
  const nameWidth = NAME_WIDTHS[index % NAME_WIDTHS.length];

  return (
    <TableRow className="border-slate-100 hover:bg-transparent">
      <TableCell className="py-2.5 pl-4 pr-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-4 bg-slate-100", nameWidth)} />
            <Skeleton className="h-3 w-12 bg-slate-100" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden py-2.5 md:table-cell">
        <Skeleton className="h-6 w-28 rounded-full bg-slate-100" />
      </TableCell>
      <TableCell className="hidden py-2.5 sm:table-cell">
        <Skeleton className="h-4 w-12 bg-slate-100" />
      </TableCell>
      <TableCell className="hidden py-2.5 lg:table-cell">
        <Skeleton className="h-4 w-20 bg-slate-100" />
      </TableCell>
      <TableCell className="hidden py-2.5 xl:table-cell">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full bg-slate-100" />
          <Skeleton className="h-4 w-24 bg-slate-100" />
        </div>
      </TableCell>
      <TableCell className="py-2.5 pr-4 text-right">
        <Skeleton className="ml-auto h-8 w-8 rounded-md bg-slate-100" />
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <Table scrollContainer={false} className="text-[13px]">
      <TableHeader>
        <TableRow className="border-slate-200/80 hover:bg-transparent">
          <TableHead className="sticky top-0 z-10 h-10 bg-slate-50/95 pl-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            Name
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm md:table-cell">
            Location
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm sm:table-cell">
            Size
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm lg:table-cell">
            Added
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm xl:table-cell">
            Uploaded by
          </TableHead>
          <TableHead className="sticky top-0 z-10 h-10 w-[88px] bg-slate-50/95 pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            Download
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
          <TableRowSkeleton key={i} index={i} />
        ))}
      </TableBody>
    </Table>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full bg-slate-100" />
              <Skeleton className="h-3 w-16 bg-slate-100" />
              <Skeleton className="h-3 w-32 bg-slate-100" />
            </div>
          </div>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <Skeleton className="h-5 w-24 rounded-full bg-slate-100" />
            <Skeleton className="h-3 w-20 bg-slate-100" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg bg-slate-100" />
            <Skeleton className="h-8 flex-1 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ContentSkeletonProps = {
  viewMode?: PmsDocumentViewMode;
};

export function PmsProjectDocumentsContentSkeleton({ viewMode = "list" }: ContentSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Loading documents">
      {viewMode === "list" ? <TableSkeleton /> : <GridSkeleton />}
    </div>
  );
}

/** @deprecated Use split stats + content skeletons from the documents view layout */
export function PmsProjectDocumentsSkeleton({ viewMode = "list" }: ContentSkeletonProps) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading documents">
      <PmsProjectDocumentsStatsSkeleton />
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <PmsProjectDocumentsContentSkeleton viewMode={viewMode} />
      </div>
    </div>
  );
}
