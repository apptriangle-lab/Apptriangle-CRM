import { useQuery } from "@tanstack/react-query";
import { currentMonthKey, dhakaTodayIso } from "@/components/lunch/lunchMonthUtils";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { lunchApi, type LunchSnapshotDto } from "@/lib/lunchApi";

export function fetchLunchSnapshot(date?: string, month?: string): Promise<LunchSnapshotDto> {
  const d = date ?? dhakaTodayIso();
  const m = month ?? currentMonthKey();
  return lunchApi.getSnapshot({ date: d, month: m });
}

/** Single source of truth for the user lunch page. */
export function useLunchSnapshotQuery(date?: string, month?: string) {
  const d = date ?? dhakaTodayIso();
  const m = month ?? currentMonthKey();
  return useQuery({
    queryKey: lunchQueryKeys.snapshot(d, m),
    queryFn: () => fetchLunchSnapshot(d, m),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
