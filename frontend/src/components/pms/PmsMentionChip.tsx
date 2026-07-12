import { cn } from "@/lib/utils";
import {
  userMentionAvatarBg,
  userMentionChipStyle,
} from "@/components/pms/pmsCommentMentions";

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type Props = {
  name: string;
  userId: string;
  className?: string;
  size?: "sm" | "md";
};

export function PmsMentionChip({ name, userId, className, size = "sm" }: Props) {
  const chip = userMentionChipStyle(userId);
  const avatarBg = userMentionAvatarBg(userId);
  const compact = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 align-middle font-semibold ring-1 ring-inset",
        compact ? "mx-0.5 rounded-full px-1.5 py-0.5 text-[11px]" : "mx-0.5 rounded-full px-2 py-0.5 text-xs",
        chip.bg,
        chip.text,
        chip.ring,
        className,
      )}
      title={name}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
          compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]",
          avatarBg,
        )}
      >
        {memberInitials(name)}
      </span>
      <span className="truncate">@{name}</span>
    </span>
  );
}
