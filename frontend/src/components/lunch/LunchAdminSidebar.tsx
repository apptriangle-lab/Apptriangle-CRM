import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LunchMainTabs, type LunchMainTab } from "@/components/lunch/LunchMainTabs";
import { cn } from "@/lib/utils";

const LUNCH_ADMIN_SIDEBAR_COLLAPSED_KEY = "crm_lunch_admin_sidebar_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(LUNCH_ADMIN_SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

const tooltipClass = cn(
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 shadow-lg",
);

type Props = {
  value: LunchMainTab;
  onChange: (value: LunchMainTab) => void;
};

export function LunchAdminSidebar({ value, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(LUNCH_ADMIN_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleButton = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand lunch menu" : "Collapse lunch menu"}
      className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-0 text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900"
    >
      <ChevronLeft
        className={cn(
          "h-4 w-4 transition-transform duration-300 ease-in-out",
          collapsed && "rotate-180",
        )}
      />
    </Button>
  );

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200/90 bg-white transition-[width] duration-300 ease-in-out",
        collapsed ? "w-12" : "w-[196px]",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <LunchMainTabs
          value={value}
          onChange={onChange}
          orientation="vertical"
          collapsed={collapsed}
        />
        <div className="mt-auto shrink-0 border-t border-slate-200/90 p-2">
          {collapsed ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
              <TooltipContent side="right" align="center" sideOffset={12} className={tooltipClass}>
                Expand menu
                <TooltipArrow className="fill-white" />
              </TooltipContent>
            </Tooltip>
          ) : (
            toggleButton
          )}
        </div>
      </div>
    </aside>
  );
}
