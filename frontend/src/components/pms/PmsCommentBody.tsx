import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PmsMentionChip } from "@/components/pms/PmsMentionChip";
import { parseCommentMentions } from "@/components/pms/pmsCommentMentions";

type Props = {
  text: string;
  className?: string;
};

export function PmsCommentBody({ text, className }: Props) {
  const segments = useMemo(() => parseCommentMentions(text), [text]);

  return (
    <p className={cn("whitespace-pre-wrap break-words leading-relaxed", className)}>
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <PmsMentionChip
            key={`mention-${index}-${segment.userId}`}
            name={segment.name}
            userId={segment.userId}
          />
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
