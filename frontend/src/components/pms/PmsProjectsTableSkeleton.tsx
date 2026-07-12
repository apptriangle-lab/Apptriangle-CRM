import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_ROW_COUNT = 8;

const TITLE_WIDTHS = ["w-[68%]", "w-[54%]", "w-[76%]", "w-[62%]", "w-[70%]"] as const;

function PmsProjectsTableSkeletonRow({
  index,
  showActionsColumn,
}: {
  index: number;
  showActionsColumn: boolean;
}) {
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length];

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="w-10 px-2">
        <Skeleton className="mx-auto h-8 w-8 rounded-lg bg-slate-100" />
      </TableCell>
      <TableCell>
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className={cn("h-4 bg-slate-100", titleWidth)} />
            <Skeleton className="h-5 w-14 shrink-0 rounded-md bg-slate-100" />
          </div>
          <Skeleton className="h-3 w-20 bg-slate-100" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex max-w-[180px] items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm bg-slate-100" />
          <Skeleton className="h-4 min-w-0 flex-1 bg-slate-100" />
        </div>
      </TableCell>
      <TableCell>
        <div className="min-w-[5.5rem]">
          <Skeleton className="h-6 w-[5.5rem] rounded-md bg-slate-100" />
          <div className="mt-2 flex w-full min-w-[6.5rem] max-w-[8.5rem] items-center gap-2">
            <Skeleton className="h-[5px] min-w-0 flex-1 rounded-full bg-slate-100" />
            <Skeleton className="h-3 w-7 shrink-0 rounded-sm bg-slate-100" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14 bg-slate-100" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20 bg-slate-100" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20 bg-slate-100" />
      </TableCell>
      <TableCell>
        <div className="flex -space-x-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100 ring-2 ring-card" />
          <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100 ring-2 ring-card" />
          <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-slate-100 ring-2 ring-card" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-7 w-7 rounded-full bg-slate-100" />
      </TableCell>
      {showActionsColumn ? (
        <TableCell className="text-right">
          <Skeleton className="ml-auto h-8 w-8 rounded-lg bg-slate-100" />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

type Props = {
  showActionsColumn?: boolean;
};

export function PmsProjectsTableSkeleton({ showActionsColumn = false }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
      <Table scrollContainer={false}>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 border-b border-border/60 bg-card hover:bg-card">
            <TableHead className="h-10 w-10 px-2" aria-label="Starred" />
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Start
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              End
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Owner
            </TableHead>
            {showActionsColumn ? (
              <TableHead className="h-10 w-[72px] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
            <PmsProjectsTableSkeletonRow key={i} index={i} showActionsColumn={showActionsColumn} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
