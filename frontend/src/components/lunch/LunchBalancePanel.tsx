import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBdt, formatBalanceBdt, lunchApi, type LunchBalanceTransactionDto } from "@/lib/lunchApi";
import { LUNCH_CARD } from "@/components/lunch/lunchConstants";

type Props = {
  balance?: number;
  onBalanceChange?: (balance: number) => void;
};

export function LunchBalancePanel({ balance: balanceProp, onBalanceChange }: Props) {
  const [balance, setBalance] = useState(balanceProp ?? 0);
  const [items, setItems] = useState<LunchBalanceTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bal, tx] = await Promise.all([lunchApi.getMyBalance(), lunchApi.getBalanceTransactions()]);
      setBalance(bal.balance);
      onBalanceChange?.(bal.balance);
      setItems(tx.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load balance");
    } finally {
      setLoading(false);
    }
  }, [onBalanceChange]);

  useEffect(() => {
    if (balanceProp !== undefined) setBalance(balanceProp);
  }, [balanceProp]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && items.length === 0) {
    return (
      <div className={cn(LUNCH_CARD, "flex min-h-[200px] items-center justify-center p-8")}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(LUNCH_CARD, "relative overflow-hidden p-6")}>
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-100/60" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Current lunch balance</p>
            <p
              className={cn(
                "text-3xl font-bold tabular-nums tracking-tight",
                balance < 0 ? "text-rose-700" : balance > 0 ? "text-emerald-700" : "text-slate-900",
              )}
            >
              {formatBalanceBdt(balance)}
            </p>
          </div>
        </div>
      </div>

      <div className={cn(LUNCH_CARD, "overflow-hidden")}>
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-slate-800">Transaction history</h3>
        </div>
        <div className="overflow-x-auto scrollbar-table">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/95">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No transactions yet
                  </td>
                </tr>
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy HH:mm") : "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-slate-800" title={tx.reason}>
                      {tx.reason}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      <span className={tx.amount > 0 ? "text-emerald-700" : tx.amount < 0 ? "text-rose-700" : ""}>
                        {formatBdt(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {tx.runningBalance != null ? formatBalanceBdt(tx.runningBalance) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
