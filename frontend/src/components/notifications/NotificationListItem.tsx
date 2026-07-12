import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, humanizeSnakeCaseTokensInText } from "@/lib/utils";
import type { NotificationDto } from "@/lib/api";
import {
  formatCompactTime,
  formatNotificationTitle,
  getNotificationCategoryMeta,
  getNotificationHref,
  resolveNotificationCategory,
} from "@/lib/notificationDisplay";

type Props = {
  notification: NotificationDto;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
};

export function NotificationListItem({ notification, onMarkRead, onDelete, onNavigate }: Props) {
  const navigate = useNavigate();
  const category = resolveNotificationCategory(notification);
  const meta = getNotificationCategoryMeta(notification);
  const Icon = meta.icon;
  const title = formatNotificationTitle(notification.title, category);
  const message = humanizeSnakeCaseTokensInText(notification.message);
  const href = getNotificationHref(notification);

  const handleActivate = () => {
    if (!notification.isRead) onMarkRead(notification.id);
    if (href) {
      navigate(href);
      onNavigate?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={cn(
        "group relative flex gap-3 px-4 py-3 transition-colors hover:bg-[#fafbfc]",
        href && "cursor-pointer",
        !notification.isRead && "bg-[#f5f3ff]/60",
      )}
    >
      {!notification.isRead && (
        <span
          className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full", meta.accentClass)}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ring-1",
          meta.iconWrapClass,
        )}
      >
        <Icon className={cn("h-4 w-4", meta.iconClass)} strokeWidth={2.25} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1",
              meta.badgeClass,
            )}
          >
            {meta.label}
          </span>
          <span className="ml-auto shrink-0 text-[11px] font-medium text-[#87909e]">
            {formatCompactTime(notification.createdAt)}
          </span>
        </div>

        <p
          className={cn(
            "text-[13px] leading-[1.35] text-[#292d34]",
            !notification.isRead ? "font-semibold" : "font-medium",
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-[#7c828d]">{message}</p>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md border border-[#eceef2] bg-white/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {!notification.isRead && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#7c828d] transition-colors hover:bg-[#f4f5f7] hover:text-[#292d34]"
            aria-label="Mark as read"
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-[#7c828d] transition-colors hover:bg-[#f4f5f7] hover:text-[#292d34]"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
