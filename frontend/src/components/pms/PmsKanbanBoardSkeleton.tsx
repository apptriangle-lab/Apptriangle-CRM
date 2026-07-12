import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pmsStatusTheme } from "@/components/pms/pmsTaskListStyles";

const SKELETON_COLUMNS = [
  { status: "to_do", cards: 3 },
  { status: "in_progress", cards: 2 },
  { status: "review", cards: 2 },
  { status: "completed", cards: 1 },
] as const;

const TITLE_WIDTHS = ["w-[88%]", "w-[72%]", "w-[94%]", "w-[80%]"] as const;

function KanbanCardSkeleton({ index }: { index: number }) {
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length];

  return (
    <article className="rounded-[10px] border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Skeleton className={cn("h-4 bg-slate-100", titleWidth)} />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full bg-slate-100" />
        <Skeleton className="h-5 w-14 rounded-md bg-slate-100" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-3.5 w-3.5 rounded bg-slate-100" />
          <Skeleton className="h-3 w-24 bg-slate-100" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-3.5 w-3.5 rounded bg-slate-100" />
          <Skeleton className="h-3 w-20 bg-slate-100" />
        </div>
      </div>
    </article>
  );
}

function KanbanColumnSkeleton({
  statusKey,
  statusIndex,
  cardCount,
}: {
  statusKey: string;
  statusIndex: number;
  cardCount: number;
}) {
  const theme = pmsStatusTheme(statusKey, statusIndex);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-[272px] shrink-0 flex-col rounded-xl border border-slate-200/60",
        theme.kanbanColumnBg,
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Skeleton className="h-6 w-24 rounded-md bg-slate-200/80" />
        <Skeleton className="ml-auto h-4 w-4 rounded bg-slate-100" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2 pb-2">
        {Array.from({ length: cardCount }, (_, i) => (
          <KanbanCardSkeleton key={i} index={statusIndex * 10 + i} />
        ))}
      </div>
    </section>
  );
}

function KanbanToolbarSkeleton() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 px-4 py-2.5">
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-8 w-[7.5rem] rounded-lg bg-slate-100" />
        <Skeleton className="h-8 w-[9.5rem] rounded-lg bg-slate-100" />
        <Skeleton className="h-8 w-[5.5rem] rounded-lg bg-slate-100" />
        <Skeleton className="h-8 w-[8rem] rounded-lg bg-slate-100" />
        <Skeleton className="h-8 w-[5.5rem] rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

function KanbanColumnsSkeleton() {
  return (
    <div className="flex h-full min-h-[480px] w-max flex-nowrap items-stretch gap-3 pb-2">
      {SKELETON_COLUMNS.map((col, i) => (
        <KanbanColumnSkeleton
          key={col.status}
          statusKey={col.status}
          statusIndex={i}
          cardCount={col.cards}
        />
      ))}
    </div>
  );
}

type Props = {
  /** When true, only renders the column area (toolbar already visible). */
  embedded?: boolean;
};

export function PmsKanbanBoardSkeleton({ embedded = false }: Props) {
  const columnsArea = (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 py-4">
        <KanbanColumnsSkeleton />
      </div>
    </div>
  );

  if (embedded) {
    return columnsArea;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <KanbanToolbarSkeleton />
      {columnsArea}
    </div>
  );
}
