import { useMemo, useState } from "react";
import { ChevronDown, Search, UserRound } from "lucide-react";
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
import { PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type CrmTasksFilterUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

const KIND_CONFIG = {
  assignTo: {
    defaultLabel: "Assign To",
    allName: "All assignees",
    allSubtitle: "Show everyone's tasks",
    searchAllHints: ["all assignees", "assign to", "all"],
  },
  assignBy: {
    defaultLabel: "Assign By",
    allName: "All assigners",
    allSubtitle: "Show tasks from any assigner",
    searchAllHints: ["all assigners", "assign by", "all"],
  },
} as const;

function userMatchesSearch(user: CrmTasksFilterUser, query: string): boolean {
  if (!query) return true;
  const name = user.name.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  const phone = (user.phone ?? "").toLowerCase();
  return name.includes(query) || email.includes(query) || phone.includes(query);
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  users: CrmTasksFilterUser[];
  kind: keyof typeof KIND_CONFIG;
  align?: "start" | "end";
};

export function CrmTasksUserFilterDropdown({
  value,
  onChange,
  users,
  kind,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const config = KIND_CONFIG[kind];

  const selectedUser = useMemo(
    () => (value === "all" ? null : users.find((u) => u.id === value) ?? null),
    [value, users],
  );

  const triggerLabel = useMemo(() => {
    if (value === "all") return config.defaultLabel;
    return selectedUser?.name ?? config.defaultLabel;
  }, [value, selectedUser, config.defaultLabel]);

  const searchQuery = search.trim().toLowerCase();

  const showAllOption = useMemo(() => {
    if (!searchQuery) return true;
    return config.searchAllHints.some((hint) => hint.includes(searchQuery) || searchQuery.includes(hint));
  }, [searchQuery, config.searchAllHints]);

  const filteredUsers = useMemo(
    () => users.filter((u) => userMatchesSearch(u, searchQuery)),
    [users, searchQuery],
  );

  const hasResults = showAllOption || filteredUsers.length > 0;

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
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <UserRound className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          {selectedUser ? (
            <PmsMemberAvatar name={selectedUser.name} userId={selectedUser.id} size="xs" />
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
              placeholder="Search users…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
          {showAllOption ? (
            <PmsAssigneeFilterMenuItem
              name={config.allName}
              subtitle={config.allSubtitle}
              selected={value === "all"}
              onSelect={() => {
                onChange("all");
                setOpen(false);
              }}
              icon={<PmsAssigneeFilterAllIcon />}
            />
          ) : null}
          {filteredUsers.map((u) => (
            <PmsAssigneeFilterMenuItem
              key={u.id}
              name={u.name}
              email={u.email || undefined}
              userId={u.id}
              selected={value === u.id}
              onSelect={() => {
                onChange(u.id);
                setOpen(false);
              }}
            />
          ))}
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No users found.</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
