import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  tabs: ReactNode;
  toolbar?: ReactNode;
  className?: string;
};

/** PMS-style hub row: tabs left, optional filters/actions right. */
export function AttendanceHubHeader({ tabs, toolbar, className }: Props) {
  return (
    <div
      className={cn(
        "flex h-[52px] shrink-0 flex-nowrap items-center justify-between gap-3 px-1 sm:px-0",
        className,
      )}
    >
      <div className="shrink-0">{tabs}</div>
      {toolbar ? (
        <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto scrollbar-thinner">
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
