import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { rfqApi, type RfqHistoryResponseDto, type RfqHistoryVersionDto } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { rfqCard } from "@/components/rfq/rfq-styles";
import { formatHistoryWhen } from "@/lib/rfqHistoryFormat";
import { lineVatAmountForInvoiceLine } from "@/lib/rfqInvoiceLine";
import { RfqInvoiceSnapshot, rfqInvoiceSectionClassName, type RfqInvoiceSnapshotTotals } from "@/components/rfq/RfqInvoiceView";

function formatMoneyShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  rfqId: string;
  /** When false, skip fetch (e.g. first RFQ version with no archived cycles). */
  enabled: boolean;
};

function archivedInvoiceItems(v: RfqHistoryVersionDto) {
  const inv = v.invoice;
  if (inv?.items?.length) return inv.items;
  return v.pricing ?? [];
}

function archivedInvoiceVat(v: RfqHistoryVersionDto) {
  return v.invoice?.vatPercent ?? v.vatPercent;
}

function archivedInvoiceTotals(v: RfqHistoryVersionDto): RfqInvoiceSnapshotTotals {
  const inv = v.invoice;
  if (inv) {
    const sub = inv.subtotal;
    const vat = inv.vatAmount;
    const total = inv.totalAmount;
    const vatPct =
      inv.vatPercent != null && Number.isFinite(inv.vatPercent)
        ? inv.vatPercent
        : sub > 0
          ? (vat / sub) * 100
          : 0;
    return { sub, vat, total, vatPercent: vatPct };
  }
  const items = v.pricing ?? [];
  const rfqVat = v.vatPercent;
  let sub = 0;
  let vat = 0;
  for (const it of items) {
    const ext = (it.unitSellingPrice ?? 0) * (it.quantity || 0);
    sub += ext;
    vat += lineVatAmountForInvoiceLine(it, rfqVat);
  }
  const effPct = sub > 0 ? (vat / sub) * 100 : 0;
  return { sub, vat, total: sub + vat, vatPercent: effPct };
}

/**
 * Previous approved cycles: each version is shown as the same invoice layout as the current RFQ invoice (no separate pricing grid).
 */
export function RfqHistoryArchiveSection({ rfqId, enabled }: Props) {
  const [state, setState] = useState<RfqHistoryResponseDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !rfqId) {
      setState(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await rfqApi.history(rfqId);
        if (!cancelled) setState(data);
      } catch {
        if (!cancelled) setState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rfqId, enabled]);

  if (!enabled) return null;

  if (loading) {
    return (
      <section
        className={cn(
          rfqCard,
          "flex items-center gap-3 border-slate-200/90 px-5 py-4 dark:border-slate-700",
        )}
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading history…</span>
      </section>
    );
  }

  const versions = state?.versions ?? [];
  if (versions.length === 0) return null;

  return (
    <Accordion type="multiple" className="space-y-4">
      {versions.map((v) => {
        const items = archivedInvoiceItems(v);
        const rfqVat = archivedInvoiceVat(v);
        const totals = archivedInvoiceTotals(v);
        return (
          <AccordionItem
            key={v.versionNumber}
            value={`archived-v${v.versionNumber}`}
            className={cn(rfqInvoiceSectionClassName, "border-b-0")}
          >
            <AccordionTrigger
              className={cn(
                "gap-3 px-4 py-4 text-left hover:no-underline sm:px-6",
                "[&[data-state=open]]:border-b [&[data-state=open]]:border-slate-200/80 dark:[&[data-state=open]]:border-slate-800/80",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="shrink-0 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
                    v{v.versionNumber}
                  </span>
                  {v.approvedAt ? (
                    <time className="text-xs tabular-nums text-slate-500 dark:text-slate-400" dateTime={v.approvedAt}>
                      Approved {formatHistoryWhen(v.approvedAt)}
                    </time>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-baseline gap-2 sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Total due
                  </span>
                  <span className="tabular-nums text-base font-bold text-indigo-800 dark:text-indigo-200">
                    {formatMoneyShort(totals.total)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-0 px-0 pb-0 pt-0 sm:px-0">
              {items.length > 0 ? (
                <RfqInvoiceSnapshot items={items} rfqVat={rfqVat} invoiceTotals={totals} />
              ) : (
                <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No invoice lines for this version.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
