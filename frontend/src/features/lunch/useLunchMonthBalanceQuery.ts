import { useQuery } from "@tanstack/react-query";
import { currentMonthKey } from "@/components/lunch/lunchMonthUtils";
import { lunchQueryKeys } from "@/features/lunch/lunchQueryKeys";
import { lunchApi } from "@/lib/lunchApi";

export function useLunchMonthBalanceQuery(month: string = currentMonthKey()) {
  return useQuery({
    queryKey: lunchQueryKeys.monthBalance(month),
    queryFn: () => lunchApi.getMyBalance({ month }),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
