import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, FolderKanban, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { buildProjectTypeColorIndexMap, projectTypeDotClass } from "@/components/pms/projectTypeChipStyles";
import { settingsService, type ProjectTypeDto } from "@/services/settingsService";

type ProjectTypeDropdownProps = {
  value: string;
  onChange: (projectTypeId: string) => void;
  /** Pre-loaded options; when omitted, fetches active types from API. */
  options?: ProjectTypeDto[];
  disabled?: boolean;
  error?: string;
  required?: boolean;
  label?: string;
  placeholder?: string;
};

export function ProjectTypeDropdown({
  value,
  onChange,
  options: optionsProp,
  disabled = false,
  error,
  required = false,
  label = "Project type",
  placeholder = "Choose project type",
}: ProjectTypeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fetched, setFetched] = useState<ProjectTypeDto[]>([]);
  const [loading, setLoading] = useState(!optionsProp);

  useEffect(() => {
    if (optionsProp) {
      setLoading(false);
      return;
    }
    setLoading(true);
    settingsService
      .listProjectTypes()
      .then(setFetched)
      .catch(() => setFetched([]))
      .finally(() => setLoading(false));
  }, [optionsProp]);

  const options = optionsProp ?? fetched;
  const colorIndexById = useMemo(() => buildProjectTypeColorIndexMap(options), [options]);
  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {required ? <span className="text-violet-600 dark:text-violet-400"> *</span> : null}
      </Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-all",
              "bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25",
              "disabled:cursor-not-allowed disabled:opacity-60",
              error && "ring-2 ring-rose-400/40",
              open && "bg-white ring-2 ring-violet-500/15 dark:bg-slate-900 dark:ring-violet-500/20",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                selected
                  ? "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                  : "bg-white text-slate-400 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700",
              )}
            >
              {selected ? (
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    projectTypeDotClass(value, colorIndexById.get(value)),
                  )}
                />
              ) : (
                <FolderKanban className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {loading ? (
                <span className="text-slate-400">Loading types…</span>
              ) : selected ? (
                <span className="font-medium text-slate-900 dark:text-slate-100">{selected.name}</span>
              ) : (
                <span className="text-slate-400">{placeholder}</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-violet-200/70 bg-white p-0 shadow-xl shadow-violet-500/10 dark:border-violet-800/50 dark:bg-slate-950 dark:shadow-violet-950/30"
        >
          {loading ? (
            <Loader message="Loading project types…" className="py-8" />
          ) : (
            <Command
              shouldFilter={false}
              className="bg-white dark:bg-slate-950 [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:px-0 [&_[cmdk-input-wrapper]_svg]:hidden [&_[cmdk-item][data-selected=true]]:bg-violet-50 [&_[cmdk-item][data-selected=true]]:text-violet-950 dark:[&_[cmdk-item][data-selected=true]]:bg-violet-500/15 dark:[&_[cmdk-item][data-selected=true]]:text-violet-50"
            >
              <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-indigo-50/80 to-fuchsia-50/60 px-3 py-2.5 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-indigo-950/30 dark:to-fuchsia-950/20">
                <Search className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
                <CommandInput
                  placeholder="Search project types"
                  value={search}
                  onValueChange={setSearch}
                  className="h-8 border-0 bg-transparent p-0 text-sm text-violet-950 shadow-none placeholder:text-violet-400/70 focus-visible:ring-0 dark:text-violet-50 dark:placeholder:text-violet-400/50"
                />
              </div>
              <CommandList className="max-h-[min(240px,40vh)] p-1.5">
                {filtered.length === 0 ? (
                  <CommandEmpty className="py-6 text-xs text-violet-500/70 dark:text-violet-400/70">
                    No project types found
                  </CommandEmpty>
                ) : (
                  <CommandGroup className="p-0">
                    {filtered.map((item) => {
                      const isSelected = value === item.id;
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.name}
                          onSelect={() => {
                            onChange(item.id);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                            "data-[selected=true]:bg-violet-50 data-[selected=true]:text-violet-950",
                            "dark:data-[selected=true]:bg-violet-500/15 dark:data-[selected=true]:text-violet-50",
                            isSelected &&
                              "bg-violet-100/80 text-violet-950 ring-1 ring-violet-300/60 data-[selected=true]:bg-violet-100/80 data-[selected=true]:text-violet-950 dark:bg-violet-500/20 dark:text-violet-50 dark:ring-violet-500/40 dark:data-[selected=true]:bg-violet-500/20 dark:data-[selected=true]:text-violet-50",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2.5 w-2.5 shrink-0 rounded-full",
                              projectTypeDotClass(item.id, colorIndexById.get(item.id)),
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                            {item.name}
                          </span>
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
