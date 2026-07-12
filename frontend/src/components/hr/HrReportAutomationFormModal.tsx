import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { format, isValid } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Globe,
  Info,
  Plus,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import type { ReportAutomationDto, ReportAutomationPayload, ShiftDto, UserDto } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ReportAutomationFormState = ReportAutomationPayload;

const TIMEZONES = [
  "UTC",
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
];

const THEME_SELECT_CONTENT_CLASS = "rounded-xl border-[#E2E8F0]";
const THEME_SELECT_ITEM_CLASS =
  "cursor-pointer rounded-lg focus:bg-[#EFF6FF] focus:text-[#0F172A] data-[highlighted]:bg-[#EFF6FF] data-[highlighted]:text-[#0F172A] data-[state=checked]:bg-[#EFF6FF] data-[state=checked]:text-[#0F172A] [&_svg]:text-[#2563EB]";
const THEME_PICKER_TRIGGER_CLASS =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 text-left text-sm font-normal text-[#0F172A] shadow-none transition-colors hover:border-[#CBD5E1] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/20";

type TimeDraft = {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
};

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const hour = index + 1;
  return { value: String(hour), label: String(hour).padStart(2, "0") };
});

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => ({
  value: String(minute),
  label: String(minute).padStart(2, "0"),
}));

const PERIOD_OPTIONS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
] as const;

function parseExecutionTime(value: string): TimeDraft {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return { hour12: 9, minute: 0, period: "AM" };
  }
  return {
    hour12: h % 12 || 12,
    minute: Math.min(59, Math.max(0, m)),
    period: h >= 12 ? "PM" : "AM",
  };
}

