import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationDto } from "@/lib/api";
import { NotificationListItem } from "@/components/notifications/NotificationListItem";
import { ScrollArea } from "@/components/ui/scroll-area";

type FilterTab = "all" | "unread";

type Props = {
  notifications: NotificationDto[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
};

export function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onDelete,
  onNavigate,
}: Props) {
  const [tab, setTab] = useState<FilterTab>("all");

  const visible = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, tab],
  );

  return (
    <div className="flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[#e9ebf0] bg-white shadow-[0_8px_30px_rgba(41,45,55,0.12)]">
      <div className="flex items-center justify-between border-b border-[#eceef2] px-4 py-3.5">
        <h4 className="text-[15px] font-semibold tracking-[-0.01em] text-[#292d34]">Notifications</h4>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-[12px] font-medium text-[#7b68ee] transition-colors hover:text-[#6a55e0]"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-5 border-b border-[#eceef2] px-4">
        {(["all", "unread"] as const).map((key) => {
          const active = tab === key;
          const count = key === "unread" ? unreadCount : notifications.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "relative -mb-px py-2.5 text-[13px] font-medium transition-colors",
                active ? "text-[#7b68ee]" : "text-[#87909e] hover:text-[#555b66]",
              )}
            >
              {key === "all" ? "All" : "Unread"}
              {count > 0 && (
                <span className={cn("ml-1.5 tabular-nums", active ? "text-[#7b68ee]" : "text-[#b4b9c3]")}>
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#7b68ee]" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <ScrollArea className="h-[min(420px,calc(100vh-12rem))]">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f5f7]">
              <Bell className="h-6 w-6 text-[#c4c9d2]" strokeWidth={1.75} />
            </div>
            <p className="text-[14px] font-semibold text-[#292d34]">
              {tab === "unread" ? "You're all caught up" : "No notifications yet"}
            </p>
            <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-[#87909e]">
              {tab === "unread"
                ? "Unread notifications will show up here."
                : "We'll notify you when tasks, PMS updates, or other activity happens."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eceef2]">
            {visible.map((n) => (
              <NotificationListItem
                key={n.id}
                notification={n}
                onMarkRead={onMarkRead}
                onDelete={onDelete}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
