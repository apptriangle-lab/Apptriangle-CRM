import { useState } from "react";
import { Check, ChevronDown, FileStack } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  getPmsDocumentVisualByCategory,
  type PmsDocumentVisual,
} from "@/components/pms/documents/pmsDocumentVisuals";
import type { PmsDocumentFileCategory } from "@/components/pms/documents/pmsDocumentUtils";
import { cn } from "@/lib/utils";

type FileTypeOption = {
  value: string;
  label: string;
  subtitle: string;
  category?: PmsDocumentFileCategory;
};

const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  { value: "all", label: "All types", subtitle: "Show every file format" },
  { value: "image", label: "Images", subtitle: "PNG, JPG, GIF, WebP, SVG", category: "image" },
  { value: "pdf", label: "PDF", subtitle: "Portable document files", category: "pdf" },
  { value: "spreadsheet", label: "Spreadsheets", subtitle: "Excel, CSV, and sheets", category: "spreadsheet" },
  { value: "document", label: "Documents", subtitle: "Word, text, and markdown", category: "document" },
  { value: "archive", label: "Archives", subtitle: "ZIP, RAR, and compressed", category: "archive" },
  { value: "other", label: "Other", subtitle: "All remaining file types", category: "other" },
];

function FileTypeIconBadge({ visual, size = "md" }: { visual: PmsDocumentVisual; size?: "sm" | "md" }) {
  const Icon = visual.icon;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-black/[0.04]",
        size === "sm" ? "h-5 w-5" : "h-7 w-7",
        visual.iconBg,
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", visual.iconColor)} />
    </span>
  );
}

function FileTypeFilterMenuItem({
  option,
  selected,
  onSelect,
}: {
  option: FileTypeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const visual = option.category ? getPmsDocumentVisualByCategory(option.category) : null;

  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        PMS_ASSIGNEE_OPTION_ITEM_CLASS,
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-violet-50 data-[highlighted]:to-indigo-50 data-[highlighted]:text-slate-900",
        "focus:bg-gradient-to-r focus:from-violet-50 focus:to-indigo-50 focus:text-slate-900",
        selected && "bg-violet-50/90 text-violet-950",
      )}
      onClick={onSelect}
    >
      {visual ? (
        <FileTypeIconBadge visual={visual} />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 ring-1 ring-inset ring-black/[0.04]">
          <FileStack className="h-3.5 w-3.5 text-slate-500" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
        <p className="truncate text-xs text-slate-500">{option.subtitle}</p>
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-violet-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  align?: "start" | "end";
};

export function PmsDocumentFileTypeFilterDropdown({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = FILE_TYPE_OPTIONS.find((option) => option.value === value) ?? FILE_TYPE_OPTIONS[0];
  const selectedVisual = selected.category ? getPmsDocumentVisualByCategory(selected.category) : null;
  const isFiltered = value !== "all";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50",
            isFiltered && "border-violet-300 bg-violet-50/60 text-violet-900 hover:bg-violet-50",
          )}
        >
          {isFiltered && selectedVisual ? (
            <FileTypeIconBadge visual={selectedVisual} size="sm" />
          ) : (
            <FileStack className="h-4 w-4 shrink-0 text-violet-600" />
          )}
          <span className="max-w-[120px] truncate">{isFiltered ? selected.label : "File type"}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "w-72 overflow-hidden rounded-xl border border-slate-200 p-0 shadow-lg",
          PMS_ASSIGNEE_MENU_OVERRIDES,
        )}
      >
        <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">File type</p>
          <p className="mt-0.5 text-xs text-slate-500">Filter documents by format</p>
        </div>
        <div className="max-h-[min(320px,50vh)] overflow-y-auto p-1.5 scrollbar-thinner">
          {FILE_TYPE_OPTIONS.map((option) => (
            <FileTypeFilterMenuItem
              key={option.value}
              option={option}
              selected={value === option.value}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
