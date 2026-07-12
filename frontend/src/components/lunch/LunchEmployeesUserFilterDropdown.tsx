import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, UserRound, Users } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeOptionRow,
  PMS_ASSIGNEE_OPTION_ITEM_CLASS,
  PMS_ASSIGNEE_MENU_OVERRIDES,
  PmsMemberAvatar,
} from "@/components/pms/PmsTaskAssigneesPicker";
import type { LunchEmployeeBalanceDto } from "@/lib/lunchApi";
import { cn } from "@/lib/utils";

export const LUNCH_EMPLOYEES_ALL = "all";

export function employeeMatchesSearch(user: LunchEmployeeBalanceDto, query: string): boolean {
  if (!query) return true;
  return user.userName.toLowerCase().includes(query);
}

function employeeMatchesDropdownSearch(user: LunchEmployeeBalanceDto, query: string): boolean {
  if (!query) return true;
  const name = user.userName.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  return name.includes(query) || email.includes(query);
}

function OrangeFilterMenuItem({
  name,
  email,
  userId,
  subtitle,
  selected,
  onSelect,
  icon,
}: {
  name: string;
  email?: string;
  userId?: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-orange-50 data-[highlighted]:to-amber-50",
        selected && "bg-orange-50/80 text-orange-950",
      )}
      onSelect={onSelect}
    >
      <PmsAssigneeOptionRow
        name={name}
        email={email}
        userId={userId}
        subtitle={subtitle}
        selected={selected}
        icon={icon}
      />
      {selected ? <Check className="h-4 w-4 shrink-0 text-orange-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  employees: LunchEmployeeBalanceDto[];
  align?: "start" | "end";
};

export function LunchEmployeesUserFilterDropdown({
  value,
  onChange,
  employees,
  align = "end",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedUser = useMemo(
    () => (value === LUNCH_EMPLOYEES_ALL ? null : employees.find((e) => e.userId === value) ?? null),
    [value, employees],
  );

  const triggerLabel = useMemo(() => {
    if (value === LUNCH_EMPLOYEES_ALL) return "All employees";
    return selectedUser?.userName ?? "Employee";
  }, [value, selectedUser]);

  const searchQuery = search.trim().toLowerCase();

  const showAllOption = useMemo(() => {
    if (!searchQuery) return true;
    return (
      "all employees".includes(searchQuery) ||
      searchQuery.includes("all") ||
      searchQuery.includes("every") ||
      searchQuery.includes("employee")
    );
  }, [searchQuery]);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => employeeMatchesDropdownSearch(e, searchQuery)),
    [employees, searchQuery],
  );

  const hasResults = showAllOption || filteredEmployees.length > 0;

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
          disabled={!employees.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/30 disabled:cursor-not-allowed disabled:opacity-50",
            value !== LUNCH_EMPLOYEES_ALL &&
              "border-orange-300 bg-orange-50/60 text-orange-900 hover:bg-orange-50",
          )}
        >
          <UserRound className="h-4 w-4 shrink-0 text-orange-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          {selectedUser ? (
            <PmsMemberAvatar name={selectedUser.userName} userId={selectedUser.userId} size="xs" />
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "w-72 overflow-hidden rounded-xl border-orange-100 p-0 shadow-lg",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        <div className="border-b border-orange-50 bg-white p-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search users…"
              className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
          {showAllOption ? (
            <OrangeFilterMenuItem
              name="All employees"
              subtitle="Show everyone's balances"
              selected={value === LUNCH_EMPLOYEES_ALL}
              onSelect={() => {
                onChange(LUNCH_EMPLOYEES_ALL);
                setOpen(false);
              }}
              icon={
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200/80 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-600">
                  <Users className="h-3.5 w-3.5" />
                </span>
              }
            />
          ) : null}
          {filteredEmployees.map((emp) => (
            <OrangeFilterMenuItem
              key={emp.userId}
              name={emp.userName}
              email={emp.email || undefined}
              userId={emp.userId}
              selected={value === emp.userId}
              onSelect={() => {
                onChange(emp.userId);
                setOpen(false);
              }}
            />
          ))}
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-stone-500">No users found.</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
