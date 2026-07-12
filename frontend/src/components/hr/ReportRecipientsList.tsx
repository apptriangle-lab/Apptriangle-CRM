import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import type { ReportRecipientDto } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;

type Props = {
  recipients: ReportRecipientDto[];
  compact?: boolean;
};

export function ReportRecipientsList({ recipients, compact = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = useMemo(() => recipients.slice(0, visibleCount), [recipients, visibleCount]);
  const remaining = recipients.length - visible.length;

  if (!recipients.length) {
    return <span className="text-sm text-[#64748B]">—</span>;
  }

  return (
    <div className="space-y-2">
      <ul className={compact ? "space-y-1" : "space-y-1.5"}>
        {visible.map((recipient) => (
          <li key={recipient.id} className="flex min-w-0 items-center gap-2">
            <RfqUserAvatar
              name={recipient.name}
              email={recipient.email}
              profilePicture={recipient.profilePicture}
              size="sm"
              className="h-8 w-8"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-[#0F172A]">
                {recipient.name || recipient.email}
              </p>
              {!compact ? (
                <p className="truncate text-xs text-[#64748B]">{recipient.email}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-[#E2E8F0] text-xs text-[#2563EB] hover:bg-[#EFF6FF]"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Load more ({remaining} remaining)
        </Button>
      ) : null}
    </div>
  );
}

type AvatarStackProps = {
  recipients: ReportRecipientDto[];
  maxVisible?: number;
};

export function ReportRecipientsAvatarStack({ recipients, maxVisible = 3 }: AvatarStackProps) {
  if (!recipients.length) {
    return <span className="text-sm text-[#64748B]">—</span>;
  }

  const shown = recipients.slice(0, maxVisible);
  const extra = recipients.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((recipient) => (
          <RfqUserAvatar
            key={recipient.id}
            name={recipient.name}
            email={recipient.email}
            profilePicture={recipient.profilePicture}
            size="sm"
            className="h-8 w-8 ring-2 ring-white"
          />
        ))}
      </div>
      {extra > 0 ? (
        <span className="ml-2 text-xs font-semibold text-[#64748B]">+{extra}</span>
      ) : null}
    </div>
  );
}

export function formatRecipientsSummary(recipients: ReportRecipientDto[], maxNames = 2): string {
  if (!recipients.length) return "—";
  const names = recipients.map((r) => r.name || r.email).filter(Boolean);
  if (names.length <= maxNames) return names.join(", ");
  return `${names.slice(0, maxNames).join(", ")}, +${names.length - maxNames}`;
}

export function usersToRecipients(
  userIds: string[] | undefined,
  users: Array<{ id: string; name: string; email: string; profilePicture?: string | null }>,
): ReportRecipientDto[] {
  if (!userIds?.length) return [];
  const byId = new Map(users.map((user) => [user.id, user]));
  return userIds
    .map((id) => byId.get(id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture ?? null,
    }));
}

export function RecipientNamesCell({
  recipients,
  className,
}: {
  recipients: ReportRecipientDto[];
  className?: string;
}) {
  return (
    <span className={cn("text-sm text-[#64748B]", className)} title={recipients.map((r) => r.name).join(", ")}>
      {formatRecipientsSummary(recipients)}
    </span>
  );
}
