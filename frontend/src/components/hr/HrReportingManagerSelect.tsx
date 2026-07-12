import { useMemo, useState } from "react";
import { Search, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  PMS_ASSIGNEE_COMMAND_OVERRIDES,
  PMS_ASSIGNEE_OPTION_ITEM_CLASS,
  PmsAssigneeOptionRow,
  PmsMemberAvatar,
} from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

type UserOption = { id: string; name: string; email?: string };

type Props = {
  value: string;
  onChange: (userId: string) => void;
  users: UserOption[];
  excludeUserId?: string;
  placeholder?: string;
  className?: string;
};

function ManagerCommandItem({
  user,
  selected,
  onSelect,
}: {
  user: UserOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${user.name} ${user.email ?? ""}`}
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "aria-selected:bg-gradient-to-r aria-selected:from-sky-50 aria-selected:to-indigo-50",
        selected && "bg-indigo-50/80",
      )}
      onSelect={onSelect}
    >
      <PmsAssigneeOptionRow
        name={user.name}
        email={user.email}
        userId={user.id}
        selected={selected}
      />
    </CommandItem>
  );
}

export function HrReportingManagerSelect({
  value,
  onChange,
  users,
  excludeUserId,
  placeholder = "Select manager",
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => users.filter((u) => u.id !== excludeUserId),
    [excludeUserId, users],
  );

  const selected = options.find((u) => u.id === value);
  const hasValue = Boolean(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            hasValue && "border-indigo-200 bg-indigo-50/40 text-indigo-950 hover:bg-indigo-50/60",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <PmsMemberAvatar name={selected.name} userId={selected.id} size="xs" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <User className="h-3 w-3 text-slate-400" />
              </span>
            )}
            <span className="truncate">{selected?.name ?? placeholder}</span>
          </span>
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg"
      >
        <Command className={cn(PMS_ASSIGNEE_COMMAND_OVERRIDES)}>
          <CommandInput placeholder="Search manager…" className="h-10" />
          <CommandList className="max-h-[min(280px,45vh)]">
            <CommandEmpty>No manager found.</CommandEmpty>
            <CommandGroup className="p-1.5">
              {options.map((user) => (
                <ManagerCommandItem
                  key={user.id}
                  user={user}
                  selected={value === user.id}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
