import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useRbac } from "@/contexts/RbacContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader } from "@/components/ui/loader";
import { EmptyState } from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { companiesApi, rfqApi, type CompanyDto, type RfqStatus, type RfqSummaryDto } from "@/lib/api";
import { toast } from "sonner";
import { Plus, FileText, Search, ChevronsUpDown } from "lucide-react";
import { cn, formatTableDate } from "@/lib/utils";
import { RfqReopenedChip, RfqStatusBadge, RFQ_STATUS_LABEL } from "@/components/rfq/RfqStatusBadge";
import {
  rfqPageShell,
  rfqPageInner,
  rfqPageGutter,
  rfqPageContentY,
  rfqPrimaryBtn,
} from "@/components/rfq/rfq-styles";

const STATUS_FILTER_ORDER: RfqStatus[] = [
  "draft",
  "pending_rbac",
  "pending_system",
  "approved",
  "rejected",
];

/** Not an API status — RFQs with version &gt; 1 (reopened at least once). */
type RfqStatusFilter = RfqStatus | "all" | "reopened";

export default function RfqList() {
  const navigate = useNavigate();
  const { canAccessModule } = useRbac();
  const [rows, setRows] = useState<RfqSummaryDto[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<RfqStatusFilter>("all");
  const [filterCompanyOpen, setFilterCompanyOpen] = useState(false);
  const [filterCompanySearchValue, setFilterCompanySearchValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rfqApi.list();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load RFQs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAccessModule("rfq")) return;
    companiesApi
      .list()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [canAccessModule]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterCompany !== "all") {
      list = list.filter((r) => r.companyId === filterCompany);
    }
    if (filterStatus !== "all") {
      if (filterStatus === "reopened") {
        list = list.filter((r) => (r.versionNumber ?? 1) > 1);
      } else {
        list = list.filter((r) => r.status === filterStatus);
      }
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const deal = (r.deal?.prospect ?? "").toLowerCase();
        const cust = (r.customer?.name ?? "").toLowerCase();
        const notes = (r.notesOverall ?? "").toLowerCase();
        const requester = (r.createdBy?.name ?? r.createdBy?.email ?? "").toLowerCase();
        return (
          deal.includes(q) ||
          cust.includes(q) ||
          notes.includes(q) ||
          r.id.toLowerCase().includes(q) ||
          requester.includes(q)
        );
      });
    }
    return list;
  }, [rows, search, filterCompany, filterStatus]);

  if (!canAccessModule("rfq")) {
    return (
      <Layout>
        <div className={cn(rfqPageShell, "flex flex-1 items-center justify-center p-8 text-slate-600 dark:text-slate-400")}>
          You don&apos;t have access to RFQ. Ask an administrator to assign the RFQ module in Settings → RBAC.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn(rfqPageShell, "flex min-h-0 flex-1 flex-col")}>
        <div className={cn(rfqPageInner, rfqPageGutter, rfqPageContentY)}>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deal, customer, notes…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search RFQs"
              />
            </div>
            <Popover
              open={filterCompanyOpen}
              onOpenChange={(o) => {
                setFilterCompanyOpen(o);
                if (!o) setFilterCompanySearchValue("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={filterCompanyOpen}
                  className="h-10 w-[min(100%,12rem)] min-w-[12rem] justify-between font-normal sm:w-56"
                >
                  <span className="truncate text-left">
                    {filterCompany === "all"
                      ? "All customers"
                      : (() => {
                          const c = companies.find((x) => x.id === filterCompany);
                          return c
                            ? c.location || c.country
                              ? `${c.name} · ${[c.location, c.country].filter(Boolean).join(", ")}`
                              : c.name
                            : "All customers";
                        })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search customers…"
                    value={filterCompanySearchValue}
                    onValueChange={setFilterCompanySearchValue}
                  />
                  <CommandList>
                    {companies.filter((comp) => {
                      const q = filterCompanySearchValue.toLowerCase();
                      return (
                        !filterCompanySearchValue ||
                        comp.name.toLowerCase().includes(q) ||
                        comp.location?.toLowerCase().includes(q) ||
                        comp.country?.toLowerCase().includes(q)
                      );
                    }).length === 0 &&
                      filterCompanySearchValue && <CommandEmpty>No customer found.</CommandEmpty>}
                    <CommandGroup>
                      <CommandItem
                        value="all customers"
                        onSelect={() => {
                          setFilterCompany("all");
                          setFilterCompanyOpen(false);
                          setFilterCompanySearchValue("");
                        }}
                      >
                        <span className="font-medium">All customers</span>
                      </CommandItem>
                      {companies
                        .filter((comp) => {
                          const q = filterCompanySearchValue.toLowerCase();
                          return (
                            !filterCompanySearchValue ||
                            comp.name.toLowerCase().includes(q) ||
                            comp.location?.toLowerCase().includes(q) ||
                            comp.country?.toLowerCase().includes(q)
                          );
                        })
                        .map((comp) => (
                          <CommandItem
                            key={comp.id}
                            value={`${comp.name} ${comp.location} ${comp.country}`}
                            onSelect={() => {
                              setFilterCompany(comp.id);
                              setFilterCompanyOpen(false);
                              setFilterCompanySearchValue("");
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{comp.name}</span>
                              {(comp.location || comp.country) && (
                                <span className="text-xs text-muted-foreground">
                                  {[comp.location, comp.country].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as RfqStatusFilter)}
            >
              <SelectTrigger className="h-10 w-[min(100%,11rem)] min-w-[11rem] sm:w-52">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="reopened">Reopened</SelectItem>
                {STATUS_FILTER_ORDER.map((st) => (
                  <SelectItem key={st} value={st}>
                    {RFQ_STATUS_LABEL[st] ?? st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button asChild className={cn(rfqPrimaryBtn, "h-10 shrink-0 px-5")}>
              <Link to="/rfq/new">
                <Plus className="mr-2 h-4 w-4" />
                New RFQ
              </Link>
            </Button>
          </div>

          {loading ? (
            <Loader message="Loading RFQs…" size="lg" className="py-16" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No RFQs yet"
              description="Start by linking a deal and adding products for your quote request."
              actionLabel="Create RFQ"
              onAction={() => navigate("/rfq/new")}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No RFQs match your filters"
              description="Try adjusting search, customer, or status."
            />
          ) : (
            <div className="data-table overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Deal ({filtered.length})</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="min-w-[140px]">Requested by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/rfq/${r.id}`)}
                    >
                      <TableCell className="font-medium">{r.deal?.prospect ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.customer?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="text-foreground">
                          {r.createdBy?.name?.trim() || r.createdBy?.email || "—"}
                        </span>
                        {r.createdBy?.name?.trim() && r.createdBy?.email ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{r.createdBy.email}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <RfqStatusBadge status={r.status} />
                          {(r.versionNumber ?? 1) > 1 ? <RfqReopenedChip /> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatTableDate(r.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
