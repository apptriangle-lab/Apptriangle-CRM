import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RfqItemDto } from "@/lib/api";
import {
  formatVatPercentDisplay,
  lineVatAmountForInvoiceLine,
  resolvedVatPercentForInvoiceLine,
} from "@/lib/rfqInvoiceLine";
import { cn } from "@/lib/utils";

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const thBase =
  "border-0 border-b-2 border-orange-300/85 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/95 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-stone-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)] dark:border-emerald-700/60 dark:bg-gradient-to-r dark:from-teal-900 dark:via-teal-950 dark:to-emerald-950 dark:text-emerald-50 dark:shadow-none";

const invCol = "w-[calc(100%/6)] min-w-0";

type Props = {
  items: RfqItemDto[];
  rfqVat: number | null | undefined;
  /** Tighter padding for accordion previews. */
  compact?: boolean;
  className?: string;
};

/** Same columns as the main RFQ invoice: Product, Unit price, Qty, Line VAT, VAT %, Line total. */
export function RfqInvoiceLinesTable({ items, rfqVat, compact = false, className }: Props) {
  const py = compact ? "py-2" : "py-3.5";
  const th = cn(thBase, compact ? "py-2" : "py-3.5");

  return (
    <div className={cn("overflow-x-auto border-b border-slate-200/70 dark:border-slate-800/80", className)}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className={cn(th, invCol, "pl-6 sm:pl-8")}>Product</TableHead>
            <TableHead className={cn(th, invCol, "text-right")}>Unit price</TableHead>
            <TableHead className={cn(th, invCol, "text-right")}>Qty</TableHead>
            <TableHead className={cn(th, invCol, "text-right")}>Line VAT</TableHead>
            <TableHead className={cn(th, invCol, "text-right")}>VAT %</TableHead>
            <TableHead className={cn(th, invCol, "pr-6 text-right sm:pr-8")}>Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, idx) => {
            const unit = it.unitSellingPrice ?? 0;
            const line = unit * (it.quantity || 0);
            const vatPct = resolvedVatPercentForInvoiceLine(it, rfqVat);
            const lineVat = lineVatAmountForInvoiceLine(it, rfqVat);
            return (
              <TableRow
                key={it.id}
                className={cn(
                  "border-slate-100 transition-colors dark:border-slate-800/90",
                  idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/80 dark:bg-slate-900/35",
                  "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25",
                )}
              >
                <TableCell className={cn(invCol, "break-words pl-6 text-sm font-semibold text-slate-900 sm:pl-8 dark:text-slate-100", py)}>
                  {it.description}
                </TableCell>
                <TableCell className={cn(invCol, "text-right text-sm tabular-nums font-medium text-slate-800 dark:text-slate-200", py)}>
                  {formatMoney(unit)}
                </TableCell>
                <TableCell className={cn(invCol, "text-right text-sm tabular-nums text-slate-600 dark:text-slate-400", py)}>
                  {it.quantity}
                </TableCell>
                <TableCell className={cn(invCol, "text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100", py)}>
                  {formatMoney(lineVat)}
                </TableCell>
                <TableCell className={cn(invCol, "text-right text-sm tabular-nums font-medium text-slate-700 dark:text-slate-300", py)}>
                  {formatVatPercentDisplay(vatPct)}
                </TableCell>
                <TableCell className={cn(invCol, "pr-6 text-right text-sm font-bold tabular-nums text-slate-900 sm:pr-8 dark:text-white", py)}>
                  {formatMoney(line)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
