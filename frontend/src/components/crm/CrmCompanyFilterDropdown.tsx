import { useMemo, useState } from "react";
import { Building2, ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeFilterMenuItem,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type CrmCompanyFilterOption = {
  id: string;
  name: string;
  location?: string;
  country?: string;
};

const DEFAULT_SEARCH_ALL_HINTS = ["all companies", "company", "all"];

function companyMatchesSearch(company: CrmCompanyFilterOption, query: string): boolean {
  if (!query) return true;
  const name = company.name.toLowerCase();
  const location = (company.location ?? "").toLowerCase();
  const country = (company.country ?? "").toLowerCase();
  return name.includes(query) || location.includes(query) || country.includes(query);
}

function companySubtitle(company: CrmCompanyFilterOption): string | undefined {
  const parts = [company.location, company.country].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

function CompanyFilterAllIcon() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white">
      <Building2 className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
    </span>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  companies: CrmCompanyFilterOption[];
  defaultLabel?: string;
  allName?: string;
  allSubtitle?: string;
  searchPlaceholder?: string;
  searchAllHints?: string[];
  align?: "start" | "end";
};

export function CrmCompanyFilterDropdown({
  value,
  onChange,
  companies,
  defaultLabel = "All companies",
  allName = "All companies",
  allSubtitle = "Show contacts from every company",
  searchPlaceholder = "Search companies…",
  searchAllHints = DEFAULT_SEARCH_ALL_HINTS,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedCompany = useMemo(
    () => (value === "all" ? null : companies.find((c) => c.id === value) ?? null),
    [value, companies],
  );

  const triggerLabel = useMemo(() => {
    if (value === "all") return defaultLabel;
    return selectedCompany?.name ?? defaultLabel;
  }, [value, selectedCompany, defaultLabel]);

  const searchQuery = search.trim().toLowerCase();

  const showAllOption = useMemo(() => {
    if (!searchQuery) return true;
    return searchAllHints.some(
      (hint) => hint.includes(searchQuery) || searchQuery.includes(hint),
    );
  }, [searchQuery, searchAllHints]);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => companyMatchesSearch(c, searchQuery)),
    [companies, searchQuery],
  );

  const hasResults = showAllOption || filteredCompanies.length > 0;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!companies.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          {selectedCompany ? (
            <PmsMemberAvatar
              name={selectedCompany.name}
              userId={selectedCompany.id}
              size="xs"
            />
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "w-72 overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        <div
          className="border-b border-slate-100 bg-white p-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
          {showAllOption ? (
            <PmsAssigneeFilterMenuItem
              name={allName}
              subtitle={allSubtitle}
              selected={value === "all"}
              onSelect={() => {
                onChange("all");
                setOpen(false);
              }}
              icon={<CompanyFilterAllIcon />}
            />
          ) : null}
          {filteredCompanies.map((company) => (
            <PmsAssigneeFilterMenuItem
              key={company.id}
              name={company.name}
              subtitle={companySubtitle(company)}
              userId={company.id}
              selected={value === company.id}
              onSelect={() => {
                onChange(company.id);
                setOpen(false);
              }}
            />
          ))}
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No companies found.</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
