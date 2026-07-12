import { useState } from "react";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PMS_ASSIGNEE_MENU_OVERRIDES, PMS_ASSIGNEE_OPTION_ITEM_CLASS } from "@/components/pms/PmsTaskAssigneesPicker";
import { cn } from "@/lib/utils";

export type PmsHubProjectFilterOption = {
  id: string;
  title: string;
  projectCode?: string;
};

function ProjectFilterMenuItem({
  name,
  subtitle,
  selected,
  onSelect,
}: {
  name: string;
  subtitle?: string;
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
      onClick={onSelect}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <FolderKanban className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {selected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  projects: PmsHubProjectFilterOption[];
  allProjectsSubtitle?: string;
  /** When false, hides the cross-project "All projects" option. */
  showAllOption?: boolean;
  align?: "start" | "end";
};

export function PmsHubTasksProjectFilterDropdown({
  value,
  onChange,
  projects,
  allProjectsSubtitle = "Tasks across every project",
  showAllOption = true,
  align = "end",
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedProject = projects.find((project) => project.id === value);
  const triggerLabel = value === "all" ? "Project" : (selectedProject?.title ?? "Project");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!projects.length}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            value !== "all" && "border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-50",
          )}
        >
          <FolderKanban className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
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
        {showAllOption ? (
          <ProjectFilterMenuItem
            name="All projects"
            subtitle={allProjectsSubtitle}
            selected={value === "all"}
            onSelect={() => {
              onChange("all");
              setOpen(false);
            }}
          />
        ) : null}
        {projects.map((project) => (
          <ProjectFilterMenuItem
            key={project.id}
            name={project.title}
            subtitle={project.projectCode}
            selected={value === project.id}
            onSelect={() => {
              onChange(project.id);
              setOpen(false);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
