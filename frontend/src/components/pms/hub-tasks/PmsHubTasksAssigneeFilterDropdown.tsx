import { useMemo, useState } from "react";
import { ChevronDown, Search, UserRound, Users } from "lucide-react";
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
import type { AssigneeFilter } from "@/lib/pmsViewFiltersStorage";
import { cn } from "@/lib/utils";

export type HubAssigneeUserOption = {
  id: string;
  name: string;
  email?: string;
};

function userMatchesSearch(user: HubAssigneeUserOption, query: string): boolean {
  if (!query) return true;
  const name = user.name.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  return name.includes(query) || email.includes(query);
}

type Props = {
  value: AssigneeFilter;
  onChange: (value: AssigneeFilter) => void;
  users: HubAssigneeUserOption[];
};

export function PmsHubTasksAssigneeFilterDropdown({ value, onChange, users }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedUser = useMemo(
    () => (value !== "me" && value !== "all" ? users.find((u) => u.id === value) ?? null : null),
    [value, users],
  );

  const triggerLabel = useMemo(() => {
    if (value === "me") return "My tasks";
    if (value === "all") return "All users";
    return selectedUser?.name ?? "User";
  }, [value, selectedUser]);

  const searchQuery = search.trim().toLowerCase();
  const showMyTasks =
    !searchQuery || "my tasks".includes(searchQuery) || searchQuery.includes("my");
  const showAllUsers =
    !searchQuery ||
    "all users".includes(searchQuery) ||
    searchQuery.includes("all") ||
    searchQuery.includes("every");

  const filteredUsers = useMemo(
    () => users.filter((u) => userMatchesSearch(u, searchQuery)),
    [users, searchQuery],
  );

  const hasResults = showMyTasks || showAllUsers || filteredUsers.length > 0;

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
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            value !== "me" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <Users className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          {selectedUser ? (
            <PmsMemberAvatar name={selectedUser.name} userId={selectedUser.id} size="xs" />
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
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
          {showMyTasks ? (
            <PmsAssigneeFilterMenuItem
              name="My tasks"
              subtitle="Tasks assigned to you"
              selected={value === "me"}
              onSelect={() => {
                onChange("me");
                setOpen(false);
              }}
              icon={
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 ring-2 ring-white">
                  <UserRound className="h-3.5 w-3.5 text-indigo-600" strokeWidth={1.75} />
                </span>
              }
            />
          ) : null}
          {showAllUsers ? (
            <PmsAssigneeFilterMenuItem
              name="All users"
              subtitle="Show every user's tasks"
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
              email={u.email}
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
