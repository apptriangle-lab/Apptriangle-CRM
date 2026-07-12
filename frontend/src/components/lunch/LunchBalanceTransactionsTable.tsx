import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBdt, formatBalanceBdt, lunchApi, type LunchBalanceTransactionDto } from "@/lib/lunchApi";
import { LUNCH_CARD } from "@/components/lunch/lunchConstants";

export function LunchBalanceTransactionsTable() {
  const [items, setItems] = useState<LunchBalanceTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await lunchApi.getBalanceTransactions();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={cn(LUNCH_CARD, "flex min-h-[120px] items-center justify-center p-6")}>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className={cn(LUNCH_CARD, "overflow-hidden")}>
      <div className="overflow-x-auto scrollbar-table">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/95">
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  No transactions yet
                </td>
              </tr>
            ) : (
              items.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-800" title={tx.reason}>
                    {tx.reason}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    <span className={tx.amount > 0 ? "text-emerald-700" : tx.amount < 0 ? "text-rose-700" : ""}>
                      {formatBdt(tx.amount)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {tx.runningBalance != null ? formatBalanceBdt(tx.runningBalance) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
