import { FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function LunchOrderSummaryExportButton({ onClick, disabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Export order summary as PDF"
      aria-label="Export order summary as PDF"
      className={cn(
        "group inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-orange-200/90 bg-gradient-to-r from-orange-50 via-white to-white px-2.5 pl-2 text-[13px] font-semibold text-orange-950 shadow-sm transition-all",
        "hover:border-orange-300 hover:from-orange-100 hover:via-orange-50/40 hover:to-white hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-orange-200/70 bg-white text-orange-600 shadow-sm transition-colors group-hover:border-orange-300 group-hover:bg-orange-50/50">
        <FileDown className="h-3.5 w-3.5" />
      </span>
      <span className="pr-0.5">Export PDF</span>
    </button>
  );
}
