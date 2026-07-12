import { Clock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  crmTaskRemainingPrefix,
  crmTaskRemainingTextClass,
  type CrmTaskRemainingTone,
} from "@/components/tasks/crmTasksListStyles";

export function PmsHubTasksRemainingCell({ tone, label }: { tone: CrmTaskRemainingTone; label: string }) {
  if (tone === "done") {
    return <span className="text-slate-400">—</span>;
  }

  const prefix = crmTaskRemainingPrefix(tone);
  const textClass = crmTaskRemainingTextClass(tone);

  if (tone === "overdue") {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", textClass)}>
        <Clock className="h-3.5 w-3.5 shrink-0 text-rose-400/90" aria-hidden />
        <span className="truncate">
          <span className="text-rose-600/80">{prefix}</span>
          <span className="mx-1 text-rose-300">·</span>
          <span>{label}</span>
        </span>
      </span>
    );
  }

  if (tone === "today") {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", textClass)}>
        <Hourglass className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 tabular-nums", textClass)}>
      <span className="truncate">{label}</span>
      {tone === "normal" ? <span className="shrink-0 text-slate-400">left</span> : null}
    </span>
  );
}
