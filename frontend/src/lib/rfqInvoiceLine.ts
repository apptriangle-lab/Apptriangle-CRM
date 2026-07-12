import type { RfqItemDto } from "@/lib/api";

export const DEFAULT_RFQ_VAT_PERCENT = 5;

export function parseDraftVatPercent(draft: Record<string, string>, itemId: string): number | null {
  const t = (draft[`${itemId}-vat`] ?? "").trim();
  if (t === "") return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Stored line + RFQ fallback (invoice when item already carries resolved `vatPercent`). */
export function resolvedVatPercentForInvoiceLine(
  it: RfqItemDto,
  rfqVat: number | null | undefined,
): number {
  if (it.vatPercent != null && Number.isFinite(it.vatPercent)) return it.vatPercent;
  if (rfqVat != null && Number.isFinite(rfqVat)) return rfqVat;
  return DEFAULT_RFQ_VAT_PERCENT;
}

/** Draft → line → RFQ → default (same order as pricing save + backend). */
export function lineVatPercentResolved(
  it: RfqItemDto,
  draft: Record<string, string>,
  rfqVat: number | null | undefined,
): number {
  const fromDraft = parseDraftVatPercent(draft, it.id);
  if (fromDraft != null && fromDraft >= 0 && fromDraft <= 100) return fromDraft;
  return resolvedVatPercentForInvoiceLine(it, rfqVat);
}

export function lineExtendedSell(it: RfqItemDto): number {
  return (it.unitSellingPrice ?? 0) * (it.quantity || 0);
}

export function lineVatAmountForInvoiceLine(it: RfqItemDto, rfqVat: number | null | undefined): number {
  const ext = lineExtendedSell(it);
  const pct = resolvedVatPercentForInvoiceLine(it, rfqVat);
  return ext * (pct / 100);
}

export function formatVatPercentDisplay(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}