function draftToExecutionTime(draft: TimeDraft): string {
  let hour24 = draft.hour12 % 12;
  if (draft.period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`;
}

function formatExecutionTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** Parse/store calendar dates without UTC timezone shifts. */
function parseDateOnly(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return isValid(parsed) ? parsed : undefined;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyForm = (): ReportAutomationFormState => ({
  reportName: "",
  reportType: "attendance",
  description: "",
  scheduleType: "weekly",
  startDate: format(new Date(), "yyyy-MM-dd"),
  executionTime: "09:00",
  timezone: "Asia/Dhaka",
  isActive: true,
  shiftIds: [],
  recipientUserIds: [],
});

export function automationToForm(a: ReportAutomationDto): ReportAutomationFormState {
  return {
    reportName: a.reportName,
    reportType: a.reportType,
    description: a.description ?? "",
    scheduleType: a.scheduleType,
    startDate: a.startDate?.slice(0, 10) ?? format(new Date(), "yyyy-MM-dd"),
    executionTime: a.executionTime ?? "09:00",
    timezone: a.timezone ?? "UTC",
    isActive: a.isActive,
    shiftIds: a.shiftIds ?? [],
    recipientUserIds: a.recipientUserIds ?? [],
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ReportAutomationDto | null;
  form: ReportAutomationFormState;
  onChange: (next: ReportAutomationFormState) => void;
  shifts: ShiftDto[];
  users: UserDto[];
  saving?: boolean;
  onSubmit: () => void;
};

function SectionHeader({ icon: Icon, title }: { icon: typeof Info; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-white">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-xs font-bold tracking-[0.12em] text-[#2563EB]">{title}</h3>
    </div>
  );
}

function FormSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("space-y-4", className)}>{children}</section>;
}

function ThemeDatePicker({
  value,
  onChange,
  placeholder = "Pick a start date",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDateOnly(value), [value]);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (open) {
      setMonth(selected ?? new Date());
    }
  }, [open, selected]);

  return (
    <Popover open={open} modal={false} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={THEME_PICKER_TRIGGER_CLASS}>
          <span className="flex min-w-0 items-center gap-2.5">
            <CalendarIcon className="h-4 w-4 shrink-0 text-[#2563EB]" />
            <span className={cn("truncate", !selected && "text-[#94A3B8]")}>
              {selected ? format(selected, "PPP") : placeholder}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-auto overflow-hidden rounded-xl border-[#E2E8F0] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            if (date) {
              onChange(formatDateOnly(date));
              setOpen(false);
            }
          }}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={2035}
          initialFocus
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

function TimeScrollColumn({
  label,
  value,
  options,
  onChange,
  scrollIntoViewKey,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  scrollIntoViewKey?: string;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scrollIntoViewKey) return;
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, [scrollIntoViewKey]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </p>
      <div
        className="max-h-[200px] overflow-y-auto overscroll-contain rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1"
        onWheel={(e) => e.stopPropagation()}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              ref={selected ? selectedRef : undefined}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                selected ? "bg-[#2563EB] text-white" : "text-[#0F172A] hover:bg-[#EFF6FF]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeTimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeDraft>(() => parseExecutionTime(value || "09:00"));

  useEffect(() => {
    if (open) setDraft(parseExecutionTime(value || "09:00"));
  }, [open, value]);

  const scrollKey = open ? `${draft.hour12}-${draft.minute}-${draft.period}` : undefined;
  const previewTime = draftToExecutionTime(draft);
  const selectedLabel = value ? formatExecutionTimeLabel(value) : "";

  const updateDraft = (next: TimeDraft) => {
    setDraft(next);
    onChange(draftToExecutionTime(next));
  };

  return (
    <Popover open={open} modal={false} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={THEME_PICKER_TRIGGER_CLASS}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-[#2563EB]" />
            <span className={cn("truncate", !value && "text-[#94A3B8]")}>
              {value ? selectedLabel : placeholder}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[min(calc(100vw-2rem),320px)] rounded-xl border-[#E2E8F0] p-4"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm font-semibold text-[#0F172A]">
          {formatExecutionTimeLabel(previewTime)}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <TimeScrollColumn
            label="Hour"
            value={String(draft.hour12)}
            options={HOUR_OPTIONS}
            scrollIntoViewKey={scrollKey}
            onChange={(hour) => updateDraft({ ...draft, hour12: Number(hour) })}
          />
          <TimeScrollColumn
            label="Minute"
            value={String(draft.minute)}
            options={MINUTE_OPTIONS}
            scrollIntoViewKey={scrollKey}
            onChange={(minute) => updateDraft({ ...draft, minute: Number(minute) })}
          />
          <TimeScrollColumn
            label="Period"
            value={draft.period}
            options={PERIOD_OPTIONS}
            scrollIntoViewKey={scrollKey}
            onChange={(period) => updateDraft({ ...draft, period: period as "AM" | "PM" })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagMultiSelectField({
  label,
  placeholder,
  selectedIds,
  options,
  onChange,
  searchPlaceholder,
}: {
  label: string;
  placeholder: string;
  selectedIds: string[];
  options: { id: string; label: string; sub?: string }[];
  onChange: (ids: string[]) => void;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
    );
  }, [options, search]);

  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));

  const toggle = (id: string) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  };

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-[#0F172A]">{label}</Label>
      <Popover open={open} modal={false} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-left transition-colors hover:border-[#CBD5E1]"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {selectedOptions.length === 0 ? (
                <span className="text-sm text-[#94A3B8]">{placeholder}</span>
              ) : (
                selectedOptions.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#1D4ED8]"
                  >
                    {o.label}
                    <button
                      type="button"
                      className="rounded hover:bg-[#DBEAFE]"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(o.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <Plus className="h-4 w-4 shrink-0 text-[#2563EB]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[100] flex max-h-[min(320px,70vh)] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-xl border-[#E2E8F0] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onWheel={(e) => e.stopPropagation()}
        >
          <Command shouldFilter={false} className="flex max-h-full min-h-0 flex-col">
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              className="h-10 shrink-0 border-[#E2E8F0]"
            />
            <CommandList className="min-h-0 max-h-[min(240px,40vh)] flex-1">
              <CommandEmpty className="py-6 text-sm text-[#64748B]">No matches</CommandEmpty>
              <CommandGroup>
                {filtered.map((o) => {
                  const on = selectedIds.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.id}
                      onSelect={() => toggle(o.id)}
                      className={cn(
                        "cursor-pointer rounded-lg px-2 py-2",
                        "data-[selected=true]:bg-[#EFF6FF] data-[selected=true]:text-[#0F172A]",
                        "data-[selected='true']:bg-[#EFF6FF] data-[selected='true']:text-[#0F172A]",
                        "aria-selected:bg-[#EFF6FF] aria-selected:text-[#0F172A]",
                        on && "bg-[#EFF6FF] ring-1 ring-[#DBEAFE]",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        className="mr-2"
                        onCheckedChange={() => toggle(o.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#0F172A]">{o.label}</span>
                        {o.sub ? (
                          <span className="block truncate text-xs text-[#64748B]">{o.sub}</span>
                        ) : null}
                      </span>
                      {on ? <Check className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function HrReportAutomationFormModal({
  open,
  onOpenChange,
  editing,
  form,
  onChange,
  shifts,
  users,
  saving = false,
  onSubmit,
}: Props) {
  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    label: s.name,
    sub: `${s.startTime} – ${s.endTime}`,
  }));

  const userOptions = users
    .filter((u) => u.isActive !== false)
    .map((u) => ({ id: u.id, label: u.name, sub: u.email }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-[#E2E8F0] p-0 font-['Hanken_Grotesk',sans-serif]">
        <div className="shrink-0 border-b border-[#E2E8F0] px-8 py-5">
          <h2 className="text-xl font-bold text-[#0F172A]">
            {editing ? "Edit Automation" : "Create Automation"}
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Set up a new recurring attendance report sequence.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-0">
            {/* Left — Basic details */}
            <FormSection className="lg:pr-8">
              <SectionHeader icon={Info} title="BASIC DETAILS" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#0F172A]">Report name *</Label>
                  <Input
                    value={form.reportName}
                    onChange={(e) => onChange({ ...form, reportName: e.target.value })}
                    placeholder="e.g. Weekly Overtime Analysis"
                    className="h-11 rounded-xl border-[#E2E8F0]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#0F172A]">Report type</Label>
                  <Select value={form.reportType} disabled>
                    <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attendance">Attendance Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#0F172A]">Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => onChange({ ...form, description: e.target.value })}
                    placeholder="Explain the purpose of this automation..."
                    rows={3}
                    className="resize-none rounded-xl border-[#E2E8F0]"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#EFF6FF] px-4 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Enable Automation</p>
                    <p className="text-xs text-[#64748B]">
                      Automation will begin executing based on the schedule immediately.
                    </p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => onChange({ ...form, isActive: v })}
                    className="data-[state=checked]:bg-[#2563EB]"
                  />
                </div>
              </div>
            </FormSection>

            {/* Right — Targeting + Scheduling */}
            <div className="space-y-6 lg:border-l lg:border-[#E2E8F0] lg:pl-8">
              <FormSection>
                <SectionHeader icon={Users} title="TARGETING & DISTRIBUTION" />
                <div className="space-y-4">
                  <TagMultiSelectField
                    label="Shifts"
                    placeholder="Select shifts"
                    selectedIds={form.shiftIds}
                    options={shiftOptions}
                    onChange={(shiftIds) => onChange({ ...form, shiftIds })}
                    searchPlaceholder="Search shifts..."
                  />
                  <TagMultiSelectField
                    label="Recipients"
                    placeholder="Select recipients"
                    selectedIds={form.recipientUserIds}
                    options={userOptions}
                    onChange={(recipientUserIds) => onChange({ ...form, recipientUserIds })}
                    searchPlaceholder="Search by name or email..."
                  />
                </div>
              </FormSection>

              <div className="border-t border-[#E2E8F0] pt-6">
                <FormSection>
                  <SectionHeader icon={CalendarIcon} title="SCHEDULING" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#0F172A]">Schedule type</Label>
                      <Select
                        value={form.scheduleType}
                        onValueChange={(v) =>
                          onChange({ ...form, scheduleType: v as ReportAutomationFormState["scheduleType"] })
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={THEME_SELECT_CONTENT_CLASS}>
                          <SelectItem value="one_time" className={THEME_SELECT_ITEM_CLASS}>One time</SelectItem>
                          <SelectItem value="daily" className={THEME_SELECT_ITEM_CLASS}>Daily</SelectItem>
                          <SelectItem value="weekly" className={THEME_SELECT_ITEM_CLASS}>Weekly</SelectItem>
                          <SelectItem value="monthly" className={THEME_SELECT_ITEM_CLASS}>Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#0F172A]">Timezone</Label>
                      <div className="relative">
                        <Select value={form.timezone} onValueChange={(v) => onChange({ ...form, timezone: v })}>
                          <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0] pr-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={THEME_SELECT_CONTENT_CLASS}>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz} className={THEME_SELECT_ITEM_CLASS}>
                                {tz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Globe className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#0F172A]">Start date</Label>
                      <ThemeDatePicker
                        value={form.startDate}
                        onChange={(startDate) => onChange({ ...form, startDate })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#0F172A]">Execution time</Label>
                      <ThemeTimePicker
                        value={form.executionTime}
                        onChange={(executionTime) => onChange({ ...form, executionTime })}
                      />
                      {form.executionTime ? (
                        <p className="text-xs text-[#64748B]">
                          Runs at {formatExecutionTimeLabel(form.executionTime)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </FormSection>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] px-8 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-[#64748B] hover:text-[#0F172A]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-[#2563EB] px-6 hover:bg-[#1D4ED8]"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create automation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { emptyForm as emptyReportAutomationForm };
