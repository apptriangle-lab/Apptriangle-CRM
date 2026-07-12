import { useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

export type AssigneeOption = { id: string; name: string; email?: string; phone?: string };

const AVATAR_BG = ["bg-slate-800", "bg-teal-600", "bg-sky-600", "bg-orange-500", "bg-violet-600", "bg-rose-500"];

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function PmsMemberAvatar({
  name,
  userId,
  size = "sm",
  className,
  hideTitle = false,
}: {
  name: string;
  userId?: string;
  size?: "sm" | "md" | "xs";
  className?: string;
  hideTitle?: boolean;
}) {
  const idx = userId ? [...userId].reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  const dim =
    size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white",
        dim,
        AVATAR_BG[idx % AVATAR_BG.length],
        className,
      )}
      title={hideTitle ? undefined : name}
    >
      {memberInitials(name)}
    </span>
  );
}

function UserAvatar({ name, userId, size = "sm" }: { name: string; userId: string; size?: "sm" | "md" }) {
  return <PmsMemberAvatar name={name} userId={userId} size={size} />;
}

export const PMS_ASSIGNEE_OPTION_ITEM_CLASS =
  "mx-1 flex cursor-pointer items-center gap-3 rounded-lg bg-transparent px-2.5 py-2.5 text-slate-900 outline-none";

/** Kill cmdk's teal accent highlight on assignee command lists. */
export const PMS_ASSIGNEE_COMMAND_OVERRIDES =
  "[&_[cmdk-item]]:bg-transparent [&_[cmdk-item][data-selected=true]]:!bg-gradient-to-r [&_[cmdk-item][data-selected=true]]:!from-sky-50 [&_[cmdk-item][data-selected=true]]:!to-indigo-50 [&_[cmdk-item][data-selected=true]]:!text-slate-900";

/** Kill Radix menu teal accent on assignee filter dropdowns. */
export const PMS_ASSIGNEE_MENU_OVERRIDES =
  "[&_[role=menuitem]]:bg-transparent [&_[role=menuitem][data-highlighted]]:!bg-gradient-to-r [&_[role=menuitem][data-highlighted]]:!from-sky-50 [&_[role=menuitem][data-highlighted]]:!to-indigo-50 [&_[role=menuitem][data-highlighted]]:!text-slate-900";

function AssigneeCommandItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[selected=true]:bg-gradient-to-r data-[selected=true]:from-sky-50 data-[selected=true]:to-indigo-50 data-[selected=true]:text-slate-900",
        className,
      )}
      {...props}
    />
  );
}

export function PmsAssigneeOptionRow({
  name,
  email,
  userId,
  subtitle,
  selected,
  icon,
}: {
  name: string;
  email?: string;
  userId?: string;
  subtitle?: string;
  selected?: boolean;
  icon?: ReactNode;
}) {
  const detail = email ?? subtitle;
  return (
    <>
      {icon ?? <PmsMemberAvatar name={name} userId={userId} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {detail ? <p className="truncate text-xs text-slate-500">{detail}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </>
  );
}

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  options: AssigneeOption[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  /** Icon-only trigger for compact inline editors */
  iconOnly?: boolean;
  /** Set false when used inside a dialog so the popover stays interactive */
  modal?: boolean;
};

export function PmsTaskAssigneesPicker({
  value,
  onChange,
  options,
  disabled,
  open: controlledOpen,
  onOpenChange,
  placeholder = "Assignees",
  iconOnly = false,
  modal = true,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const selected = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => options.filter((o) => selected.has(o.id)),
    [options, selected],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const label =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].name
        : `${selectedOptions.length} assignees`;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "transition-colors disabled:opacity-50",
            iconOnly
              ? cn(
                  "rounded p-1 hover:bg-white/80",
                  selectedOptions.length ? "text-slate-700" : "text-slate-400 hover:text-slate-600",
                )
              : cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-50",
                  selectedOptions.length ? "text-slate-900" : "text-slate-400",
                ),
          )}
          title={iconOnly ? (selectedOptions.length ? label : "Assign") : undefined}
        >
          {selectedOptions.length > 0 ? (
            <span className={cn("flex flex-wrap items-center gap-0.5", !iconOnly && "max-w-full")}>
              {selectedOptions.map((a) => (
                <UserAvatar key={a.id} name={a.name} userId={a.id} size="sm" />
              ))}
            </span>
          ) : (
            <User className={cn("shrink-0", iconOnly ? "h-4 w-4" : "h-3.5 w-3.5")} />
          )}
          {!iconOnly && (
            <>
              <span className="truncate text-[14px]">{label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-72 rounded-xl border-slate-200 p-0 shadow-lg", PMS_ASSIGNEE_COMMAND_OVERRIDES)}
      >
        <Command className={cn("rounded-xl", PMS_ASSIGNEE_COMMAND_OVERRIDES)}>
          <CommandInput
            placeholder="Search by name or email…"
            className="h-10 border-0 border-b border-slate-100"
          />
          <CommandList className="max-h-[min(360px,55vh)] overflow-y-auto p-1.5">
            <CommandEmpty className="py-6 text-center text-sm text-slate-500">
              No user found.
            </CommandEmpty>
            <CommandGroup className="p-0">
              {options.map((a) => {
                const isOn = selected.has(a.id);
                return (
                  <AssigneeCommandItem
                    key={a.id}
                    value={`${a.name} ${a.email ?? ""} ${a.phone ?? ""}`}
                    onSelect={() => toggle(a.id)}
                    className={cn(isOn && "bg-indigo-50/80 text-indigo-950")}
                  >
                    <PmsAssigneeOptionRow
                      name={a.name}
                      email={a.email}
                      userId={a.id}
                      selected={isOn}
                    />
                  </AssigneeCommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Read-only avatar stack for task list rows. */
export function PmsTaskAssigneeAvatars({
  assignees,
  fallbackName,
  fallbackUserId,
  emptyIcon,
}: {
  assignees?: { userId: string; userName?: string | null }[];
  fallbackName?: string | null;
  fallbackUserId?: string | null;
  emptyIcon?: ReactNode;
}) {
  const list =
    assignees && assignees.length > 0
      ? assignees
      : fallbackUserId && fallbackName
        ? [{ userId: fallbackUserId, userName: fallbackName }]
        : [];

  if (list.length === 0) {
    return emptyIcon ?? <span className="text-slate-300">—</span>;
  }

  return (
    <span
      className="flex flex-wrap items-center justify-center gap-0.5"
      title={list.map((a) => a.userName ?? "").join(", ")}
    >
      {list.map((a) => (
        <UserAvatar key={a.userId} name={a.userName ?? "?"} userId={a.userId} />
      ))}
    </span>
  );
}
