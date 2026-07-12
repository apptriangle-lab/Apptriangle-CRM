import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import { rfqApi, type RfqDealOption, type RfqRbacAdminOption } from "@/lib/api";
import { toast } from "sonner";
import { ChevronsUpDown, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  rfqPageShell,
  rfqPageInner,
  rfqPageGutter,
  rfqPrimaryBtn,
  rfqInput,
} from "@/components/rfq/rfq-styles";

/** Higher-contrast typography for this page (WCAG-friendly on white / slate-950). */
const newRfqSection =
  "text-sm font-semibold uppercase tracking-[0.08em] text-slate-800 dark:text-slate-100";
const newRfqLabel = "text-sm font-medium text-slate-900 dark:text-slate-100";
const newRfqHint = "text-xs leading-relaxed text-slate-600 dark:text-slate-300";
const newRfqLead = "text-sm leading-relaxed text-slate-800 dark:text-slate-100";
const newRfqReq = "font-semibold text-red-700 dark:text-red-400";

/**
 * Section surfaces — match Login.tsx: navy `#050A15` / card `#0A1222`, indigo + violet orbs,
 * brand gradient `indigo-500 → violet-600`, hero line `indigo-300 → white → violet-300`.
 */
const newRfqSectionDeal =
  "rounded-2xl relative overflow-hidden border border-slate-300/90 bg-gradient-to-br from-indigo-50/95 via-white to-violet-100/45 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_32px_-8px_rgba(99,102,241,0.14),0_12px_40px_-16px_rgba(139,92,246,0.08),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-1 ring-indigo-200/50 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#0A1222] dark:via-[#050A15] dark:to-indigo-950/45 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_48px_-20px_rgba(99,102,241,0.18),inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:ring-indigo-500/25";
const newRfqSectionNotes =
  "rounded-2xl relative overflow-hidden border border-slate-300/90 bg-gradient-to-br from-violet-50/92 via-white to-indigo-50/50 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_32px_-8px_rgba(139,92,246,0.12),0_12px_40px_-16px_rgba(99,102,241,0.07),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-1 ring-violet-200/45 dark:border-white/10 dark:bg-gradient-to-br dark:from-violet-950/35 dark:via-[#050A15] dark:to-[#0A1222] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_48px_-20px_rgba(139,92,246,0.14),inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:ring-violet-500/20";
const newRfqSectionProducts =
  "rounded-2xl relative overflow-hidden border border-slate-300/90 bg-gradient-to-br from-indigo-50/90 via-violet-50/30 to-violet-50/55 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_32px_-8px_rgba(99,102,241,0.13),0_12px_40px_-16px_rgba(124,58,237,0.09),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-1 ring-indigo-200/40 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#050A15] dark:via-indigo-950/40 dark:to-violet-950/35 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_52px_-20px_rgba(79,70,229,0.16),inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:ring-indigo-400/20";
const newRfqProductsHeaderBand =
  "border-b border-indigo-200/55 bg-gradient-to-r from-indigo-100/50 via-white/90 to-violet-100/40 px-6 py-5 dark:border-white/10 dark:bg-gradient-to-r dark:from-indigo-950/55 dark:via-[#0A1222]/95 dark:to-violet-950/40";

const newRfqFieldOutline =
  "border-slate-300 bg-white text-slate-900 placeholder:text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400";
const newRfqComboPlaceholder = "text-slate-600 dark:text-slate-400";

type Line = { description: string; quantity: string };

const emptyLine = (): Line => ({ description: "", quantity: "0" });

/** Strip leading zeros on the integer part ("010" → "10") while keeping "0", "0.5", "0." */
function normalizeQtyInput(v: string): string {
  if (v === "") return "";
  if (v === ".") return ".";
  const dot = v.indexOf(".");
  if (dot === -1) {
    return v.replace(/^0+/, "") || "0";
  }
  const intPart = v.slice(0, dot);
  const frac = v.slice(dot + 1);
  const intNorm = intPart.replace(/^0+/, "") || "0";
  return `${intNorm}.${frac}`;
}

