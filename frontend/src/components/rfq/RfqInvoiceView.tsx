import type { RfqDetailDto, RfqItemDto } from "@/lib/api";
import { amountToWordsTaka } from "@/lib/numberToWords";
import { cn } from "@/lib/utils";
import { RfqInvoiceLinesTable } from "@/components/rfq/RfqInvoiceLinesTable";

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type RfqInvoiceSnapshotTotals = {
  sub: number;
  vat: number;
  total: number;
  vatPercent: number;
};

/** Outer shell for the live invoice and archived invoice snapshots (same card). */
export const rfqInvoiceSectionClassName = cn(
  "overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12),0_12px_48px_-12px_rgba(79,70,229,0.15)]",
  "dark:border-slate-700/90 dark:bg-slate-950 dark:shadow-[0_4px_32px_-4px_rgba(0,0,0,0.45),0_0_0_1px_rgba(99,102,241,0.12)]",
);

type SnapshotProps = {
  items: RfqItemDto[];
  rfqVat: number | null | undefined;
  notesOverall?: string | null;
  invoiceTotals: RfqInvoiceSnapshotTotals;
  /** Tighter line table when space is limited. */
  compactTable?: boolean;
};

/** Line items + notes + amount in words + totals — shared by live invoice and history. */
export function RfqInvoiceSnapshot({ items, rfqVat, notesOverall, invoiceTotals, compactTable = false }: SnapshotProps) {
  return (
    <>
      <RfqInvoiceLinesTable items={items} rfqVat={rfqVat} compact={compactTable} />

      <div className="grid gap-6 bg-gradient-to-b from-slate-50/90 to-white px-5 py-6 sm:px-8 lg:grid-cols-[1fr_minmax(0,20rem)] lg:gap-10 dark:from-slate-950 dark:to-slate-950/95">
        <div className="min-w-0 space-y-4">
          {notesOverall?.trim() ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{notesOverall.trim()}</p>
            </div>
          ) : null}
          <div className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/50 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Amount in words</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">{amountToWordsTaka(invoiceTotals.total)}</p>
          </div>
        </div>

        <div className="lg:justify-self-end">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6",
              "border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 via-white to-violet-50/80",
              "shadow-inner shadow-indigo-500/10 dark:border-indigo-800/60 dark:from-indigo-950/60 dark:via-slate-900 dark:to-violet-950/40 dark:shadow-indigo-900/20",
            )}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10" aria-hidden />
            <div className="relative space-y-3.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-400">Subtotal</span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatMoney(invoiceTotals.sub)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span
                  className="font-medium text-slate-600 dark:text-slate-400"
                  title={
                    invoiceTotals.sub > 0
                      ? `Weighted average rate ≈ ${invoiceTotals.vatPercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}% (lines may differ)`
                      : undefined
                  }
                >
                  VAT
                </span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatMoney(invoiceTotals.vat)}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent dark:via-indigo-600/50" />
              <div className="flex items-end justify-between gap-4 pt-1">
                <span className="text-sm font-bold uppercase tracking-wide text-indigo-950 dark:text-indigo-100">Total due</span>
                <span className="tabular-nums text-2xl font-extrabold tracking-tight text-indigo-800 dark:text-white">
                  {formatMoney(invoiceTotals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type Props = {
  data: RfqDetailDto;
  invoiceTotals: RfqInvoiceSnapshotTotals;
};

export function RfqInvoiceView({ data, invoiceTotals }: Props) {
  return (
    <section className={rfqInvoiceSectionClassName}>
      <RfqInvoiceSnapshot
        items={data.items}
        rfqVat={data.vatPercent}
        notesOverall={data.notesOverall}
        invoiceTotals={invoiceTotals}
      />
    </section>
  );
}
