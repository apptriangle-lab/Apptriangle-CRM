import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRbac } from "@/contexts/RbacContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  rfqApi,
  type RfqDetailDto,
  type RfqDealOption,
  type RfqHistoryVersionDto,
  type RfqItemDto,
  type RfqRbacAdminOption,
} from "@/lib/api";
import { downloadRfqInvoicePdf } from "@/lib/rfqInvoicePdf";
import { DEFAULT_RFQ_VAT_PERCENT, lineVatPercentResolved } from "@/lib/rfqInvoiceLine";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Download,
  Plus,
  Trash2,
  ChevronsUpDown,
  FilePenLine,
  FileUser,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RfqReopenedChip, RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import { RfqInvoiceView } from "@/components/rfq/RfqInvoiceView";
import { RfqPricingEditorSection } from "@/components/rfq/RfqPricingEditorSection";
import { RfqHistoryArchiveSection } from "@/components/rfq/RfqHistoryArchiveSection";
import {
  rfqPageShell,
  rfqPageInner,
  rfqPageGutter,
  rfqPageContentY,
  rfqCard,
  rfqCardHeaderFlush,
  rfqCardBody,
  rfqEyebrow,
  rfqSectionTitle,
  rfqBody,
  rfqInput,
  rfqStickyBar,
  rfqPanel,
  rfqTableWrap,
  rfqTableHead,
  rfqTableHeadNeutral,
} from "@/components/rfq/rfq-styles";

function vatPercentFromDraftForPatch(draft: Record<string, string>, itemId: string): number | null {
  const v = parseFloat((draft[`${itemId}-vat`] ?? "").trim());
  return Number.isFinite(v) ? v : null;
}

type RfqRequestLine = { description: string; quantity: string };

/** Hide browser stepper arrows on number inputs (Chrome / Safari / Edge / Firefox). */
const rfqNoQtySpinner =
  "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Profit/unit string from buying and selling (selling − buying). */
function profitPerUnitFromBuySell(buy: number, sell: number): string {
  const p = sell - buy;
  if (!Number.isFinite(p)) return "";
  return String(Number(p.toFixed(10)));
}

