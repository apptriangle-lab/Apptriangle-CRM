export type MentionMember = {
  userId: string;
  name: string;
  email?: string;
};

export type CommentSegment =
  | { type: "text"; text: string }
  | { type: "mention"; name: string; userId: string };

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

export const MENTION_CHIP_STYLES = [
  { bg: "bg-slate-100", text: "text-slate-800", ring: "ring-slate-200/80" },
  { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200/80" },
  { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200/80" },
  { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200/80" },
  { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200/80" },
  { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200/80" },
] as const;

export const MENTION_AVATAR_BG = [
  "bg-slate-700",
  "bg-teal-600",
  "bg-sky-600",
  "bg-orange-500",
  "bg-violet-600",
  "bg-rose-500",
] as const;

function userColorIndex(userId: string): number {
  return [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % MENTION_CHIP_STYLES.length;
}

/** @deprecated Use userMentionChipStyle instead */
export const MENTION_TEXT_COLORS = MENTION_CHIP_STYLES.map((style) => style.text);

export function userMentionChipStyle(userId: string) {
  return MENTION_CHIP_STYLES[userColorIndex(userId)];
}

export function userMentionAvatarBg(userId: string) {
  return MENTION_AVATAR_BG[userColorIndex(userId)];
}

export function userMentionColorClass(userId: string): string {
  return userMentionChipStyle(userId).text;
}

export function userMentionChipClassName(userId: string): string {
  const style = userMentionChipStyle(userId);
  return `${style.bg} ${style.text} ${style.ring}`;
}

export function formatMentionToken(name: string, userId: string): string {
  return `@[${name}](${userId})`;
}

export function parseCommentMentions(text: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, index) });
    }
    segments.push({
      type: "mention",
      name: match[1],
      userId: match[2],
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "text", text }];
}
