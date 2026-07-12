import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, ChevronDown, Search, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsTaskDatePicker,
  type PmsDateRange,
} from "@/components/pms/PmsTaskDatePicker";
import {
  PmsAssigneeFilterAllIcon,
  PmsAssigneeFilterMenuItem,
  PmsMemberAvatar,
} from "@/components/pms/PmsAssigneeFilterMenuItem";
import { PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import type { PmsResourceUserDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import { getDefaultResourceFilterDateRange } from "@/components/pms/resource/resourceContributionDays";
import { formatResourceRangeMonthLabel } from "@/utils/pmsResourceDates";

export type ResourceUserFilter = "all" | "me" | string;

function userMatchesSearch(user: PmsResourceUserDto, query: string): boolean {
  if (!query) return true;
  const name = (user.userName ?? "").toLowerCase();
  const email = (user.userEmail ?? "").toLowerCase();
  return name.includes(query) || email.includes(query);
}

type Props = {
  range: PmsDateRange;
  onRangeChange: (range: PmsDateRange) => void;
  userFilter: ResourceUserFilter;
  onUserFilterChange: (filter: ResourceUserFilter) => void;
  users?: PmsResourceUserDto[];
  currentUserId?: string | null;
};

export function ResourceFilterBar({
  range,
  onRangeChange,
  userFilter,
  onUserFilterChange,
  users = [],
  currentUserId,
}: Props) {
  const [dateOpen, setDateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const rangeLabel = useMemo(() => {
    const from = range.startDate;
    const to = range.endDate;
    if (!from && !to) return "Select date range";
    if (from && !to) return `${format(from, "MMMM yyyy")} · from ${format(from, "MMM d")}`;
    if (!from && to) return `${format(to, "MMMM yyyy")} · until ${format(to, "MMM d")}`;
    const monthLabel = formatResourceRangeMonthLabel(from!, to!);
    return `${monthLabel} · ${format(from!, "MMM d")} – ${format(to!, "MMM d")}`;
  }, [range]);

  const userFilterLabel = useMemo(() => {
    if (userFilter === "all") return "All users";
    if (userFilter === "me") {
      const me = users.find((u) => u.userId === currentUserId);
      return me?.userName ?? me?.userEmail ?? "Me";
    }
    const selected = users.find((u) => u.userId === userFilter);
    return selected?.userName ?? selected?.userEmail ?? "User";
  }, [userFilter, users, currentUserId]);

  const selectedUserProfile = useMemo(() => {
    if (userFilter === "all") return null;
    const userId = userFilter === "me" ? currentUserId : userFilter;
    if (!userId) return null;
    const selected = users.find((u) => u.userId === userId);
    if (!selected) return null;
    return {
      userId,
      name: selected.userName ?? selected.userEmail ?? "Member",
    };
  }, [userFilter, users, currentUserId]);

  const otherUsers = useMemo(
    () => users.filter((u) => u.userId !== currentUserId),
    [users, currentUserId],
  );

  const showMeOption = Boolean(currentUserId && users.some((u) => u.userId === currentUserId));

  const meUser = useMemo(
    () => (currentUserId ? users.find((u) => u.userId === currentUserId) : undefined),
    [users, currentUserId],
  );

  const searchQuery = userSearch.trim().toLowerCase();

  const showAllUsersOption = useMemo(() => {
    if (!searchQuery) return true;
    return (
      "all users".includes(searchQuery) ||
      "show every assignee".includes(searchQuery) ||
      "all".includes(searchQuery)
    );
  }, [searchQuery]);

  const showMeInResults = showMeOption && meUser && userMatchesSearch(meUser, searchQuery);

  const filteredOtherUsers = useMemo(
    () => otherUsers.filter((u) => userMatchesSearch(u, searchQuery)),
    [otherUsers, searchQuery],
  );

  const hasUserResults = showAllUsersOption || showMeInResults || filteredOtherUsers.length > 0;

  const isDefaultRange = useMemo(() => {
    const { from, to } = getDefaultResourceFilterDateRange();
    return (
      range.startDate?.getTime() === from.getTime() &&
      range.endDate?.getTime() === to.getTime()
    );
  }, [range]);

  const handleClearRange = () => {
    onRangeChange(buildDefaultResourceRange());
  };

  return (
    <div className="flex h-[52px] items-center gap-2">
      <DropdownMenu
        open={userMenuOpen}
        onOpenChange={(open) => {
          setUserMenuOpen(open);
          if (!open) setUserSearch("");
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={!users.length}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
              userFilter !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
            )}
          >
            <Users className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="max-w-[160px] truncate">{userFilterLabel}</span>
            {selectedUserProfile ? (
              <PmsMemberAvatar
                name={selectedUserProfile.name}
                userId={selectedUserProfile.userId}
                size="xs"
              />
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
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search users…"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
            {showAllUsersOption ? (
              <PmsAssigneeFilterMenuItem
                name="All users"
                subtitle="Show every assignee"
                selected={userFilter === "all"}
                onSelect={() => {
                  onUserFilterChange("all");
                  setUserMenuOpen(false);
                }}
                icon={<PmsAssigneeFilterAllIcon />}
              />
            ) : null}
            {showMeInResults ? (
              <PmsAssigneeFilterMenuItem
                name={meUser?.userName ?? "Me"}
                email={meUser?.userEmail ?? undefined}
                userId={currentUserId ?? undefined}
                selected={userFilter === "me"}
                onSelect={() => {
                  onUserFilterChange("me");
                  setUserMenuOpen(false);
                }}
              />
            ) : null}
            {filteredOtherUsers.map((u) => (
              <PmsAssigneeFilterMenuItem
                key={u.userId}
                name={u.userName ?? u.userEmail ?? "Member"}
                email={u.userEmail ?? undefined}
                userId={u.userId}
                selected={userFilter === u.userId}
                onSelect={() => {
                  onUserFilterChange(u.userId);
                  setUserMenuOpen(false);
                }}
              />
            ))}
            {!hasUserResults ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No users found.</p>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <PmsTaskDatePicker
        value={range}
        onChange={onRangeChange}
        rangeSelect
        hideRangeFields
        clearAtBottom
        clearLabel="This month"
        clearDisabled={isDefaultRange}
        onClear={handleClearRange}
        open={dateOpen}
        onOpenChange={setDateOpen}
        modal={false}
      >
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Calendar className="h-4 w-4 text-indigo-600" />
          <span>{rangeLabel}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </PmsTaskDatePicker>
    </div>
  );
}

export function buildDefaultResourceRange(): PmsDateRange {
  const { from, to } = getDefaultResourceFilterDateRange();
  return { startDate: from, endDate: to };
}
