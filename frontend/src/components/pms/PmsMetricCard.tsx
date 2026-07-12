import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PmsMetricAccent = "primary" | "info" | "success" | "warning" | "destructive" | "accent";

const accentStyles: Record<
  PmsMetricAccent,
  { card: string; iconWrap: string; icon: string; badge: string }
> = {
  primary: {
    card: "from-primary/8 via-card to-card border-primary/15",
    iconWrap: "bg-primary/10 text-primary",
    icon: "text-primary",
    badge: "bg-primary/10 text-primary",
  },
  info: {
    card: "from-info/8 via-card to-card border-info/15",
    iconWrap: "bg-info/10 text-info",
    icon: "text-info",
    badge: "bg-info/10 text-info",
  },
  success: {
    card: "from-success/8 via-card to-card border-success/15",
    iconWrap: "bg-success/10 text-success",
    icon: "text-success",
    badge: "bg-success/10 text-success",
  },
  warning: {
    card: "from-warning/8 via-card to-card border-warning/15",
    iconWrap: "bg-warning/10 text-warning",
    icon: "text-warning",
    badge: "bg-warning/10 text-warning",
  },
  destructive: {
    card: "from-destructive/8 via-card to-card border-destructive/15",
    iconWrap: "bg-destructive/10 text-destructive",
    icon: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  accent: {
    card: "from-accent/8 via-card to-card border-accent/15",
    iconWrap: "bg-accent/10 text-accent",
    icon: "text-accent",
    badge: "bg-accent/10 text-accent",
  },
};

type PmsMetricCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: PmsMetricAccent;
  badge?: string;
  className?: string;
  footer?: React.ReactNode;
  onClick?: () => void;
};

export function PmsMetricCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  badge,
  className,
  footer,
  onClick,
}: PmsMetricCardProps) {
  const styles = accentStyles[accent];
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        styles.card,
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
          {badge && (
            <span
              className={cn(
                "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                styles.badge,
              )}
            >
              {badge}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            styles.iconWrap,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon)} />
        </div>
      </div>
      {footer}
    </Wrapper>
  );
}
