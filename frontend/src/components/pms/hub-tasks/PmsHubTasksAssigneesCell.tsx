import type { ReactNode } from "react";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import {
  PmsMemberListTooltipContent,
  type PmsMemberListPerson,
} from "@/components/pms/PmsMemberListTooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PmsHubTaskAssignee } from "@/components/pms/hub-tasks/pmsHubTasksListUtils";
import { cn } from "@/lib/utils";

type Props = {
  assignees: PmsHubTaskAssignee[];
  getUserEmail?: (userId: string) => string | undefined;
};

function toTooltipMembers(
  assignees: PmsHubTaskAssignee[],
  getUserEmail?: (userId: string) => string | undefined,
): PmsMemberListPerson[] {
  return assignees.map((assignee) => ({
    userId: assignee.userId,
    name: assignee.name,
    email: getUserEmail?.(assignee.userId),
  }));
}

function AssigneesTooltip({
  assignees,
  getUserEmail,
  children,
  ariaLabel,
}: {
  assignees: PmsHubTaskAssignee[];
  getUserEmail?: (userId: string) => string | undefined;
  children: ReactNode;
  ariaLabel: string;
}) {
  const members = toTooltipMembers(assignees, getUserEmail);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-w-0 max-w-full items-center rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-indigo-200",
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={ariaLabel}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <PmsMemberListTooltipContent
          title="Assignees"
          countLabel={`${assignees.length} assignee${assignees.length === 1 ? "" : "s"}`}
          members={members}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export function PmsHubTasksAssigneesCell({ assignees, getUserEmail }: Props) {
  if (assignees.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  if (assignees.length === 1) {
    const [assignee] = assignees;
    return (
      <AssigneesTooltip
        assignees={assignees}
        getUserEmail={getUserEmail}
        ariaLabel={`Assignee: ${assignee.name}`}
      >
        <PmsMemberAvatar name={assignee.name} userId={assignee.userId} size="xs" hideTitle />
      </AssigneesTooltip>
    );
  }

  return (
    <AssigneesTooltip
      assignees={assignees}
      getUserEmail={getUserEmail}
      ariaLabel={`${assignees.length} assignees`}
    >
      <span className="flex -space-x-1.5 overflow-hidden">
        {assignees.map((assignee) => (
          <PmsMemberAvatar
            key={assignee.userId}
            name={assignee.name}
            userId={assignee.userId}
            size="xs"
            className="ring-2 ring-white"
            hideTitle
          />
        ))}
      </span>
    </AssigneesTooltip>
  );
}
