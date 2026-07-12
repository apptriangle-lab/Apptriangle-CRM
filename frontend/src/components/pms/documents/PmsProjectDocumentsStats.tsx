import { FileStack, FolderOpen, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  projectCount: number;
  taskCount: number;
  className?: string;
};

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof FileStack;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          accent,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function PmsProjectDocumentsStats({ total, projectCount, taskCount, className }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}>
      <StatCard
        label="Total files"
        value={total}
        icon={FileStack}
        accent="bg-slate-100 text-slate-600"
      />
      <StatCard
        label="Project files"
        value={projectCount}
        icon={FolderOpen}
        accent="bg-violet-50 text-violet-600"
      />
      <StatCard
        label="Task attachments"
        value={taskCount}
        icon={ListTodo}
        accent="bg-indigo-50 text-indigo-600"
      />
    </div>
  );
}
