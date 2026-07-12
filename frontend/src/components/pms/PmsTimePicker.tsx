import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

export function parseTime24(value: string): TimeDraft {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return { hour12: 12, minute: 0, period: "PM" };
  }
  return {
    hour12: h % 12 || 12,
    minute: Math.min(59, Math.max(0, m)),
    period: h >= 12 ? "PM" : "AM",
  };
}

export function draftToTime24(draft: TimeDraft): string {
  let hour24 = draft.hour12 % 12;
  if (draft.period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`;
}

export function formatTime12Label(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
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
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className="max-h-[200px] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50 p-1 scrollbar-thinner"
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
                selected ? "bg-[#2563EB] text-white" : "text-slate-900 hover:bg-blue-50",
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

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** h-9 compact trigger for dense forms */
  compact?: boolean;
  className?: string;
  modal?: boolean;
  id?: string;
};

export function PmsTimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  compact = false,
  className,
  modal = false,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeDraft>(() => parseTime24(value || "12:00"));

  useEffect(() => {
    if (open) setDraft(parseTime24(value || "12:00"));
  }, [open, value]);

  const scrollKey = open ? `${draft.hour12}-${draft.minute}-${draft.period}` : undefined;
  const previewTime = draftToTime24(draft);

  const updateDraft = (next: TimeDraft) => {
    setDraft(next);
    onChange(draftToTime24(next));
  };

  return (
    <Popover open={open} modal={modal} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white text-left text-sm font-normal text-slate-900 shadow-none transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/20",
            compact ? "h-9 px-3" : "h-11 rounded-xl px-3",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Clock className={cn("shrink-0 text-[#2563EB]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <span className={cn("truncate", !value && "text-slate-400")}>
              {value ? formatTime12Label(value) : placeholder}
            </span>
          </span>
          <ChevronDown className={cn("shrink-0 text-slate-400", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[min(calc(100vw-2rem),320px)] rounded-xl border-slate-200 p-4"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm font-semibold text-slate-900">
          {formatTime12Label(previewTime)}
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
