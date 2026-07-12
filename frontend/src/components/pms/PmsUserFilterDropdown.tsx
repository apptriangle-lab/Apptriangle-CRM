import { useMemo, useState } from "react";
import { ChevronDown, Search, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuItem,
  PmsMemberAvatar,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import {
  formatMultiFilterLabel,
  hasMultiFilter,
  toggleMultiFilterValue,
} from "@/components/pms/pmsMultiFilterUtils";
import { PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type PmsUserFilterOption = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

const DEFAULT_SEARCH_ALL_HINTS = ["all users", "show every assignee", "all"];

function userMatchesSearch(user: PmsUserFilterOption, query: string): boolean {
  if (!query) return true;
  const name = user.name.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  const phone = (user.phone ?? "").toLowerCase();
  return name.includes(query) || email.includes(query) || phone.includes(query);
}

type BaseProps = {
  users: PmsUserFilterOption[];
  defaultLabel?: string;
  allName?: string;
  allSubtitle?: string;
  searchPlaceholder?: string;
  searchAllHints?: string[];
  align?: "start" | "end";
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultipleProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

type Props = SingleProps | MultipleProps;

export function PmsUserFilterDropdown({
  value,
  onChange,
  users,
  multiple = false,
  defaultLabel = "All users",
  allName = "All users",
  allSubtitle = "Show every assignee",
  searchPlaceholder = "Search users…",
  searchAllHints = DEFAULT_SEARCH_ALL_HINTS,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = multiple ? value : value === "all" ? [] : [value];
  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.id)),
    [users, selectedIds],
  );

  const triggerLabel = useMemo(() => {
    if (multiple) {
      return formatMultiFilterLabel(defaultLabel, value, (id) => users.find((u) => u.id === id)?.name);
    }
    if (value === "all") return defaultLabel;
    return selectedUsers[0]?.name ?? defaultLabel;
  }, [multiple, value, defaultLabel, users, selectedUsers]);

  const searchQuery = search.trim().toLowerCase();

  const showAllOption = useMemo(() => {
    if (!searchQuery) return true;
    return searchAllHints.some(
      (hint) => hint.includes(searchQuery) || searchQuery.includes(hint),
    );
  }, [searchQuery, searchAllHints]);

  const filteredUsers = useMemo(
    () => users.filter((u) => userMatchesSearch(u, searchQuery)),
    [users, searchQuery],
  );

  const hasResults = showAllOption || filteredUsers.length > 0;
  const isActive = multiple ? hasMultiFilter(value) : value !== "all";

  const handleSelectAll = () => {
    if (multiple) {
      (onChange as (next: string[]) => void)([]);
      return;
    }
    (onChange as (next: string) => void)("all");
    setOpen(false);
  };

  const handleSelectUser = (userId: string) => {
    if (multiple) {
      (onChange as (next: string[]) => void)(toggleMultiFilterValue(value, userId));
      return;
    }
    (onChange as (next: string) => void)(userId);
    setOpen(false);
  };

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
          disabled={!users.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            isActive && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Users className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          {!multiple && selectedUsers[0] ? (
            <PmsMemberAvatar name={selectedUsers[0].name} userId={selectedUsers[0].id} size="xs" />
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
            multiple ? (
              <PmsAssigneeFilterMenuItem
                name={allName}
                subtitle={allSubtitle}
                selected={!selectedIds.length}
                onSelect={handleSelectAll}
                icon={<PmsAssigneeFilterAllIcon />}
                keepOpen
              />
            ) : (
              <PmsAssigneeFilterMenuItem
                name={allName}
                subtitle={allSubtitle}
                selected={value === "all"}
                onSelect={handleSelectAll}
                icon={<PmsAssigneeFilterAllIcon />}
              />
            )
          ) : null}
          {filteredUsers.map((u) =>
            multiple ? (
              <PmsAssigneeFilterMenuItem
                key={u.id}
                name={u.name}
                email={u.email || undefined}
                userId={u.id}
                selected={selectedIds.includes(u.id)}
                onSelect={() => handleSelectUser(u.id)}
                keepOpen
              />
            ) : (
              <PmsAssigneeFilterMenuItem
                key={u.id}
                name={u.name}
                email={u.email || undefined}
                userId={u.id}
                selected={value === u.id}
                onSelect={() => handleSelectUser(u.id)}
              />
            ),
          )}
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No users found.</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