/** Buy + sell required; profit/unit is derived (sell − buy) and must stay in sync. Line note is optional. */
function getPricingDraftValidationError(
  items: RfqDetailDto["items"],
  draft: Record<string, string>,
): string | null {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const buyS = (draft[`${it.id}-buy`] ?? "").trim();
    const sellS = (draft[`${it.id}-sell`] ?? "").trim();
    const buy = parseFloat(buyS);
    const sell = parseFloat(sellS);
    const n = i + 1;
    if (!buyS) return `Product ${n}: unit buying price is required`;
    if (!Number.isFinite(buy) || buy < 0) return `Product ${n}: enter a valid unit buying price`;
    if (!sellS) return `Product ${n}: unit selling price is required`;
    if (!Number.isFinite(sell) || sell < 0) return `Product ${n}: enter a valid unit selling price`;
    const expectedProfit = sell - buy;
    if (!Number.isFinite(expectedProfit)) return `Product ${n}: could not compute profit per unit`;
    const profS = (draft[`${it.id}-prof`] ?? "").trim();
    if (profS) {
      const prof = parseFloat(profS);
      if (Number.isFinite(prof) && Math.abs(prof - expectedProfit) > 0.02) {
        return `Product ${n}: profit per unit must equal unit selling price minus unit buying price`;
      }
    }
    const vatS = (draft[`${it.id}-vat`] ?? "").trim();
    if (!vatS) return `Product ${n}: VAT % is required`;
    const vat = parseFloat(vatS);
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      return `Product ${n}: VAT % must be between 0 and 100`;
    }
  }
  return null;
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Skeleton className="hidden h-12 w-1.5 shrink-0 rounded-full sm:block" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-8 w-2/3 max-w-md rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function RfqDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { canAccessModule, isPageScopeAdmin } = useRbac();
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [data, setData] = useState<RfqDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pricingDraft, setPricingDraft] = useState<Record<string, string>>({});
  const [requestEditNotes, setRequestEditNotes] = useState("");
  const [requestLines, setRequestLines] = useState<RfqRequestLine[]>([{ description: "", quantity: "0" }]);
  const [requestAssigneeOpen, setRequestAssigneeOpen] = useState(false);
  const [rbacAdmins, setRbacAdmins] = useState<RfqRbacAdminOption[]>([]);
  const [rbacAdminsLoading, setRbacAdminsLoading] = useState(false);
  const [requestAssignee, setRequestAssignee] = useState<RfqRbacAdminOption | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [deals, setDeals] = useState<RfqDealOption[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<RfqDealOption | null>(null);
  /** Latest archived cycle (immediate predecessor) — hints for pricing after reopen. */
  const [previousPricingSuggestion, setPreviousPricingSuggestion] = useState<RfqHistoryVersionDto | null>(null);

  const loadDeals = useCallback(async (q: string) => {
    setDealsLoading(true);
    try {
      const list = await rfqApi.searchDeals(q, undefined, data?.id);
      setDeals(list);
    } catch {
      setDeals([]);
    } finally {
      setDealsLoading(false);
    }
  }, [data?.id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await rfqApi.get(id);
      setData(d);
      const next: Record<string, string> = {};
      for (const it of d.items ?? []) {
        next[`${it.id}-buy`] = it.unitBuyingPrice != null ? String(it.unitBuyingPrice) : "";
        next[`${it.id}-prof`] = it.profitPerUnit != null ? String(it.profitPerUnit) : "";
        next[`${it.id}-sell`] = it.unitSellingPrice != null ? String(it.unitSellingPrice) : "";
        next[`${it.id}-note`] = it.lineNote ?? "";
        const lineV =
          it.vatPercent != null && Number.isFinite(it.vatPercent)
            ? it.vatPercent
            : d.vatPercent != null && Number.isFinite(d.vatPercent)
              ? d.vatPercent
              : DEFAULT_RFQ_VAT_PERCENT;
        next[`${it.id}-vat`] = String(lineV);
      }
      let prevSuggestion: RfqHistoryVersionDto | null = null;
      if ((d.versionNumber ?? 1) > 1) {
        try {
          const h = await rfqApi.history(d.id);
          prevSuggestion = h.versions[0] ?? null;
        } catch {
          prevSuggestion = null;
        }
      }
      setPricingDraft(next);
      setPreviousPricingSuggestion(prevSuggestion);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRbacAdminsLoading(true);
      try {
        const list = await rfqApi.listRfqRbacAdmins();
        if (!cancelled) setRbacAdmins(list);
      } catch {
        if (!cancelled) setRbacAdmins([]);
      } finally {
        if (!cancelled) setRbacAdminsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadDeals(dealSearch), 300);
    return () => clearTimeout(t);
  }, [dealSearch, loadDeals]);

  const canSystemApprove = user?.role === "admin";
  const isSystemAdminApprovalPricing = !!data && data.status === "pending_system" && canSystemApprove;
  /** After approval: global admin can still view pricing grid under invoice (read-only). */
  const showSystemAdminApprovedPricingReadonly =
    !!data && data.status === "approved" && canSystemApprove;

  const invoiceTotals = useMemo(() => {
    if (!data?.items?.length) {
      return { sub: 0, vat: 0, total: 0, vatPercent: 0 };
    }
    let sub = 0;
    let vat = 0;
    for (const it of data.items) {
      let price = it.unitSellingPrice ?? 0;
      if (isSystemAdminApprovalPricing) {
        const s = pricingDraft[`${it.id}-sell`]?.trim();
        if (s !== "") {
          const p = parseFloat(s);
          if (Number.isFinite(p)) price = p;
        }
      }
      const qty = it.quantity || 0;
      const ext = price * qty;
      const pct = lineVatPercentResolved(it, pricingDraft, data.vatPercent);
      sub += ext;
      vat += ext * (pct / 100);
    }
    const effPct = sub > 0 ? (vat / sub) * 100 : 0;
    return { sub, vat, total: sub + vat, vatPercent: effPct };
  }, [data, pricingDraft, isSystemAdminApprovalPricing]);

  /** Invoice preview uses draft selling prices while system admin adjusts pricing before approval. */
  const invoiceDisplayData = useMemo((): RfqDetailDto | null => {
    if (!data) return null;
    if (!isSystemAdminApprovalPricing) return data;
    return {
      ...data,
      items: data.items.map((it) => {
        const sellS = pricingDraft[`${it.id}-sell`]?.trim();
        let unitSellingPrice = it.unitSellingPrice ?? 0;
        if (sellS !== "") {
          const p = parseFloat(sellS);
          if (Number.isFinite(p)) unitSellingPrice = p;
        }
        const vp = lineVatPercentResolved(it, pricingDraft, data.vatPercent);
        return { ...it, unitSellingPrice, vatPercent: vp };
      }),
      vatPercent: null,
    };
  }, [data, isSystemAdminApprovalPricing, pricingDraft]);

  /** Sum of per-line total profit (qty × (sell − buy)) for the pricing grid header. */
  const rbacPricingTotalProfitSum = useMemo(() => {
    if (!data?.items?.length) return 0;
    return data.items.reduce((sum, it) => {
      const buy = parseFloat(pricingDraft[`${it.id}-buy`] || "");
      const sell = parseFloat(pricingDraft[`${it.id}-sell`] || "");
      const qty = it.quantity || 0;
      if (!Number.isFinite(buy) || !Number.isFinite(sell)) return sum;
      return sum + (sell - buy) * qty;
    }, 0);
  }, [data, pricingDraft]);

  /** Current deal in list results, or prepend row from loaded RFQ so selection stays valid. */
  const dealEditOptions = useMemo(() => {
    if (!data) return deals;
    const sid = data.salesId;
    if (!sid || deals.some((d) => d.salesId === sid)) return deals;
    return [
      {
        salesId: data.salesId,
        prospect: data.deal?.prospect ?? "—",
        companyId: data.companyId,
        companyName: data.customer?.name ?? "",
        hasExistingRfq: false,
      },
      ...deals,
    ];
  }, [data, deals]);

  /** Include current assignee in the combobox if they are no longer in the RBAC admin list. */
  const rbacAssigneeOptions = useMemo(() => {
    if (!data) return rbacAdmins;
    const aid = data.pricingAssigneeUserId?.trim();
    const p = data.pricingAssignee;
    if (!aid || !p?.id || rbacAdmins.some((a) => a.id === aid)) return rbacAdmins;
    return [
      { id: p.id, name: p.name, email: p.email, profilePicture: p.profilePicture },
      ...rbacAdmins,
    ];
  }, [data, rbacAdmins]);

  const setDraft = (itemId: string, field: "buy" | "prof" | "sell" | "note" | "vat", value: string) => {
    setPricingDraft((prev) => {
      const next: Record<string, string> = { ...prev, [`${itemId}-${field}`]: value };
      if (field === "note" || field === "vat") return next;
      if (field === "buy" || field === "sell") {
        const buyStr = field === "buy" ? value : prev[`${itemId}-buy`] ?? "";
        const sellStr = field === "sell" ? value : prev[`${itemId}-sell`] ?? "";
        const buy = parseFloat(buyStr);
        const sell = parseFloat(sellStr);
        if (
          buyStr.trim() !== "" &&
          sellStr.trim() !== "" &&
          Number.isFinite(buy) &&
          Number.isFinite(sell)
        ) {
          next[`${itemId}-prof`] = profitPerUnitFromBuySell(buy, sell);
        } else {
          next[`${itemId}-prof`] = "";
        }
      }
      return next;
    });
  };

  const savePricing = async () => {
    if (!data) return;
    const err = getPricingDraftValidationError(data.items, pricingDraft);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const items = data.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitBuyingPrice: parseFloat(pricingDraft[`${it.id}-buy`] || "") || null,
        profitPerUnit: parseFloat(pricingDraft[`${it.id}-prof`] || "") || null,
        unitSellingPrice: parseFloat(pricingDraft[`${it.id}-sell`] || "") || null,
        lineNote: pricingDraft[`${it.id}-note`] || undefined,
        vatPercent: vatPercentFromDraftForPatch(pricingDraft, it.id),
      }));
      const updated = await rfqApi.patch(data.id, { items, vatPercent: null, saveAsDraft: true });
      setData(updated);
      toast.success("Saved as draft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const submitPricingFlow = async () => {
    if (!data) return;
    const err = getPricingDraftValidationError(data.items, pricingDraft);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const items = data.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitBuyingPrice: parseFloat(pricingDraft[`${it.id}-buy`] || "") || null,
        profitPerUnit: parseFloat(pricingDraft[`${it.id}-prof`] || "") || null,
        unitSellingPrice: parseFloat(pricingDraft[`${it.id}-sell`] || "") || null,
        lineNote: pricingDraft[`${it.id}-note`] || undefined,
        vatPercent: vatPercentFromDraftForPatch(pricingDraft, it.id),
      }));
      await rfqApi.patch(data.id, { items, vatPercent: null });
      const updated = await rfqApi.submitPricing(data.id);
      setData(updated);
      toast.success("Sent for system approval");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit pricing");
    } finally {
      setBusy(false);
    }
  };

  const saveRequestEdit = async () => {
    if (!data) return;
    if (data.pricingSubmittedAt) {
      toast.error("Pricing has been added. This request can no longer be edited.");
      return;
    }
    if (!selectedDeal) {
      toast.error("Select a deal");
      return;
    }
    if (selectedDeal.hasExistingRfq) {
      toast.error("That deal already has an RFQ. Each deal can only have one.");
      return;
    }
    if (!requestAssignee) {
      toast.error("Select who should handle pricing (RFQ administrator)");
      return;
    }
    const items = requestLines
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
      }))
      .filter((l) => l.description.length > 0);
    if (items.length === 0) {
      toast.error("Add at least one product with a description");
      return;
    }
    for (const it of items) {
      if (Number.isNaN(it.quantity) || it.quantity <= 0) {
        toast.error("Each quantity must be a positive number");
        return;
      }
    }
    setBusy(true);
    try {
      const updated = await rfqApi.patch(data.id, {
        salesId: selectedDeal.salesId,
        pricingAssigneeUserId: requestAssignee.id,
        notesOverall: requestEditNotes.trim() || undefined,
        items: items.map(({ description, quantity }) => ({ description, quantity })),
      });
      setData(updated);
      const next: Record<string, string> = {};
      for (const it of updated.items ?? []) {
        next[`${it.id}-buy`] = it.unitBuyingPrice != null ? String(it.unitBuyingPrice) : "";
        next[`${it.id}-prof`] = it.profitPerUnit != null ? String(it.profitPerUnit) : "";
        next[`${it.id}-sell`] = it.unitSellingPrice != null ? String(it.unitSellingPrice) : "";
        next[`${it.id}-note`] = it.lineNote ?? "";
        const lineV =
          it.vatPercent != null && Number.isFinite(it.vatPercent)
            ? it.vatPercent
            : updated.vatPercent != null && Number.isFinite(updated.vatPercent)
              ? updated.vatPercent
              : DEFAULT_RFQ_VAT_PERCENT;
        next[`${it.id}-vat`] = String(lineV);
      }
      setPricingDraft(next);
      toast.success("Request updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!data || !user?.id) return;
    if (data.createdByUserId !== user.id) return;
    if (data.pricingSubmittedAt) return;
    if (
      data.status !== "pending_rbac" &&
      data.status !== "pending_system" &&
      !(data.status === "draft" && data.submittedAt)
    )
      return;
    setRequestEditNotes(data.notesOverall ?? "");
    setRequestLines(
      data.items?.length
        ? data.items.map((it) => ({
            description: it.description,
            quantity: String(it.quantity),
          }))
        : [{ description: "", quantity: "0" }],
    );
    const aid = data.pricingAssigneeUserId?.trim();
    if (aid && data.pricingAssignee?.id) {
      setRequestAssignee({
        id: data.pricingAssignee.id,
        name: data.pricingAssignee.name,
        email: data.pricingAssignee.email,
        profilePicture: data.pricingAssignee.profilePicture,
      });
    } else setRequestAssignee(null);
    if (data.salesId) {
      setSelectedDeal({
        salesId: data.salesId,
        prospect: data.deal?.prospect ?? "",
        companyId: data.companyId,
        companyName: data.customer?.name ?? "",
      });
    } else setSelectedDeal(null);
  }, [data, user?.id]);

  const addRequestRow = () => setRequestLines((prev) => [...prev, { description: "", quantity: "0" }]);
  const removeRequestRow = (i: number) =>
    setRequestLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  const approve = async () => {
    if (!data) return;
    const err = getPricingDraftValidationError(data.items, pricingDraft);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const items = data.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitBuyingPrice: parseFloat(pricingDraft[`${it.id}-buy`] || "") || null,
        profitPerUnit: parseFloat(pricingDraft[`${it.id}-prof`] || "") || null,
        unitSellingPrice: parseFloat(pricingDraft[`${it.id}-sell`] || "") || null,
        lineNote: pricingDraft[`${it.id}-note`] || undefined,
        vatPercent: vatPercentFromDraftForPatch(pricingDraft, it.id),
      }));
      await rfqApi.patch(data.id, { items, vatPercent: null });
      const updated = await rfqApi.approve(data.id);
      setData(updated);
      toast.success("Approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const applyPreviousPricing = useCallback(() => {
    if (!data || !previousPricingSuggestion) return;
    setPricingDraft((prevDraft) => {
      const next: Record<string, string> = { ...prevDraft };
      for (const it of data.items) {
        const prev = previousPricingSuggestion.pricing.find((p) => p.id === it.id);
        if (!prev) continue;
        next[`${it.id}-buy`] = prev.unitBuyingPrice != null ? String(prev.unitBuyingPrice) : "";
        next[`${it.id}-prof`] = prev.profitPerUnit != null ? String(prev.profitPerUnit) : "";
        next[`${it.id}-sell`] = prev.unitSellingPrice != null ? String(prev.unitSellingPrice) : "";
        next[`${it.id}-note`] = prev.lineNote ?? "";
        const pv =
          prev.vatPercent != null && Number.isFinite(prev.vatPercent)
            ? prev.vatPercent
            : previousPricingSuggestion.vatPercent != null && Number.isFinite(previousPricingSuggestion.vatPercent)
              ? previousPricingSuggestion.vatPercent
              : DEFAULT_RFQ_VAT_PERCENT;
        next[`${it.id}-vat`] = String(pv);
      }
      return next;
    });
    toast.success(`Pricing filled from v${previousPricingSuggestion.versionNumber}`);
  }, [data, previousPricingSuggestion]);

  const canApplyPreviousPricing = useMemo(() => {
    if (!data || !previousPricingSuggestion) return false;
    const canPrice = isPageScopeAdmin("rfq") || user?.role === "admin";
    const canPriceThisRfq =
      canPrice &&
      (user?.role === "admin" ||
        !data.pricingAssigneeUserId ||
        data.pricingAssigneeUserId === user?.id);
    const isSysAdminPricing = data.status === "pending_system" && canSystemApprove;
    const rbacEditable =
      data.status === "pending_rbac" ||
      data.status === "reapplied" ||
      (data.status === "draft" && !!data.submittedAt);
    return (rbacEditable && canPriceThisRfq) || isSysAdminPricing;
  }, [data, previousPricingSuggestion, user?.role, user?.id, canSystemApprove, isPageScopeAdmin]);

  if (!canAccessModule("rfq")) {
    return (
      <Layout>
        <div className={cn(rfqPageShell, "flex flex-1 items-center justify-center p-8 text-slate-600 dark:text-slate-400")}>
          No access.
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className={cn(rfqPageShell, "flex flex-1 flex-col")}>
          <div className={cn(rfqPageInner, rfqPageGutter, rfqPageContentY)}>
            <DetailSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className={cn(rfqPageShell, "flex flex-1 flex-col items-center justify-center gap-4 p-8")}>
          <p className="text-slate-600 dark:text-slate-400">RFQ not found or no access.</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/rfq">Back to list</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const canReopenRfq =
    data.status === "approved" &&
    (user?.id === data.createdByUserId ||
      user?.role === "admin" ||
      isPageScopeAdmin("rfq"));

  const reopenRfq = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const updated = await rfqApi.reopen(data.id);
      setData(updated);
      const next: Record<string, string> = {};
      for (const it of updated.items ?? []) {
        next[`${it.id}-buy`] = it.unitBuyingPrice != null ? String(it.unitBuyingPrice) : "";
        next[`${it.id}-prof`] = it.profitPerUnit != null ? String(it.profitPerUnit) : "";
        next[`${it.id}-sell`] = it.unitSellingPrice != null ? String(it.unitSellingPrice) : "";
        next[`${it.id}-note`] = it.lineNote ?? "";
        const lineV =
          it.vatPercent != null && Number.isFinite(it.vatPercent)
            ? it.vatPercent
            : updated.vatPercent != null && Number.isFinite(updated.vatPercent)
              ? updated.vatPercent
              : DEFAULT_RFQ_VAT_PERCENT;
        next[`${it.id}-vat`] = String(lineV);
      }
      let prevSuggestion: RfqHistoryVersionDto | null = null;
      if ((updated.versionNumber ?? 1) > 1) {
        try {
          const h = await rfqApi.history(updated.id);
          prevSuggestion = h.versions[0] ?? null;
        } catch {
          prevSuggestion = null;
        }
      }
      setPricingDraft(next);
      setPreviousPricingSuggestion(prevSuggestion);
      setReopenConfirmOpen(false);
      toast.success("RFQ reopened — enter new pricing, or use “Use previous pricing” to copy the last version.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reopen");
    } finally {
      setBusy(false);
    }
  };

  const canPrice = isPageScopeAdmin("rfq") || user?.role === "admin";
  const canPriceThisRfq =
    canPrice &&
    (user?.role === "admin" ||
      !data.pricingAssigneeUserId ||
      data.pricingAssigneeUserId === user?.id);

  const isRequester = user?.id === data.createdByUserId;

  /** Creator can edit deal/assignee/lines/notes only until RBAC pricing is submitted. */
  const canEditRequester =
    isRequester &&
    !data.pricingSubmittedAt &&
    (data.status === "pending_rbac" ||
      data.status === "pending_system" ||
      (data.status === "draft" && !!data.submittedAt));

  /** RBAC pricing grid (incl. VAT) when first pass, after reject reapplied, or pricing saved as draft (submitted once). */
  const isRbacPricingEditable =
    data.status === "pending_rbac" ||
    data.status === "reapplied" ||
    (data.status === "draft" && !!data.submittedAt);

  const showInvoice =
    data.status === "approved" || data.status === "pending_system" || data.status === "reapplied";
  const invoiceVariant =
    data.status === "pending_system" || data.status === "reapplied" ? "pending" : "approved";
  /** After pricing exists, requester sees the invoice first; others keep invoice at the bottom. */
  const requesterInvoiceAtTop = isRequester && !!data.pricingSubmittedAt && showInvoice;

  const showSavePricingToolbar =
    (isRbacPricingEditable && canPriceThisRfq) || isSystemAdminApprovalPricing;
  const showSubmitPricingToolbar = isRbacPricingEditable && canPriceThisRfq;

  const rfqToolbarBtnSavePricing =
    "h-9 gap-2 rounded-xl border border-slate-300/95 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-50";
  const rfqToolbarBtnSaveRequest =
    "h-9 gap-2 rounded-xl border border-violet-400/80 bg-violet-50 px-3.5 text-sm font-semibold text-violet-950 shadow-sm transition-colors hover:border-violet-500 hover:bg-violet-100 hover:text-violet-950 focus-visible:ring-2 focus-visible:ring-violet-500/35 dark:border-violet-500/50 dark:bg-violet-950/55 dark:text-violet-100 dark:hover:bg-violet-900/70 dark:hover:text-violet-100";
  const rfqToolbarBtnSubmitPricing =
    "h-9 gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-violet-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:from-indigo-500 dark:to-violet-600 dark:shadow-indigo-900/40";

  return (
    <Layout>
      <>
      <div className={cn(rfqPageShell, "flex min-h-0 flex-1 flex-col")}>
        <div className={cn(rfqStickyBar)}>
          <div className={cn(rfqPageInner, rfqPageGutter, "flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4")}>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className={cn(rfqEyebrow, "hidden sm:block")}>Request for quotation</p>
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                  {data.deal?.prospect ?? "RFQ"}
                </h1>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{data.customer?.name ?? "—"}</p>
              </div>
              <RfqStatusBadge status={data.status} className="hidden sm:inline-flex" />
              {(data.versionNumber ?? 1) > 1 ? (
                <RfqReopenedChip className="hidden sm:inline-flex" />
              ) : null}
              <Badge
                variant="outline"
                className="hidden shrink-0 rounded-md border-indigo-200/80 bg-indigo-50/90 font-mono text-[11px] font-semibold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 sm:inline-flex"
              >
                v{data.versionNumber ?? 1}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
              <div className="flex flex-wrap items-center gap-2 sm:hidden">
                <RfqStatusBadge status={data.status} />
                {(data.versionNumber ?? 1) > 1 ? <RfqReopenedChip /> : null}
              </div>
              {showInvoice ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 gap-2 rounded-xl px-3.5 text-sm font-semibold tracking-tight text-white shadow-md transition-all",
                    "border border-emerald-950/20 bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-700",
                    "shadow-emerald-900/25 ring-1 ring-inset ring-white/25",
                    "hover:from-emerald-400 hover:via-teal-500 hover:to-teal-600 hover:shadow-lg hover:shadow-emerald-900/30",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                    "dark:border-emerald-400/25 dark:from-emerald-500 dark:via-teal-600 dark:to-teal-700 dark:shadow-emerald-950/50",
                    "dark:hover:from-emerald-400 dark:hover:via-teal-500 dark:hover:to-teal-600",
                  )}
                  onClick={() => {
                    try {
                      downloadRfqInvoicePdf(invoiceDisplayData ?? data, invoiceTotals, invoiceVariant);
                      toast.success("RFQ downloaded as PDF");
                    } catch (e) {
                      console.error(e);
                      toast.error("Could not generate PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4 shrink-0 drop-shadow-sm" strokeWidth={2.25} aria-hidden />
                  Download RFQ
                </Button>
              ) : null}
              {canReopenRfq ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 rounded-xl border border-amber-800/25 bg-gradient-to-b from-amber-500 to-amber-600 px-3.5 text-sm font-semibold text-white shadow-md shadow-amber-900/25 hover:bg-gradient-to-b hover:from-amber-600 hover:to-amber-700 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-400/35 dark:from-amber-600 dark:to-amber-700 dark:shadow-amber-950/40 dark:hover:from-amber-500 dark:hover:to-amber-600"
                  disabled={busy}
                  onClick={() => setReopenConfirmOpen(true)}
                >
                  <RotateCcw className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                  Reopen RFQ
                </Button>
              ) : null}
              {showSavePricingToolbar || showSubmitPricingToolbar || canEditRequester ? (
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-2.5">
                  {showSavePricingToolbar ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={rfqToolbarBtnSavePricing}
                      disabled={busy}
                      onClick={() => void savePricing()}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <FilePenLine className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                      )}
                      Draft
                    </Button>
                  ) : null}
                  {canEditRequester ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={rfqToolbarBtnSaveRequest}
                      disabled={busy}
                      onClick={() => void saveRequestEdit()}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <FileUser className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
                      )}
                      Save request
                    </Button>
                  ) : null}
                  {showSubmitPricingToolbar ? (
                    <Button
                      type="button"
                      size="sm"
                      className={rfqToolbarBtnSubmitPricing}
                      disabled={busy}
                      onClick={() => void submitPricingFlow()}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <SendHorizontal className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                      )}
                      Submit pricing
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {data.status === "pending_system" && canSystemApprove ? (
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-2.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500 dark:from-emerald-500 dark:to-teal-600"
                    disabled={busy}
                    onClick={() => void approve()}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Approve
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={cn(rfqPageInner, rfqPageGutter, rfqPageContentY, "flex flex-1 flex-col gap-6")}>
          {data.status === "reapplied" ? (
            <div
              className={cn(
                rfqCard,
                "border-violet-200/80 bg-gradient-to-r from-violet-50/95 to-indigo-50/40 px-5 py-4 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-indigo-950/25",
              )}
            >
              <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">Reapplied</p>
              {data.rejectionReason?.trim() ? (
                <p className={cn(rfqBody, "mt-2 text-slate-800 dark:text-slate-200")}>{data.rejectionReason.trim()}</p>
              ) : null}
            </div>
          ) : null}

          {requesterInvoiceAtTop ? (
            <>
              <RfqHistoryArchiveSection
                rfqId={data.id}
                enabled={showInvoice && (data.versionNumber ?? 1) > 1}
              />
              <RfqInvoiceView
                data={invoiceDisplayData ?? data}
                invoiceTotals={invoiceTotals}
              />
              {isSystemAdminApprovalPricing || showSystemAdminApprovedPricingReadonly ? (
                <RfqPricingEditorSection
                  layout="compact"
                  data={data}
                  pricingDraft={pricingDraft}
                  setDraft={setDraft}
                  rbacPricingTotalProfitSum={rbacPricingTotalProfitSum}
                  busy={busy}
                  onSave={showSystemAdminApprovedPricingReadonly ? () => {} : () => void savePricing()}
                  previousPricingSuggestion={previousPricingSuggestion}
                  onApplyPreviousPricing={canApplyPreviousPricing ? applyPreviousPricing : undefined}
                  readOnly={showSystemAdminApprovedPricingReadonly}
                />
              ) : null}
            </>
          ) : null}

          {isRbacPricingEditable && canPriceThisRfq && (
            <RfqPricingEditorSection
              layout="full"
              data={data}
              pricingDraft={pricingDraft}
              setDraft={setDraft}
              rbacPricingTotalProfitSum={rbacPricingTotalProfitSum}
              busy={busy}
              onSave={() => void savePricing()}
              onSubmitPricing={() => void submitPricingFlow()}
              previousPricingSuggestion={previousPricingSuggestion}
              onApplyPreviousPricing={canApplyPreviousPricing ? applyPreviousPricing : undefined}
            />
          )}
          {canEditRequester && (
            <section className={cn(rfqCard, "overflow-hidden")}>
              <div className={rfqCardHeaderFlush}>
                <p className={rfqEyebrow}>Edit request</p>
                <h2 className={cn(rfqSectionTitle, "mt-1")}>Your request</h2>
              </div>
              <div className={cn(rfqCardBody, "grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10")}>
                <div className="min-w-0">
                  <div className={cn(rfqPanel, "space-y-6")}>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="rfq-req-deal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Deal <span className="text-red-500">*</span>
                        </Label>
                        <Popover open={dealOpen} onOpenChange={setDealOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="rfq-req-deal"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={dealOpen}
                              className={cn(
                                "h-11 w-full justify-between rounded-xl border-slate-200 bg-white font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
                                !selectedDeal && "text-slate-500",
                              )}
                            >
                              {selectedDeal ? (
                                <span className="truncate text-left">
                                  {selectedDeal.prospect}
                                  <span className="text-slate-500 dark:text-slate-400"> — {selectedDeal.companyName}</span>
                                </span>
                              ) : (
                                "Search and select a deal…"
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search deals…"
                                value={dealSearch}
                                onValueChange={setDealSearch}
                                className="h-11"
                              />
                              <CommandList>
                                <CommandEmpty>{dealsLoading ? "Loading…" : "No deals found."}</CommandEmpty>
                                <CommandGroup>
                                  {dealEditOptions.map((d) => (
                                    <CommandItem
                                      key={d.salesId}
                                      value={`${d.salesId}-${d.prospect}`}
                                      disabled={!!d.hasExistingRfq}
                                      className={cn(
                                        "cursor-pointer",
                                        d.hasExistingRfq && "cursor-not-allowed opacity-60",
                                      )}
                                      onSelect={() => {
                                        if (d.hasExistingRfq) return;
                                        setSelectedDeal(d);
                                        setDealOpen(false);
                                      }}
                                    >
                                      <span className="flex min-w-0 flex-1 items-center gap-2">
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{d.prospect}</span>
                                        <span className="truncate text-slate-500 dark:text-slate-400">{d.companyName}</span>
                                      </span>
                                      {d.hasExistingRfq ? (
                                        <span className="ml-2 shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
                                          Has RFQ
                                        </span>
                                      ) : null}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rfq-req-customer" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Customer
                        </Label>
                        <Input
                          id="rfq-req-customer"
                          readOnly
                          disabled={!selectedDeal}
                          className={cn(
                            rfqInput,
                            "h-11 cursor-not-allowed bg-slate-100/80 text-slate-800 dark:bg-slate-900/80 dark:text-slate-200",
                          )}
                          value={selectedDeal?.companyName ?? ""}
                          placeholder="Select a deal first"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                <Label htmlFor="rfq-req-assignee" className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Pricing handled by <span className="text-red-500 dark:text-red-400">*</span>
                </Label>
                <Popover open={requestAssigneeOpen} onOpenChange={setRequestAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="rfq-req-assignee"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={requestAssigneeOpen}
                      disabled={rbacAdminsLoading || rbacAssigneeOptions.length === 0}
                      className={cn(
                        "w-full justify-between gap-3 rounded-xl border-slate-200/90 bg-white font-normal shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-900",
                        requestAssignee ? "min-h-[56px] h-auto py-2 pl-2 pr-3" : "h-11",
                        !requestAssignee && "text-slate-500",
                      )}
                    >
                      {requestAssignee ? (
                        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <RfqUserAvatar
                            name={requestAssignee.name}
                            email={requestAssignee.email}
                            profilePicture={requestAssignee.profilePicture}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">
                              {requestAssignee.name || requestAssignee.email}
                            </span>
                            {requestAssignee.email ? (
                              <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                {requestAssignee.email}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      ) : rbacAssigneeOptions.length === 0 && !rbacAdminsLoading ? (
                        "No RFQ administrators configured"
                      ) : (
                        "Select an RFQ administrator…"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-[400px] min-w-[min(100%,280px)] p-0 sm:min-w-[320px]"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search by name or email…" className="h-11" />
                      <CommandList className="max-h-[min(60vh,320px)]">
                        <CommandEmpty>{rbacAdminsLoading ? "Loading…" : "No administrators found."}</CommandEmpty>
                        <CommandGroup>
                          {rbacAssigneeOptions.map((a) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.name} ${a.email}`}
                              className="cursor-pointer py-2.5"
                              onSelect={() => {
                                setRequestAssignee(a);
                                setRequestAssigneeOpen(false);
                              }}
                            >
                              <span className="flex w-full min-w-0 items-center gap-3">
                                <RfqUserAvatar name={a.name} email={a.email} profilePicture={a.profilePicture} size="sm" />
                                <span className="min-w-0 flex-1 text-left">
                                  <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                                    {a.name || a.email}
                                  </span>
                                  {a.email ? (
                                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                      {a.email}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                    </div>
                    <div className="space-y-2">
              <Label htmlFor="rfq-req-notes" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                Notes
              </Label>
              <Textarea
                id="rfq-req-notes"
                value={requestEditNotes}
                onChange={(e) => setRequestEditNotes(e.target.value)}
                rows={4}
                className={cn(rfqInput, "min-h-[100px] resize-y border-slate-200/90 dark:border-slate-700")}
                placeholder="Context for pricing…"
              />
                    </div>
                  </div>
                </div>
                <div className="min-w-0 space-y-4 lg:border-l lg:border-slate-200/80 lg:pl-10 dark:lg:border-slate-800">
                  <div className="border-t border-slate-200/80 pt-6 lg:border-t-0 lg:pt-0">
                <div>
                  <p className={rfqEyebrow}>Request</p>
                  <p className={cn(rfqSectionTitle, "mt-1 text-base")}>Products</p>
                </div>
              </div>
              <div className={cn(rfqTableWrap, "overflow-x-auto")}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/80 hover:bg-transparent dark:border-slate-800">
                      <TableHead className={cn("w-12 px-3", rfqTableHead)}>#</TableHead>
                      <TableHead className={cn("min-w-[200px]", rfqTableHead)}>Product</TableHead>
                      <TableHead className={cn("min-w-[12rem]", rfqTableHead)}>Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestLines.map((line, i) => (
                      <TableRow key={i} className="border-slate-100/90 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/50">
                        <TableCell className="px-3 text-slate-500">{i + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              setRequestLines((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)),
                              )
                            }
                            className={cn(rfqInput, "h-9 w-full min-w-[160px]")}
                            placeholder="Product"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <Input
                              type="number"
                              step="any"
                              min={0.01}
                              value={line.quantity}
                              onChange={(e) =>
                                setRequestLines((prev) =>
                                  prev.map((p, j) => (j === i ? { ...p, quantity: e.target.value } : p)),
                                )
                              }
                              className={cn(rfqInput, "h-9 min-w-0 max-w-[6rem] flex-1 tabular-nums", rfqNoQtySpinner)}
                            />
                            {i === requestLines.length - 1 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className={cn(
                                  "h-9 w-9 shrink-0 rounded-xl transition-none",
                                  "border border-slate-300 bg-white text-slate-900 shadow-sm",
                                  "hover:!border-slate-300 hover:!bg-white hover:!text-slate-900",
                                  "dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50",
                                  "dark:hover:!border-slate-500 dark:hover:!bg-slate-950 dark:hover:!text-slate-50",
                                  "focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                                )}
                                onClick={addRequestRow}
                                aria-label="Add product"
                              >
                                <Plus className="h-4 w-4 text-slate-900 dark:text-slate-50" strokeWidth={2.25} />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                onClick={() => removeRequestRow(i)}
                                aria-label="Remove product"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                </div>
              </div>
            </section>
          )}

          {isRbacPricingEditable && !canPriceThisRfq && !canEditRequester && (
            <section className={cn(rfqCard, "overflow-hidden")}>
              <div className={rfqCardHeaderFlush}>
                <p className={rfqEyebrow}>Overview</p>
                <h2 className={cn(rfqSectionTitle, "mt-1")}>Your request</h2>
                <p className={cn(rfqBody, "mt-2 max-w-xl")}>
                  {data.status === "reapplied"
                    ? "This request was sent back for pricing changes. Waiting for the pricing administrator to update and resubmit."
                    : "Waiting for pricing from an administrator."}
                </p>
              </div>
                  <div className={cn(rfqCardBody, "grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10")}>
                <div className="min-w-0 space-y-4">
              {data.pricingAssignee?.name || data.pricingAssignee?.email ? (
                <div className="flex items-start gap-3 rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 to-white px-4 py-4 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-950">
                  <RfqUserAvatar
                    name={data.pricingAssignee.name}
                    email={data.pricingAssignee.email}
                    profilePicture={data.pricingAssignee.profilePicture}
                    size="md"
                    className="mt-0.5 ring-2 ring-white dark:ring-slate-900"
                  />
                  <p className={cn(rfqBody, "min-w-0 flex-1 text-slate-600 dark:text-slate-400")}>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                      Pricing contact
                    </span>
                    <span className="mt-1 block font-semibold text-slate-900 dark:text-slate-100">
                      {data.pricingAssignee.name || data.pricingAssignee.email}
                    </span>
                    {data.pricingAssignee.email ? (
                      <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">{data.pricingAssignee.email}</span>
                    ) : null}
                    <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">
                      {canPrice && !canPriceThisRfq
                        ? "Only this administrator can enter pricing for this request."
                        : "Waiting for their pricing input."}
                    </span>
                  </p>
                </div>
              ) : null}
                </div>
                <div className="min-w-0 space-y-3 lg:border-l lg:border-slate-200/80 lg:pl-10 dark:lg:border-slate-800">
                  <div>
                    <p className={rfqEyebrow}>Request</p>
                    <p className={cn(rfqSectionTitle, "mt-1 text-base")}>Products</p>
                  </div>
              <div className={cn(rfqTableWrap, "overflow-x-auto")}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/80 dark:border-slate-800">
                      <TableHead className={cn("w-12 px-4", rfqTableHeadNeutral)}>#</TableHead>
                      <TableHead className={rfqTableHeadNeutral}>Product</TableHead>
                      <TableHead className={cn("text-right", rfqTableHeadNeutral)}>Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((it, idx) => (
                      <TableRow key={it.id} className="border-slate-100/90 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/50">
                        <TableCell className="px-4 text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="max-w-xl text-sm font-medium text-slate-900 dark:text-slate-100">{it.description}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700 dark:text-slate-300">{it.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                </div>
              </div>
            </section>
          )}


          {data.status === "pending_system" && !canSystemApprove && (
            <div
              className={cn(
                rfqCard,
                "overflow-hidden border-slate-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] dark:ring-white/[0.06]",
              )}
            >
              <div className="relative border-b border-indigo-100/90 bg-gradient-to-br from-indigo-50/95 via-white to-violet-50/60 px-5 py-5 sm:px-6 dark:border-indigo-900/40 dark:from-indigo-950/50 dark:via-slate-950 dark:to-violet-950/30">
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_100%_-20%,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(99,102,241,0.18),transparent_50%)]"
                  aria-hidden
                />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-2 ring-white/90",
                      "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/30",
                      "dark:from-indigo-500 dark:to-violet-600 dark:ring-indigo-950/80 dark:shadow-indigo-950/40",
                    )}
                    aria-hidden
                  >
                    <ShieldCheck className="h-6 w-6" strokeWidth={1.85} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">
                      System review
                    </p>
                    <p className="text-lg font-bold leading-snug tracking-tight text-slate-950 dark:text-white">
                      Waiting for system administrator approval
                    </p>
                    <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      Pricing has been submitted. A system administrator will review this RFQ and approve or reject it. You will be notified when the status changes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.status === "rejected" && (
            <div className="rounded-2xl border border-red-200/70 bg-gradient-to-r from-red-50/90 to-red-50/50 px-5 py-4 text-sm font-medium text-red-900 shadow-sm dark:border-red-900/50 dark:from-red-950/40 dark:to-red-950/20 dark:text-red-100">
              {data.rejectionReason || "Rejected"}
            </div>
          )}

          {showInvoice && !requesterInvoiceAtTop ? (
            <>
              <RfqHistoryArchiveSection
                rfqId={data.id}
                enabled={showInvoice && (data.versionNumber ?? 1) > 1}
              />
              <RfqInvoiceView
                data={invoiceDisplayData ?? data}
                invoiceTotals={invoiceTotals}
              />
              {isSystemAdminApprovalPricing || showSystemAdminApprovedPricingReadonly ? (
                <RfqPricingEditorSection
                  layout="compact"
                  data={data}
                  pricingDraft={pricingDraft}
                  setDraft={setDraft}
                  rbacPricingTotalProfitSum={rbacPricingTotalProfitSum}
                  busy={busy}
                  onSave={showSystemAdminApprovedPricingReadonly ? () => {} : () => void savePricing()}
                  previousPricingSuggestion={previousPricingSuggestion}
                  onApplyPreviousPricing={canApplyPreviousPricing ? applyPreviousPricing : undefined}
                  readOnly={showSystemAdminApprovedPricingReadonly}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <AlertDialog open={reopenConfirmOpen} onOpenChange={setReopenConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Reopen this RFQ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The current approved pricing and invoice will be saved to history (version v{data.versionNumber ?? 1}).
              You can enter new pricing for version v{(data.versionNumber ?? 1) + 1} and go through approval again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl border border-amber-800/25 bg-gradient-to-b from-amber-500 to-amber-600 font-semibold text-white shadow-md shadow-amber-900/25 hover:from-amber-600 hover:to-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-400/30 dark:from-amber-600 dark:to-amber-700 dark:hover:from-amber-500 dark:hover:to-amber-600"
              disabled={busy}
              onClick={() => void reopenRfq()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4 opacity-95" aria-hidden />}
              Reopen RFQ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </Layout>
  );
}
