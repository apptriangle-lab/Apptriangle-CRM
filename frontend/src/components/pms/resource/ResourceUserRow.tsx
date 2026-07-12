import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { PmsResourceUserDto } from "@/lib/pmsApi";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { ResourceUserCalendar } from "@/components/pms/resource/ResourceUserCalendar";
import { ResourceUserContributionStrip } from "@/components/pms/resource/ResourceUserContributionStrip";
import { ResourceUserProjectsBadge } from "@/components/pms/resource/ResourceUserProjectsBadge";

type Props = {
  user: PmsResourceUserDto;
  from: string;
  to: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onTaskClick?: (taskId: string) => void;
};

export function ResourceUserRow({ user, from, to, expanded, onExpandedChange, onTaskClick }: Props) {
  const displayName = user.userName ?? user.userEmail ?? "Member";

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onExpandedChange}
      className="col-span-full grid w-full border-b border-border/60 last:border-0 md:grid-cols-subgrid"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "col-span-full flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30",
            "md:grid md:grid-cols-subgrid md:items-center md:gap-x-3",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")}
            />
          </span>
          <PmsMemberAvatar name={displayName} userId={user.userId} size="sm" className="shrink-0 md:ml-2" />
          <div className="min-w-0 flex-1 md:flex-none">
            <p className="truncate font-semibold text-foreground">{displayName}</p>
            {user.userEmail ? (
              <p className="truncate text-xs text-muted-foreground">{user.userEmail}</p>
            ) : null}
          </div>
          <ResourceUserContributionStrip
            tasksByDate={user.tasksByDate}
            tasksByDateSummary={user.tasksByDateSummary}
          />
          <div className="flex shrink-0 items-center gap-2 md:justify-end">
            <ResourceUserProjectsBadge user={user} />
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#1a7f37]">
              {user.taskCount} task{user.taskCount === 1 ? "" : "s"}
            </span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="col-span-full grid transition-[grid-template-rows] duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="border-t border-border/40 bg-muted/10 px-4 py-4 sm:px-6">
            <ResourceUserCalendar
              from={from}
              to={to}
              tasks={user.tasks}
              tasksByDate={user.tasksByDate}
              tasksByDateSummary={user.tasksByDateSummary}
              onTaskClick={onTaskClick}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
