import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  className?: string;
  label?: string;
};

/** Pill-style clear control aligned with attendance hub filter buttons. */
export function AttendanceClearFiltersButton({
  onClick,
  className,
  label = "Clear filters",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-600 shadow-sm transition-colors",
        "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        className,
      )}
    >
      <X className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      {label}
    </button>
  );
}
