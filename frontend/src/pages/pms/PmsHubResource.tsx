import { useEffect, useMemo, useState } from "react";
import { usePmsHubToolbarSlot } from "@/contexts/PmsHubToolbarContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { pmsApi } from "@/lib/pmsApi";
import type { PmsDateRange } from "@/components/pms/PmsTaskDatePicker";
import {
  buildDefaultResourceRange,
  ResourceFilterBar,
  type ResourceUserFilter,
} from "@/components/pms/resource/ResourceFilterBar";
import { ResourceUserTable } from "@/components/pms/resource/ResourceUserTable";
import { mergeResourceDateRanges } from "@/components/pms/resource/resourceContributionDays";
import { formatResourceApiDate } from "@/utils/pmsResourceDates";

export default function PmsHubResource() {
  const { user } = useAuth();
  const { openTask } = usePmsTaskModal();

  const [range, setRange] = useState<PmsDateRange>(buildDefaultResourceRange);
  const [userFilter, setUserFilter] = useState<ResourceUserFilter>("all");

  const activeRange = useMemo(() => {
    if (!range.startDate || !range.endDate) return null;
    const from = formatResourceApiDate(range.startDate);
    const to = formatResourceApiDate(range.endDate);
    if (from > to) return null;
    return { from, to };
  }, [range]);

  const fetchRange = useMemo(() => {
    if (!activeRange) return null;
    return mergeResourceDateRanges(activeRange);
  }, [activeRange]);

  const activityQuery = useQuery({
    queryKey: ["pms-resources-overview", fetchRange?.from, fetchRange?.to, activeRange?.from, activeRange?.to],
    queryFn: () =>
      pmsApi.getResourceOverview({
        from: fetchRange!.from,
        to: fetchRange!.to,
      }),
    enabled: Boolean(fetchRange),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (!activityQuery.data || userFilter === "all") return;
    const userId = userFilter === "me" ? user?.id : userFilter;
    if (!userId || !activityQuery.data.users.some((u) => u.userId === userId)) {
      setUserFilter("all");
    }
  }, [activityQuery.data, userFilter, user?.id]);

  const filteredData = useMemo(() => {
    const data = activityQuery.data;
    if (!data || userFilter === "all") return data;

    const userId = userFilter === "me" ? user?.id : userFilter;
    if (!userId) return data;

    const users = data.users.filter((u) => u.userId === userId);
    return {
      ...data,
      users,
      summary: {
        userCount: users.length,
        taskCount: users.reduce((sum, u) => sum + u.taskCount, 0),
      },
    };
  }, [activityQuery.data, userFilter, user?.id]);

  useEffect(() => {
    if (activityQuery.isError) {
      toast.error(
        activityQuery.error instanceof Error
          ? activityQuery.error.message
          : "Failed to load resource activity",
      );
    }
  }, [activityQuery.isError, activityQuery.error]);

  const loading = activityQuery.isFetching && Boolean(activeRange);

  const toolbar = useMemo(
    () => (
      <ResourceFilterBar
        range={range}
        onRangeChange={setRange}
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        users={activityQuery.data?.users}
        currentUserId={user?.id}
      />
    ),
    [
      range,
      userFilter,
      activityQuery.data?.users,
      user?.id,
    ],
  );

  usePmsHubToolbarSlot(toolbar);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ResourceUserTable
        data={filteredData}
        filterFrom={activeRange?.from}
        filterTo={activeRange?.to}
        loading={loading && !activityQuery.data}
        fetched={Boolean(activeRange)}
        onTaskClick={openTask}
      />
    </div>
  );
}
