import type { ReactNode } from "react";
import { User } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import {
  PmsAssigneeOptionRow,
  PMS_ASSIGNEE_OPTION_ITEM_CLASS,
  PMS_ASSIGNEE_MENU_OVERRIDES,
  PmsMemberAvatar,
} from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export function PmsAssigneeFilterMenuItem({
  name,
  email,
  userId,
  subtitle,
  selected,
  onSelect,
  icon,
  keepOpen = false,
}: {
  name: string;
  email?: string;
  userId?: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  keepOpen?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-sky-50 data-[highlighted]:to-indigo-50 data-[highlighted]:text-slate-900",
        "focus:bg-gradient-to-r focus:from-sky-50 focus:to-indigo-50 focus:text-slate-900",
        selected && "bg-indigo-50/80 text-indigo-950",
      )}
      onSelect={(event) => {
        if (keepOpen) {
          event.preventDefault();
        }
        onSelect();
      }}
    >
      <PmsAssigneeOptionRow
        name={name}
        email={email}
        userId={userId}
        subtitle={subtitle}
        selected={selected}
        icon={icon}
      />
    </DropdownMenuPrimitive.Item>
  );
}

export function PmsAssigneeFilterMenuContent({
  children,
  className,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenuContent
      align={align}
      className={cn(
        "max-h-[min(360px,55vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg",
        PMS_ASSIGNEE_MENU_OVERRIDES,
        className,
      )}
    >
      {children}
    </DropdownMenuContent>
  );
}

export function PmsAssigneeFilterAllIcon() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white">
      <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
    </span>
  );
}

// Re-export for convenience
export { PmsMemberAvatar };
