import { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { PmsResourceOverviewDto } from "@/lib/pmsApi";
import { formatResourceRangeMonthLabel } from "@/utils/pmsResourceDates";
import { ResourceUserRow } from "@/components/pms/resource/ResourceUserRow";
import { ResourceUserTableSkeleton } from "@/components/pms/resource/ResourceUserTableSkeleton";
import { RESOURCE_USER_TABLE_GRID_CLASS } from "@/components/pms/resource/resourceContributionDays";
import { cn } from "@/lib/utils";

type Props = {
  data?: PmsResourceOverviewDto;
  filterFrom?: string;
  filterTo?: string;
  loading?: boolean;
  fetched?: boolean;
  onTaskClick?: (taskId: string) => void;
};

const CARD_SHELL = "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm";

export function ResourceUserTable({ data, filterFrom, filterTo, loading, fetched, onTaskClick }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((userId: string, open: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  if (loading) {
    return <ResourceUserTableSkeleton />;
  }

  if (!fetched) {
    return (
      <div className={cn(CARD_SHELL, "items-center justify-center")}>
        <EmptyState
          icon={Users}
          title="Resource planning"
          description="Select a date range and click Apply to see all project assignees."
        />
      </div>
    );
  }

  if (!data?.users.length) {
    return (
      <div className={cn(CARD_SHELL, "items-center justify-center")}>
        <EmptyState
          icon={Users}
          title="No assignees found"
          description="No users match the selected filters for this date range."
        />
      </div>
    );
  }

  const displayFrom = filterFrom ?? data?.from ?? "";
  const displayTo = filterTo ?? data?.to ?? "";
  const monthLabel = displayFrom && displayTo ? formatResourceRangeMonthLabel(displayFrom, displayTo) : "";

  return (
    <div className={CARD_SHELL}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {data.summary.userCount} assignee{data.summary.userCount === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.summary.taskCount} task{data.summary.taskCount === 1 ? "" : "s"} in range
            {monthLabel ? ` · ${monthLabel}` : null} · {displayFrom} → {displayTo}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-table">
        <div className={RESOURCE_USER_TABLE_GRID_CLASS}>
          {data.users.map((user) => (
            <ResourceUserRow
              key={user.userId}
              user={user}
              from={displayFrom}
              to={displayTo}
              expanded={expandedIds.has(user.userId)}
              onExpandedChange={(open) => toggleExpanded(user.userId, open)}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
