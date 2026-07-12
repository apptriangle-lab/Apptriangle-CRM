import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  starred: boolean;
  onToggle: () => void;
  title: string;
};

export function PmsProjectStarButton({ starred, onToggle, title }: Props) {
  return (
    <button
      type="button"
      aria-label={starred ? `Unstar ${title}` : `Star ${title}`}
      title={starred ? "Remove from starred" : "Star project"}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        starred
          ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
          : "text-slate-300 hover:bg-slate-100 hover:text-amber-500",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Star className={cn("h-4 w-4", starred && "fill-current")} />
    </button>
  );
}
