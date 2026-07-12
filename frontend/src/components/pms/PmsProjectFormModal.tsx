import { useState } from "react";
import { format } from "date-fns";
import {
  Building2,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  Flag,
  FolderKanban,
  Layers3,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  formatPmsDateForApi,
  parsePmsDate,
  PmsTaskDatePicker,
} from "@/components/pms/PmsTaskDatePicker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PMS_PRIORITIES, PMS_PROJECT_STATUSES } from "@/lib/pmsApi";
import { cn, formatStatusLabel } from "@/lib/utils";
import { ProjectTypeDropdown } from "@/components/pms/ProjectTypeDropdown";

export type ProjectFormState = {
  title: string;
  description: string;
  companyId: string;
  projectTypeId: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  form: ProjectFormState;
  onChange: (next: ProjectFormState) => void;
  companies: { id: string; name: string }[];
  projectCode?: string;
  saving?: boolean;
  onSubmit: () => void;
  /** Field-level validation messages (create and edit modes). */
  fieldErrors?: Partial<Record<keyof ProjectFormState, string>>;
};

const CHIP_INACTIVE =
  "border-slate-200 bg-slate-100/70 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300";

const STATUS_CHIP_ACTIVE: Record<string, string> = {
  not_started:
    "border-slate-400 bg-slate-100 text-slate-800 ring-2 ring-slate-400/25 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-500/30",
  in_progress:
    "border-blue-400 bg-blue-100 text-blue-800 ring-2 ring-blue-400/30 dark:border-blue-500 dark:bg-blue-900/60 dark:text-blue-100 dark:ring-blue-500/30",
  on_hold:
    "border-amber-400 bg-amber-100 text-amber-900 ring-2 ring-amber-400/30 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-500/30",
  completed:
    "border-emerald-400 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400/30 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-500/30",
  cancelled:
    "border-rose-400 bg-rose-100 text-rose-800 ring-2 ring-rose-400/30 dark:border-rose-500 dark:bg-rose-900/50 dark:text-rose-100 dark:ring-rose-500/30",
};

const PRIORITY_CHIP_ACTIVE: Record<string, string> = {
  low: "border-slate-400 bg-slate-100 text-slate-700 ring-2 ring-slate-400/25 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100",
  medium:
    "border-violet-400 bg-violet-100 text-violet-800 ring-2 ring-violet-400/30 dark:border-violet-500 dark:bg-violet-900/50 dark:text-violet-100",
  high: "border-orange-400 bg-orange-100 text-orange-800 ring-2 ring-orange-400/30 dark:border-orange-500 dark:bg-orange-900/50 dark:text-orange-100",
  urgent:
    "border-rose-400 bg-rose-100 text-rose-800 ring-2 ring-rose-400/30 dark:border-rose-500 dark:bg-rose-900/50 dark:text-rose-100",
};

function ProjectDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = parsePmsDate(value);
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <PmsTaskDatePicker
        value={{ startDate: null, endDate: parsed }}
        onChange={(next) => onChange(formatPmsDateForApi(next.endDate) ?? "")}
        endOnly
        allowClear
        clearLabel="Clear date"
        modal={false}
        sidebarMode="years"
        yearRange={{ from: currentYear - 10, to: currentYear + 20 }}
      >
        <button
          type="button"
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-left text-sm transition-all",
            "border-slate-200/80 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
            parsed ? "text-slate-900 dark:text-slate-100" : "text-slate-400",
          )}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate">
            {parsed ? format(parsed, "MMM d, yyyy") : `Pick ${label.toLowerCase()} date`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </PmsTaskDatePicker>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  accent,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200/70 bg-card/90 p-3.5 shadow-sm dark:border-slate-800/80",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function PmsProjectFormModal({
  open,
  onOpenChange,
  mode,
  form,
  onChange,
  companies,
  projectCode,
  saving = false,
  onSubmit,
  fieldErrors = {},
}: Props) {
  const isEdit = mode === "edit";
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  const selectedCompany = companies.find((c) => c.id === form.companyId);
  const filteredCompanies = companies.filter(
    (c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()),
  );

  const canSubmitCreate =
    !isEdit &&
    form.title.trim() &&
    form.companyId &&
    form.projectTypeId &&
    form.status;

  const canSubmitEdit =
    isEdit &&
    form.title.trim() &&
    form.companyId &&
    form.projectTypeId &&
    form.status;

  const createSubmitDisabled = saving || !canSubmitCreate;
  const editSubmitDisabled = saving || !canSubmitEdit;

  const companyInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

  const companyAvatarColor = (name: string) => {
    const palette = [
      "bg-violet-100 text-violet-700 ring-violet-200/80 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-violet-500/40",
      "bg-indigo-100 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-indigo-500/40",
      "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200/80 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:ring-fuchsia-500/40",
      "bg-sky-100 text-sky-700 ring-sky-200/80 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-500/40",
      "bg-amber-100 text-amber-700 ring-amber-200/80 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/40",
      "bg-emerald-100 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/40",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="w-[min(94vw,980px)] max-w-[980px] gap-0 overflow-hidden border-border/80 bg-background p-0 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-violet-200/40 bg-gradient-to-br from-white via-violet-50/50 to-purple-50/30 px-6 py-4 dark:border-violet-900/40 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-200/60 bg-violet-500/10 text-violet-700 dark:border-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
              {isEdit ? <Sparkles className="h-4 w-4" /> : <FolderKanban className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-400/90">
                {isEdit ? "Update workspace" : "New workspace"}
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                {isEdit ? "Edit project" : "Create project"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {isEdit
                  ? "Update project details, timeline, and status."
                  : "Set up your project hub for tasks, sprints, and team work."}
              </p>
              {projectCode ? (
                <span className="mt-2 inline-flex rounded-md border border-violet-200/60 bg-violet-500/5 px-2 py-0.5 font-mono text-[11px] text-violet-800 dark:border-violet-800 dark:bg-violet-500/10 dark:text-violet-300">
                  {projectCode}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-violet-500/10 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-violet-500/15 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — two equal-height columns on laptop+ */}
        <div className="bg-neutral-50/60 px-6 py-4 dark:bg-slate-950/30">
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <SectionCard
              icon={Layers3}
              title="Basics"
              accent="bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              className="flex h-full flex-col"
            >
              <div className="flex flex-1 flex-col gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="project-title" className="text-xs font-medium text-muted-foreground">
                    Project title <span className="text-violet-600 dark:text-violet-400">*</span>
                  </Label>
                  <Input
                    id="project-title"
                    value={form.title}
                    onChange={(e) => onChange({ ...form, title: e.target.value })}
                    placeholder="e.g. Website redesign Q3"
                    className="h-10 border-border/80 bg-background text-base font-medium"
                  />
                </div>
                <div className="flex flex-1 flex-col space-y-1.5">
                  <Label htmlFor="project-description" className="text-xs font-medium text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    id="project-description"
                    value={form.description}
                    onChange={(e) => onChange({ ...form, description: e.target.value })}
                    placeholder="What is this project about?"
                    rows={3}
                    className="min-h-[7.5rem] flex-1 resize-none border-border/80 bg-background"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={Building2}
              title="Organization & timeline"
              accent="bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300"
              className="flex h-full flex-col"
            >
              <div className="flex flex-1 flex-col gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Company <span className="text-violet-600 dark:text-violet-400">*</span>
                  </Label>
                  <Popover
                    open={companyOpen}
                    onOpenChange={(open) => {
                      setCompanyOpen(open);
                      if (!open) setCompanySearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={companyOpen}
                        className={cn(
                          "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-all",
                          "bg-slate-100/70 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25",
                          companyOpen &&
                            "bg-white ring-2 ring-violet-500/15 dark:bg-slate-900 dark:ring-violet-500/20",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                            selectedCompany
                              ? "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                              : "bg-white text-slate-400 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700",
                          )}
                        >
                          {selectedCompany ? (
                            companyInitial(selectedCompany.name)
                          ) : (
                            <Building2 className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {selectedCompany ? (
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {selectedCompany.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Choose company</span>
                          )}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
                            companyOpen && "rotate-180",
                          )}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-violet-200/70 bg-white p-0 shadow-xl shadow-violet-500/10 dark:border-violet-800/50 dark:bg-slate-950 dark:shadow-violet-950/30"
                    >
                      <Command
                        shouldFilter={false}
                        className="bg-white dark:bg-slate-950 [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:px-0 [&_[cmdk-input-wrapper]_svg]:hidden [&_[cmdk-item][data-selected=true]]:bg-violet-50 [&_[cmdk-item][data-selected=true]]:text-violet-950 dark:[&_[cmdk-item][data-selected=true]]:bg-violet-500/15 dark:[&_[cmdk-item][data-selected=true]]:text-violet-50"
                      >
                        <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-indigo-50/80 to-fuchsia-50/60 px-3 py-2.5 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-indigo-950/30 dark:to-fuchsia-950/20">
                          <Search className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
                          <CommandInput
                            placeholder="Search companies"
                            value={companySearch}
                            onValueChange={setCompanySearch}
                            className="h-8 border-0 bg-transparent p-0 text-sm text-violet-950 shadow-none placeholder:text-violet-400/70 focus-visible:ring-0 dark:text-violet-50 dark:placeholder:text-violet-400/50"
                          />
                        </div>
                        <CommandList className="max-h-[min(240px,40vh)] p-1.5">
                          {filteredCompanies.length === 0 ? (
                            <CommandEmpty className="py-6 text-xs text-violet-500/70 dark:text-violet-400/70">
                              No companies found
                            </CommandEmpty>
                          ) : (
                            <CommandGroup className="p-0">
                              {filteredCompanies.map((c) => {
                                const isSelected = form.companyId === c.id;
                                const avatarColor = companyAvatarColor(c.name);
                                return (
                                  <CommandItem
                                    key={c.id}
                                    value={c.name}
                                    onSelect={() => {
                                      onChange({ ...form, companyId: c.id });
                                      setCompanyOpen(false);
                                      setCompanySearch("");
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
                                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase ring-1",
                                        isSelected
                                          ? "bg-white text-violet-700 ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-600"
                                          : avatarColor,
                                      )}
                                    >
                                      {companyInitial(c.name)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                                      {c.name}
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
                    </PopoverContent>
                  </Popover>
                </div>
                <ProjectTypeDropdown
                  value={form.projectTypeId}
                  onChange={(projectTypeId) => onChange({ ...form, projectTypeId })}
                  disabled={saving}
                  required
                  error={fieldErrors.projectTypeId}
                />

                <div className="mt-auto space-y-3 border-t border-slate-200/70 pt-4 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-fuchsia-500/10 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
                      <CalendarRange className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">Timeline (Expected)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ProjectDateField
                      label="Start"
                      value={form.startDate}
                      onChange={(startDate) => onChange({ ...form, startDate })}
                    />
                    <ProjectDateField
                      label="End"
                      value={form.endDate}
                      onChange={(endDate) => onChange({ ...form, endDate })}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            icon={Flag}
            title="Status & priority"
            accent="bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
            className="mt-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Status <span className="text-violet-600 dark:text-violet-400">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PMS_PROJECT_STATUSES.map((s) => {
                    const selected = form.status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => onChange({ ...form, status: s.value })}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                          selected ? (STATUS_CHIP_ACTIVE[s.value] ?? STATUS_CHIP_ACTIVE.not_started) : CHIP_INACTIVE,
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
                <div className="flex flex-wrap gap-2">
                  {PMS_PRIORITIES.map((p) => {
                    const selected = form.priority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => onChange({ ...form, priority: p.value })}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                          selected ? (PRIORITY_CHIP_ACTIVE[p.value] ?? PRIORITY_CHIP_ACTIVE.medium) : CHIP_INACTIVE,
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {form.status && (
              <p className="mt-3 text-xs text-muted-foreground">
                {formatStatusLabel(form.status)}
                {form.priority ? ` · ${form.priority} priority` : ""}
              </p>
            )}
          </SectionCard>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-violet-200/30 bg-neutral-50/80 px-6 py-3 dark:border-violet-900/30 dark:bg-slate-900/50 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-slate-200 bg-background text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-violet-600 text-white shadow-sm hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
            onClick={onSubmit}
            disabled={isEdit ? editSubmitDisabled : createSubmitDisabled}
          >
            {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
