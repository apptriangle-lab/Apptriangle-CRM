import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

export type NotificationBellProps = {
  /** Match sidebar nav row (icon + label, full width) */
  sidebarStyle?: boolean;
  collapsed?: boolean;
};

export function NotificationBell({ sidebarStyle = false, collapsed = false }: NotificationBellProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
  } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  const badge = unreadCount > 0 && (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7b68ee] px-1 text-[10px] font-bold leading-none text-white",
        sidebarStyle && collapsed ? "absolute -right-0.5 -top-0.5" : sidebarStyle ? "ml-auto shrink-0" : "absolute -right-0.5 -top-0.5",
      )}
    >
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {sidebarStyle ? (
          <button
            type="button"
            className={cn(
              "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isOpen
                ? "bg-indigo-500/15 text-white shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]"
                : "text-slate-400/95 hover:bg-white/[0.06] hover:text-slate-100",
            )}
          >
            <Bell className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">Notifications</span>
                {badge}
              </>
            )}
            {collapsed && badge}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-[10px] border border-white/10 bg-white/[0.06] text-slate-100 shadow-none transition-colors hover:bg-white/[0.1] hover:text-white"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {badge}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align={sidebarStyle ? "start" : "end"}
        side={sidebarStyle ? "right" : "bottom"}
        sideOffset={10}
      >
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onMarkRead={markAsRead}
          onDelete={deleteNotification}
          onNavigate={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
