import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RfqDetailDto, RfqItemDto } from "@/lib/api";
import { Copy, FilePenLine, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import { rfqInput, rfqPrimaryBtn } from "@/components/rfq/rfq-styles";

/** High-contrast sticky header for the pricing grid (WCAG-friendly on dark band). */
const pricingTableHead =
  "border-b border-indigo-950/30 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-sm dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950";

const pricingCardShell =
  "w-full max-w-none overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_32px_-8px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.04] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]";

const pricingInputFocus =
  "transition-shadow focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/25 dark:focus-visible:border-indigo-400 dark:focus-visible:ring-indigo-400/20";

/** Table body inputs: high contrast text + borders on white/slate row backgrounds */
const pricingTableInput =
  "border-slate-400 bg-white text-slate-950 placeholder:text-slate-500 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400";

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Shown inside empty inputs as gray hint text (previous approved cycle). */
function prevAmountPlaceholder(version: number, n: number | null | undefined): string | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return `v${version}: ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function prevNotePlaceholder(version: number, note: string | undefined): string | undefined {
  const t = note?.trim();
  if (!t) return undefined;
  const short = t.length > 48 ? `${t.slice(0, 45)}…` : t;
  return `v${version}: ${short}`;
}

function prevVatPlaceholder(version: number, pct: number | null | undefined): string | undefined {
  if (pct == null || Number.isNaN(pct)) return undefined;
  return `v${version}: ${pct}%`;
}

function formatRfqDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

const rfqNoQtySpinner =
  "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export type RfqPricingEditorLayout = "full" | "compact";

/** Latest archived cycle (e.g. after reopen) — shown as reference under inputs; optional one-click fill. */
export type PreviousPricingSuggestion = {
  versionNumber: number;
  vatPercent: number | null;
  pricing: RfqItemDto[];
};

type Props = {
  data: RfqDetailDto;
  pricingDraft: Record<string, string>;
  setDraft: (itemId: string, field: "buy" | "prof" | "sell" | "note" | "vat", value: string) => void;
  rbacPricingTotalProfitSum: number;
  busy: boolean;
  onSave: () => void | Promise<void>;
  /** When set, mobile footer shows Submit pricing (RBAC flow). Omit for system-admin-only review. */
  onSubmitPricing?: () => void | Promise<void>;
  layout: RfqPricingEditorLayout;
  /** Shown after RFQ reopen: previous approved line prices + VAT as hints. */
  previousPricingSuggestion?: PreviousPricingSuggestion | null;
  /** Copies previous snapshot into the current draft (optional). */
  onApplyPreviousPricing?: () => void | Promise<void>;
  /** When true (e.g. approved RFQ for system admin review), inputs are read-only and actions hidden. */
  readOnly?: boolean;
};

export function RfqPricingEditorSection({
  data,
  pricingDraft,
  setDraft,
  rbacPricingTotalProfitSum,
  busy,
  onSave,
  onSubmitPricing,
  layout,
  previousPricingSuggestion = null,
  onApplyPreviousPricing,
  readOnly = false,
}: Props) {
  const showSubmit = Boolean(onSubmitPricing) && !readOnly;
  const prevByLineId = useMemo(() => {
    const m = new Map<string, RfqItemDto>();
    for (const row of previousPricingSuggestion?.pricing ?? []) {
      m.set(row.id, row);
    }
    return m;
  }, [previousPricingSuggestion]);

  return (
    <section className={pricingCardShell}>
      {layout === "full" ? (
        <div className="w-full border-b border-slate-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 px-4 py-4 dark:border-slate-800 dark:from-indigo-950/35 dark:via-slate-950 dark:to-violet-950/25 sm:px-6 lg:px-8">
          <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-0">
            {(
              [
                {
                  key: "deal",
                  label: "Deal",
                  node: (
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        {data.deal?.prospect ?? "—"}
                      </span>
                      {data.deal?.status ? (
                        <span className="w-fit rounded-md border border-indigo-200/90 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-950 dark:border-indigo-700/60 dark:bg-indigo-950/60 dark:text-indigo-100">
                          {data.deal.status}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: "customer",
                  label: "Customer",
                  node: (
                    <span className="truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                      {data.customer?.name ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "submitted",
                  label: "Submitted",
                  node: (
                    <span className="text-sm font-semibold tabular-nums tracking-tight text-slate-950 dark:text-slate-50 sm:whitespace-nowrap">
                      {formatRfqDateTime(data.submittedAt)}
                    </span>
                  ),
                },
                {
                  key: "products",
                  label: "Products",
                  node: (
                    <span className="text-sm font-semibold tabular-nums tracking-tight text-slate-950 dark:text-slate-50">
                      {data.items.length}
                    </span>
                  ),
                },
                {
                  key: "requester",
                  label: "Requested by",
                  node: (
                    <span className="flex min-w-0 w-full items-center gap-2">
                      <RfqUserAvatar
                        name={data.createdBy.name}
                        email={data.createdBy.email}
                        size="sm"
                        className="shrink-0 ring-2 ring-white dark:ring-slate-900"
                      />
                      <span
                        className="min-w-0 truncate text-sm font-semibold leading-tight text-slate-950 dark:text-slate-50"
                        title={data.createdBy.email || undefined}
                      >
                        {data.createdBy.name?.trim() || data.createdBy.email || "—"}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "notes",
                  label: "Notes",
                  node: (
                    <span
                      className={cn(
                        "line-clamp-2 break-words text-xs leading-snug",
                        data.notesOverall?.trim()
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                      title={data.notesOverall?.trim() || undefined}
                    >
                      {data.notesOverall?.trim() || "—"}
                    </span>
                  ),
                },
              ] as const
            ).map((seg, i) => (
              <div
                key={seg.key}
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1",
                  i > 0 && "border-t border-slate-200/90 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 dark:border-slate-700/90",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                  {seg.label}
                </span>
                {seg.node}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 bg-slate-100/90 dark:bg-slate-950/90",
          layout === "compact" && "border-t border-slate-200/80 dark:border-slate-800",
        )}
      >
        {previousPricingSuggestion && onApplyPreviousPricing && !readOnly ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-300/80 bg-slate-200/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80 sm:px-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-h-0 gap-1.5 whitespace-normal rounded-lg border border-emerald-800/25 bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700 dark:border-emerald-400/35 dark:from-emerald-600 dark:to-emerald-700"
              disabled={busy}
              onClick={() => void onApplyPreviousPricing()}
            >
              <Copy className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
              <span>
                Use previous{" "}
                <span className="font-mono tabular-nums">(v{previousPricingSuggestion.versionNumber})</span>
              </span>
            </Button>
          </div>
        ) : null}
        <Table maxHeight="min(70vh,560px)">
          <TableHeader className="[&_tr]:border-indigo-950/40 [&_tr]:!bg-transparent dark:[&_tr]:border-slate-800">
            <TableRow className="border-0 hover:bg-transparent">
              {(
                [
                  "#",
                  "Product",
                  "Qty",
                  "Unit buying price",
                  "Unit selling price",
                  "Profit/unit",
                  "Total profit",
                  "VAT %",
                  "Note",
                ] as const
              ).map((h) => (
                <TableHead
                  key={h}
                  className={cn(
                    pricingTableHead,
                    "!text-white !font-bold leading-snug",
                    ["Unit buying price", "Unit selling price", "Profit/unit", "Total profit"].includes(h)
                      ? "max-w-[7rem] whitespace-normal normal-case"
                      : h === "VAT %"
                        ? "w-[6.5rem] max-w-[7rem] whitespace-normal normal-case"
                        : "whitespace-nowrap",
                    h === "Product" && "min-w-[140px] pl-4",
                    h === "#" && "w-10 pl-3",
                  )}
                >
                  {h === "Total profit" ? (
                    `Total profit (${formatMoney(rbacPricingTotalProfitSum)})`
                  ) : h === "Profit/unit" ? (
                    <>
                      Profit/unit{" "}
                      <span className="block text-[9px] font-semibold normal-case tracking-normal text-indigo-200/90">
                        (auto)
                      </span>
                    </>
                  ) : ["Unit buying price", "Unit selling price"].includes(h) ? (
                    <>
                      {h} {!readOnly ? <span className="text-amber-300">*</span> : null}
                    </>
                  ) : h === "VAT %" ? (
                    <>
                      VAT % (line) {!readOnly ? <span className="text-amber-300">*</span> : null}
                    </>
                  ) : (
                    h
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it, idx) => {
              const buyRaw = (pricingDraft[`${it.id}-buy`] ?? "").trim();
              const sellRaw = (pricingDraft[`${it.id}-sell`] ?? "").trim();
              const buy = parseFloat(buyRaw);
              const sell = parseFloat(sellRaw);
              const qty = it.quantity || 0;
              const hasBuySell =
                buyRaw !== "" &&
                sellRaw !== "" &&
                Number.isFinite(buy) &&
                Number.isFinite(sell);
              const lineProfitUnit = hasBuySell ? sell - buy : null;
              const profitInputValue =
                lineProfitUnit != null && Number.isFinite(lineProfitUnit) ? formatMoney(lineProfitUnit) : "";
              const tp =
                Number.isFinite(buy) && Number.isFinite(sell) ? (sell - buy) * qty : 0;
              const prev = prevByLineId.get(it.id);
              const showPrevRow = Boolean(previousPricingSuggestion && prev);
              const pv = previousPricingSuggestion?.versionNumber;
              const buyEmpty = (pricingDraft[`${it.id}-buy`] ?? "").trim() === "";
              const sellEmpty = (pricingDraft[`${it.id}-sell`] ?? "").trim() === "";
              const noteEmpty = (pricingDraft[`${it.id}-note`] ?? "").trim() === "";
              const vatEmpty = (pricingDraft[`${it.id}-vat`] ?? "").trim() === "";
              return (
                <TableRow
                  key={it.id}
                  className={cn(
                    "border-b border-slate-300/90 transition-colors dark:border-slate-700",
                    idx % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-100 dark:bg-slate-900/90",
                    "hover:bg-indigo-50 dark:hover:bg-indigo-950/40",
                  )}
                >
                  <TableCell className="pl-3 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {it.description}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium text-slate-900 dark:text-slate-100">{it.quantity}</TableCell>
                  <TableCell>
                    <Input
                      className={cn(
                        rfqInput,
                        pricingInputFocus,
                        pricingTableInput,
                        "h-9 w-24 rounded-lg",
                        rfqNoQtySpinner,
                        readOnly && "cursor-default border-slate-200/90 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-900/80",
                      )}
                      value={pricingDraft[`${it.id}-buy`] ?? ""}
                      onChange={(e) => setDraft(it.id, "buy", e.target.value)}
                      type="number"
                      step="any"
                      min={0}
                      readOnly={readOnly}
                      required={!readOnly}
                      aria-required={!readOnly}
                      title={showPrevRow && pv != null ? `Previous: ${formatMoney(prev?.unitBuyingPrice)}` : undefined}
                      placeholder={
                        showPrevRow && buyEmpty && pv != null ? prevAmountPlaceholder(pv, prev?.unitBuyingPrice) : undefined
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className={cn(
                        rfqInput,
                        pricingInputFocus,
                        pricingTableInput,
                        "h-9 w-24 rounded-lg",
                        rfqNoQtySpinner,
                        readOnly && "cursor-default border-slate-200/90 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-900/80",
                      )}
                      value={pricingDraft[`${it.id}-sell`] ?? ""}
                      onChange={(e) => setDraft(it.id, "sell", e.target.value)}
                      type="number"
                      step="any"
                      min={0}
                      readOnly={readOnly}
                      required={!readOnly}
                      aria-required={!readOnly}
                      title={showPrevRow && pv != null ? `Previous: ${formatMoney(prev?.unitSellingPrice)}` : undefined}
                      placeholder={
                        showPrevRow && sellEmpty && pv != null ? prevAmountPlaceholder(pv, prev?.unitSellingPrice) : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      aria-label="Profit per unit (calculated from selling minus buying)"
                      title={
                        showPrevRow && pv != null ? `Previous profit/unit: ${formatMoney(prev?.profitPerUnit)}` : undefined
                      }
                      placeholder="—"
                      value={profitInputValue}
                      className={cn(
                        rfqInput,
                        pricingTableInput,
                        "h-9 w-24 cursor-default rounded-lg border-slate-400 bg-slate-100 text-right tabular-nums font-semibold text-slate-900 shadow-inner",
                        "focus-visible:ring-0 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100",
                        readOnly &&
                          "border-slate-200/90 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-900/80",
                        !readOnly &&
                          lineProfitUnit != null &&
                          lineProfitUnit > 0 &&
                          "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200",
                        !readOnly &&
                          lineProfitUnit != null &&
                          lineProfitUnit < 0 &&
                          "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100",
                      )}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm tabular-nums font-bold",
                      tp > 0 ? "text-emerald-900 dark:text-emerald-200" : "text-slate-800 dark:text-slate-200",
                    )}
                  >
                    {formatMoney(tp)}
                  </TableCell>
                  <TableCell>
                    <Input
                      className={cn(
                        rfqInput,
                        pricingInputFocus,
                        pricingTableInput,
                        "h-9 w-[5.25rem] rounded-lg",
                        rfqNoQtySpinner,
                        readOnly && "cursor-default border-slate-200/90 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-900/80",
                      )}
                      value={pricingDraft[`${it.id}-vat`] ?? ""}
                      onChange={(e) => setDraft(it.id, "vat", e.target.value)}
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      readOnly={readOnly}
                      required={!readOnly}
                      aria-required={!readOnly}
                      aria-label={`VAT percent for line ${idx + 1}`}
                      title={showPrevRow && pv != null ? `Previous VAT: ${prev?.vatPercent ?? "—"}%` : undefined}
                      placeholder={
                        showPrevRow && vatEmpty && pv != null ? prevVatPlaceholder(pv, prev?.vatPercent) : undefined
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className={cn(
                        rfqInput,
                        pricingInputFocus,
                        pricingTableInput,
                        "h-9 w-36 min-w-[6rem] rounded-lg",
                        readOnly && "cursor-default border-slate-200/90 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-900/80",
                      )}
                      value={pricingDraft[`${it.id}-note`] ?? ""}
                      onChange={(e) => setDraft(it.id, "note", e.target.value)}
                      readOnly={readOnly}
                      placeholder={
                        showPrevRow && noteEmpty && pv != null
                          ? prevNotePlaceholder(pv, prev?.lineNote) ?? "Note"
                          : "Note"
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200/80 bg-gradient-to-r from-slate-50/95 to-indigo-50/45 px-6 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950/35 lg:hidden">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-slate-300/90 bg-white font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            disabled={busy}
            onClick={() => void onSave()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <FilePenLine className="mr-2 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
            )}
            Draft
          </Button>
          {showSubmit ? (
            <Button className={cn(rfqPrimaryBtn, "flex-1")} disabled={busy} onClick={() => void onSubmitPricing?.()}>
              Submit pricing
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
