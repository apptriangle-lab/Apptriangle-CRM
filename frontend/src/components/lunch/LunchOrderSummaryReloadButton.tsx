import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
};

export function LunchOrderSummaryReloadButton({
  onClick,
  loading = false,
  label = "Reload",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200/80 bg-white text-orange-600 shadow-sm transition-colors",
        "hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
    </button>
  );
}
