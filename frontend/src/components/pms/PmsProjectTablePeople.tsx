import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { PmsMemberListTooltipContent } from "@/components/pms/PmsMemberListTooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PmsMemberDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_MEMBERS = 5;

type MemberLike = Pick<PmsMemberDto, "userId" | "userName" | "userEmail" | "roleLabel">;

function displayName(member: MemberLike): string {
  return member.userName?.trim() || member.userEmail?.trim() || "?";
}

function memberRole(member: MemberLike, ownerId?: string | null): string | null {
  if (ownerId && member.userId === ownerId) return "Owner";
  const role = member.roleLabel?.trim();
  return role || null;
}

export function PmsProjectMembersAvatars({
  members,
  ownerId,
  className,
}: {
  members?: MemberLike[];
  ownerId?: string | null;
  className?: string;
}) {
  const allMembers = (members ?? []).filter((m) => m.userId);
  const team = allMembers.filter((m) => m.userId !== ownerId);

  if (!team.length) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const shown = team.slice(0, MAX_VISIBLE_MEMBERS);
  const extra = team.length - shown.length;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-indigo-200",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${allMembers.length} project members`}
        >
          <span className="flex -space-x-2">
            {shown.map((member) => (
              <PmsMemberAvatar
                key={member.userId}
                name={displayName(member)}
                userId={member.userId}
                size="sm"
                className="ring-2 ring-card"
                hideTitle
              />
            ))}
          </span>
          {extra > 0 ? (
            <span className="ml-1.5 text-xs font-semibold text-muted-foreground">+{extra}</span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <PmsMemberListTooltipContent
          title="Project members"
          countLabel={`${allMembers.length} member${allMembers.length === 1 ? "" : "s"}`}
          members={allMembers.map((member) => ({
            userId: member.userId,
            name: displayName(member),
            email: member.userEmail,
            badge: memberRole(member, ownerId),
          }))}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export function PmsProjectOwnerAvatar({
  ownerId,
  ownerName,
  ownerEmail,
}: {
  ownerId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
}) {
  const label = ownerName?.trim() || ownerEmail?.trim();
  if (!ownerId || !label) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <PmsMemberAvatar
      name={label}
      userId={ownerId}
      size="sm"
      className="ring-2 ring-card"
    />
  );
}
