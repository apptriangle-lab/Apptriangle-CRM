import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

export function PmsComingSoon({
  title,
  description = "This section is under development and will be available soon.",
  icon: Icon = Construction,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        <span className="mt-6 inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coming soon
        </span>
      </div>
    </div>
  );
}