export default function RfqNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canAccessModule } = useRbac();
  const [dealOpen, setDealOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [deals, setDeals] = useState<RfqDealOption[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [selected, setSelected] = useState<RfqDealOption | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [rbacAdmins, setRbacAdmins] = useState<RfqRbacAdminOption[]>([]);
  const [rbacAdminsLoading, setRbacAdminsLoading] = useState(true);
  const [selectedAssignee, setSelectedAssignee] = useState<RfqRbacAdminOption | null>(null);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  /** Preset deal (?salesId) already has an RFQ — link user to it instead of creating another. */
  const [presetConflictRfqId, setPresetConflictRfqId] = useState<string | null>(null);

  const loadDeals = useCallback(async (q: string) => {
    setDealsLoading(true);
    try {
      const data = await rfqApi.searchDeals(q);
      setDeals(data);
    } catch {
      setDeals([]);
    } finally {
      setDealsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadDeals(dealSearch), 300);
    return () => clearTimeout(t);
  }, [dealSearch, loadDeals]);

  const presetSalesId = searchParams.get("salesId")?.trim() ?? "";

  /** Preselect deal when opening New RFQ from sales details (?salesId=…) */
  useEffect(() => {
    if (!presetSalesId) {
      setPresetConflictRfqId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await rfqApi.searchDeals(undefined, presetSalesId);
        if (cancelled || data.length === 0) return;
        const d = data[0];
        if (d.hasExistingRfq && d.existingRfqId) {
          setPresetConflictRfqId(d.existingRfqId);
          setSelected(null);
          setDealSearch("");
          setDeals(data);
          return;
        }
        setPresetConflictRfqId(null);
        setSelected(d);
        /* Empty search so the deal picker can load the full list; user may pick another deal. */
        setDealSearch("");
        setDeals(data);
      } catch {
        if (!cancelled) setPresetConflictRfqId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [presetSalesId]);

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

  const addRow = () => setLines((prev) => [...prev, emptyLine()]);
  const removeRow = (i: number) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  const submit = async () => {
    if (presetConflictRfqId) {
      toast.error("This deal already has an RFQ.");
      return;
    }
    if (!selected) {
      toast.error("Select a deal");
      return;
    }
    if (selected.hasExistingRfq) {
      toast.error("This deal already has an RFQ. Each deal can only have one.");
      return;
    }
    if (!selectedAssignee) {
      toast.error("Select who should handle pricing (RFQ administrator)");
      return;
    }
    const items = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
      }))
      .filter((l) => l.description.length > 0);
    if (items.length === 0) {
      toast.error("Add at least one product with a description");
      return;
    }
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const key = items[i].description.toLowerCase();
      if (seen.has(key)) {
        toast.error("Duplicate product descriptions — combine quantities or use distinct products.");
        return;
      }
      seen.add(key);
    }
    for (let i = 0; i < items.length; i++) {
      if (Number.isNaN(items[i].quantity) || items[i].quantity <= 0) {
        toast.error("Each quantity must be a positive number");
        return;
      }
    }
    setSaving(true);
    try {
      const created = await rfqApi.create({
        salesId: selected.salesId,
        pricingAssigneeUserId: selectedAssignee.id,
        notesOverall: notes.trim() || undefined,
        items: items.map(({ description, quantity }) => ({ description, quantity })),
      });
      await rfqApi.submit(created.id);
      toast.success("RFQ submitted");
      navigate(`/rfq/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create RFQ");
    } finally {
      setSaving(false);
    }
  };

  const dealBlocksSubmit = !!presetConflictRfqId || !!selected?.hasExistingRfq;

  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [productsColumnHeight, setProductsColumnHeight] = useState<number | null>(null);

  /** On lg, cap the Products column to the Deal + Notes column height so both columns align. */
  useLayoutEffect(() => {
    const left = leftColumnRef.current;
    if (!left || typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 1024px)");

    const sync = () => {
      if (!mq.matches) {
        setProductsColumnHeight(null);
        return;
      }
      setProductsColumnHeight(left.getBoundingClientRect().height);
    };

    const ro = new ResizeObserver(sync);
    ro.observe(left);
    mq.addEventListener("change", sync);
    sync();

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);

  if (!canAccessModule("rfq")) {
    return (
      <Layout>
        <div className={cn(rfqPageShell, "flex flex-1 items-center justify-center p-8 text-slate-600 dark:text-slate-400")}>
          No access to RFQ.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className={cn(
          rfqPageShell,
          "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              rfqPageInner,
              rfqPageGutter,
              "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pt-6 sm:pt-8 pb-4 sm:pb-6 lg:gap-6",
            )}
          >
            <div className="flex min-h-0 flex-col gap-6 overflow-hidden lg:flex-row lg:items-stretch lg:gap-6">
              <div
                ref={leftColumnRef}
                className="flex min-h-0 min-w-0 flex-col gap-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
              >
              <div className={cn(newRfqSectionDeal, "p-6 sm:p-8")}>
              <p className={newRfqSection}>Deal & customer</p>
              <div className="mt-5 space-y-5">
                {presetConflictRfqId ? (
                  <Alert variant="destructive" className="rounded-xl border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <AlertTitle>This deal already has an RFQ</AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                      <p>Each deal can only have one RFQ. Open the existing request or choose another deal.</p>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-lg border-amber-700/80 bg-white font-semibold text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-50"
                      >
                        <Link to={`/rfq/${presetConflictRfqId}`}>Open existing RFQ</Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="rfq-deal" className={newRfqLabel}>
                    Deal <span className={newRfqReq}>*</span>
                  </Label>
                  <p className={newRfqHint}>
                    Each deal can have only one RFQ. Open the list to pick a deal that does not already have one.
                  </p>
                  <Popover open={dealOpen} onOpenChange={setDealOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="rfq-deal"
                        variant="outline"
                        role="combobox"
                        aria-expanded={dealOpen}
                        className={cn(
                          "h-11 w-full justify-between rounded-xl font-normal",
                          newRfqFieldOutline,
                          !selected && newRfqComboPlaceholder,
                        )}
                      >
                        {selected ? (
                          <span className="truncate text-left">
                            {selected.prospect}
                            <span className="text-slate-600 dark:text-slate-300"> — {selected.companyName}</span>
                          </span>
                        ) : (
                          "Search and select a deal…"
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
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
                            {deals.map((d) => (
                              <CommandItem
                                key={d.salesId}
                                value={`${d.salesId}-${d.prospect}`}
                                disabled={!!d.hasExistingRfq}
                                className={cn(
                                  "cursor-pointer",
                                  d.hasExistingRfq &&
                                    "cursor-not-allowed bg-slate-100/80 dark:bg-slate-900/50 data-[disabled=true]:opacity-100",
                                )}
                                onSelect={() => {
                                  if (d.hasExistingRfq) return;
                                  setPresetConflictRfqId(null);
                                  setSelected(d);
                                  setDealOpen(false);
                                }}
                              >
                                <span
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-2",
                                    d.hasExistingRfq && "text-slate-600 dark:text-slate-400",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "font-medium",
                                      d.hasExistingRfq
                                        ? "text-slate-600 dark:text-slate-400"
                                        : "text-slate-900 dark:text-slate-100",
                                    )}
                                  >
                                    {d.prospect}
                                  </span>
                                  <span className="truncate text-slate-600 dark:text-slate-400">{d.companyName}</span>
                                </span>
                                {d.hasExistingRfq ? (
                                  <Badge
                                    variant="secondary"
                                    className="pointer-events-none shrink-0 rounded-md border border-amber-700/35 bg-amber-200 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-950 shadow-sm dark:border-amber-400/45 dark:bg-amber-900 dark:text-amber-50"
                                  >
                                    Has RFQ
                                  </Badge>
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
                  <Label htmlFor="rfq-customer" className={newRfqLabel}>
                    Customer
                  </Label>
                  <Input
                    id="rfq-customer"
                    readOnly
                    disabled={!selected}
                    className={cn(
                      rfqInput,
                      "h-11 cursor-not-allowed border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
                    )}
                    value={selected?.companyName ?? ""}
                    placeholder="Select a deal first"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfq-assignee" className={newRfqLabel}>
                    Pricing handled by <span className={newRfqReq}>*</span>
                  </Label>
                  <p className={newRfqHint}>
                    Only users with RFQ set to Admin in RBAC appear here. They will see this request when you submit.
                  </p>
                  <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="rfq-assignee"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={assigneeOpen}
                        disabled={rbacAdminsLoading || rbacAdmins.length === 0}
                        className={cn(
                          "w-full justify-between gap-3 rounded-xl font-normal",
                          newRfqFieldOutline,
                          selectedAssignee ? "min-h-[56px] h-auto py-2 pl-2 pr-3" : "h-11",
                          !selectedAssignee && newRfqComboPlaceholder,
                        )}
                      >
                        {selectedAssignee ? (
                          <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <RfqUserAvatar
                              name={selectedAssignee.name}
                              email={selectedAssignee.email}
                              profilePicture={selectedAssignee.profilePicture}
                              size="md"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">
                                {selectedAssignee.name || selectedAssignee.email}
                              </span>
                              {selectedAssignee.email ? (
                                <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">
                                  {selectedAssignee.email}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        ) : rbacAdmins.length === 0 && !rbacAdminsLoading ? (
                          "No RFQ administrators configured"
                        ) : (
                          "Select an RFQ administrator…"
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
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
                            {rbacAdmins.map((a) => (
                              <CommandItem
                                key={a.id}
                                value={`${a.name} ${a.email}`}
                                className="cursor-pointer py-2.5"
                                onSelect={() => {
                                  setSelectedAssignee(a);
                                  setAssigneeOpen(false);
                                }}
                              >
                                <span className="flex w-full min-w-0 items-center gap-3">
                                  <RfqUserAvatar name={a.name} email={a.email} profilePicture={a.profilePicture} size="sm" />
                                  <span className="min-w-0 flex-1 text-left">
                                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                                      {a.name || a.email}
                                    </span>
                                    {a.email ? (
                                      <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">
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
              </div>
              </div>

              <div className={cn(newRfqSectionNotes, "p-6 sm:p-8")}>
              <p className={newRfqSection}>Notes</p>
              <p className={cn(newRfqLead, "mt-2")}>Optional context for your pricing team.</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Add context, delivery expectations, or constraints…"
                className={cn(rfqInput, newRfqFieldOutline, "mt-4 min-h-[120px] resize-y")}
              />
              </div>
            </div>

            <div
              className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1"
              style={
                productsColumnHeight != null
                  ? { height: productsColumnHeight, maxHeight: productsColumnHeight, minHeight: 0 }
                  : undefined
              }
            >
              <div
                className={cn(
                  newRfqSectionProducts,
                  "flex h-full min-h-0 flex-1 flex-col overflow-hidden max-lg:min-h-[min(55vh,420px)]",
                )}
              >
                <div className={cn("shrink-0", newRfqProductsHeaderBand)}>
                  <p className={newRfqSection}>Products</p>
                  <p className={cn(newRfqLead, "mt-1")}>Describe each product or service and quantity.</p>
                </div>
                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
                  <Table maxHeight="none">
                <TableHeader>
                  <TableRow className="border-slate-300 hover:bg-transparent dark:border-slate-600">
                    <TableHead
                      className={cn(
                        "min-w-[220px] pl-6 text-[11px] font-semibold uppercase tracking-wider text-slate-800 sm:pl-8",
                        "bg-gradient-to-r from-indigo-50/95 to-violet-50/70 dark:from-indigo-950/55 dark:to-violet-950/45 dark:text-slate-200",
                      )}
                    >
                      Product
                    </TableHead>
                    <TableHead
                      className={cn(
                        "min-w-[12rem] bg-gradient-to-r from-violet-50/80 to-indigo-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-800 dark:from-[#0A1222] dark:to-indigo-950/50 dark:text-slate-200",
                      )}
                    >
                      Qty
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow
                      key={i}
                      className="border-slate-200 transition-colors hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-900/50"
                    >
                      <TableCell className="align-top pl-6 sm:pl-8">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)),
                            )
                          }
                          placeholder="e.g. Microsoft 365 Business Basic"
                          className={cn(rfqInput, newRfqFieldOutline, "h-10 w-full min-w-[180px]")}
                        />
                      </TableCell>
                      <TableCell className="align-top pr-6 sm:pr-8">
                        <div className="flex min-w-0 items-center gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={line.quantity}
                            onChange={(e) => {
                              const raw = e.target.value.replace(",", ".");
                              if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                              const v = raw === "" ? "" : normalizeQtyInput(raw);
                              setLines((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, quantity: v } : p)),
                              );
                            }}
                            className={cn(rfqInput, newRfqFieldOutline, "h-10 min-w-0 max-w-[7rem] flex-1 tabular-nums")}
                          />
                          {i === lines.length - 1 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={cn(
                                "h-10 w-10 shrink-0 rounded-xl transition-none",
                                "border border-slate-400 bg-white text-slate-900 shadow-sm",
                                "hover:!border-slate-300 hover:!bg-white hover:!text-slate-900",
                                "dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50",
                                "dark:hover:!border-slate-500 dark:hover:!bg-slate-950 dark:hover:!text-slate-50",
                                "focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                              )}
                              onClick={addRow}
                              aria-label="Add product"
                            >
                              <Plus className="h-4 w-4 text-slate-900 dark:text-slate-50" strokeWidth={2.25} />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0 rounded-lg text-slate-700 hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              onClick={() => removeRow(i)}
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
            </div>
          </div>
          <div
            className={cn(
              "sticky bottom-0 z-30 shrink-0 border-t border-slate-300 bg-white/95 shadow-[0_-1px_0_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-600 dark:bg-slate-950/95 dark:shadow-[0_-1px_0_rgba(255,255,255,0.06)]",
            )}
          >
            <div className={cn(rfqPageInner, rfqPageGutter, "flex flex-wrap items-center justify-end gap-3 py-4")}>
              <Button
                variant="outline"
                className={cn(
                  "box-border inline-flex h-11 w-48 shrink-0 items-center justify-center rounded-xl border-2 border-neutral-950 bg-white text-sm font-semibold text-neutral-950 shadow-sm",
                  "hover:bg-neutral-100 hover:text-black",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/50 focus-visible:ring-offset-2 dark:focus-visible:ring-white/60 dark:focus-visible:ring-offset-slate-950",
                  "dark:border-white dark:bg-slate-900 dark:text-white dark:shadow-black/30",
                  "dark:hover:bg-slate-800 dark:hover:text-white",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
                disabled={saving}
                asChild
              >
                <Link to="/rfq">Cancel</Link>
              </Button>
              <Button
                className={cn(
                  rfqPrimaryBtn,
                  "box-border inline-flex h-11 w-48 shrink-0 items-center justify-center border-2 border-indigo-700 bg-indigo-700 text-sm font-semibold text-white shadow-sm",
                  "hover:border-indigo-800 hover:bg-indigo-800",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                  "dark:border-indigo-400 dark:bg-indigo-500 dark:text-white dark:hover:border-indigo-300 dark:hover:bg-indigo-400",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
                disabled={saving || dealBlocksSubmit}
                onClick={() => void submit()}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : null}
                Submit RFQ
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
