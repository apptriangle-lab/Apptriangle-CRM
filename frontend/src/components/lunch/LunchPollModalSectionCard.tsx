import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LUNCH_POLL_SECTION_CARD } from "@/components/lunch/lunchPollModalStyles";

type Props = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  accent: string;
  action?: ReactNode;
  children: ReactNode;
};

export function LunchPollModalSectionCard({ icon: Icon, title, accent, action, children }: Props) {
  return (
    <section className={LUNCH_POLL_SECTION_CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
