import { cn } from "@/lib/utils";

type Props = {
  completed: boolean;
  compact?: boolean;
  className?: string;
};

export function TaskStatusIndicator({ completed, compact, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded font-bold uppercase tracking-wide",
        compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
        completed ? "bg-slate-500 text-white" : "bg-white/95 text-emerald-800",
        className,
      )}
    >
      {completed ? "Done" : "Pending"}
    </span>
  );
}
