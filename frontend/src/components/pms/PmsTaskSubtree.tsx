import type { ReactNode } from "react";
import { CornerDownRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { pmsTreeLevelStyle } from "@/components/pms/pmsTaskListStyles";

/** Vertical branch line connecting a parent task to its subtasks (ClickUp-style tree). */
export function PmsTaskSubtree({
  level,
  active,
  children,
  className,
}: {
  /** Nesting tier: 1 = first subtask level, 2 = nested subtask, etc. */
  level: number;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tier = pmsTreeLevelStyle(level);

  return (
    <div
      className={cn(
        "relative min-w-0 border-l pl-4 ml-9",
        tier.border,
        active && tier.bg,
        className,
      )}
    >
      <span
        className={cn(
          "absolute -left-[3px] top-3.5 z-[1] h-1.5 w-1.5 rounded-full ring-1 ring-white",
          tier.dot,
        )}
        aria-hidden
        title={`Subtask level ${level}`}
      />
      {children}
    </div>
  );
}

export function PmsAddSubtaskRow({
  level,
  parentTitle,
  onClick,
  active,
}: {
  level?: number;
  parentTitle: string;
  onClick: () => void;
  active?: boolean;
}) {
  const tier = pmsTreeLevelStyle(level);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/add flex w-full items-center gap-2 border-b border-slate-100 py-2.5 text-left transition-colors",
        active ? tier.bg : "hover:bg-slate-50/80",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed",
          active
            ? cn(tier.addBorder, tier.addBg, tier.addText)
            : cn(tier.addBorder, "text-slate-400", tier.addHover),
        )}
      >
        <Plus className="h-3 w-3" />
      </span>
      <CornerDownRight className={cn("h-3.5 w-3.5 shrink-0", tier.connector)} aria-hidden />
      <span className="text-[13px] text-slate-500 group-hover/add:text-slate-700">Add subtask</span>
      <span className="min-w-0 truncate text-[11px] text-slate-400">
        under{" "}
        <span className={cn("font-medium", active ? tier.addText : "text-slate-600")}>
          {parentTitle}
        </span>
      </span>
    </button>
  );
}
