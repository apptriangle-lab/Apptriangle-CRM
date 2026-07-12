import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_OPTION_ITEM_CLASS, PMS_ASSIGNEE_MENU_OVERRIDES } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  formatMultiFilterLabel,
  hasMultiFilter,
  toggleMultiFilterValue,
} from "@/components/pms/pmsMultiFilterUtils";
import { buildProjectTypeColorIndexMap, projectTypeDotClass } from "@/components/pms/projectTypeChipStyles";
import { settingsService, type ProjectTypeDto } from "@/services/settingsService";
import { cn } from "@/lib/utils";

function TypeFilterMenuItem({
  name,
  subtitle,
  typeId,
  colorIndex,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
  typeId?: string;
  colorIndex?: number;
  selected: boolean;
  onSelect: () => void;
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
        event.preventDefault();
        onSelect();
      }}
    >
      {typeId ? (
        <span
          className={cn("h-3 w-3 shrink-0 rounded-full", projectTypeDotClass(typeId, colorIndex))}
          aria-hidden
        />
      ) : (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-slate-300" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  align?: "start" | "end";
};

export function PmsProjectTypeFilterDropdown({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<ProjectTypeDto[]>([]);

  useEffect(() => {
    settingsService
      .listProjectTypes()
      .then(setTypes)
      .catch(() => setTypes([]));
  }, []);

  const colorIndexById = useMemo(() => buildProjectTypeColorIndexMap(types), [types]);
  const typeNameById = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t.name])), [types]);
  const triggerLabel = formatMultiFilterLabel("Type", value, (id) => typeNameById[id]);
  const singleSelectedColorIndex = value.length === 1 ? colorIndexById.get(value[0]) : undefined;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50",
            hasMultiFilter(value) && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <FolderKanban className="h-4 w-4 shrink-0 text-indigo-600" />
          {value.length === 1 ? (
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", projectTypeDotClass(value[0], singleSelectedColorIndex))}
              aria-hidden
            />
          ) : null}
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "max-h-[min(320px,50vh)] w-72 overflow-y-auto rounded-xl border-slate-200 p-1.5 shadow-lg scrollbar-thinner",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        <TypeFilterMenuItem
          name="All types"
          subtitle="Show projects of any type"
          selected={!value.length}
          onSelect={() => onChange([])}
        />
        {types.map((type) => (
          <TypeFilterMenuItem
            key={type.id}
            typeId={type.id}
            colorIndex={colorIndexById.get(type.id)}
            name={type.name}
            selected={value.includes(type.id)}
            onSelect={() => onChange(toggleMultiFilterValue(value, type.id))}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
