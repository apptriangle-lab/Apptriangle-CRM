import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function rfqUserInitials(name: string, email: string): string {
  const src = (name || email).trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export function RfqUserAvatar({
  name,
  email,
  profilePicture,
  className,
  size = "md",
}: {
  name: string;
  email: string;
  profilePicture?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const textCls = size === "sm" ? "text-[10px]" : "text-xs";
  const pic = profilePicture?.trim();
  return (
    <Avatar className={cn("shrink-0 ring-2 ring-white dark:ring-slate-950", sizeCls, className)}>
      {pic ? <AvatarImage src={pic} alt="" className="object-cover" /> : null}
      <AvatarFallback
        className={cn(
          "bg-gradient-to-br from-slate-200 to-slate-300 font-semibold text-slate-700 dark:from-slate-600 dark:to-slate-700 dark:text-slate-100",
          textCls,
        )}
      >
        {rfqUserInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
