import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

type Props = {
  header?: ReactNode;
  top?: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  children: ReactNode;
  className?: string;
};

/** Card shell: fixed header/chips, scrollable table body only. */
export function LeaveScrollableTableCard({
  header,
  top,
  loading = false,
  loadingMessage = "Loading…",
  children,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {header}
      {top}
      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-12">
          <Loader message={loadingMessage} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
          {children}
        </div>
      )}
    </Card>
  );
}

export const LEAVE_TABLE_HEAD_ROW_CLASS =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95";

export const LEAVE_TABLE_HEAD_CLASS =
  "h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
