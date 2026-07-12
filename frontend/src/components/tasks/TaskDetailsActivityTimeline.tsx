import { Clock } from "lucide-react";
import { cn, formatStatusLabel } from "@/lib/utils";
import type { TaskActivityLog } from "@/data/mockData";
import {
  CRM_TASK_DETAIL_BODY,
  CRM_TASK_DETAIL_CARD,
  CRM_TASK_DETAIL_SECTION_TITLE,
  activityDotColors,
} from "./taskDetailsConstants";

type TaskDetailsActivityTimelineProps = {
  logs: TaskActivityLog[];
  getUserName: (userId: string) => string;
  className?: string;
};

function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function activityLabel(actionType: TaskActivityLog["actionType"]): string {
  switch (actionType) {
    case "status_changed":
      return "changed status";
    case "created":
      return "created task";
    case "updated":
      return "updated task";
    case "deleted":
      return "deleted task";
    default:
      return actionType.replace("_", " ");
  }
}

export function TaskDetailsActivityTimeline({
  logs,
  getUserName,
  className,
}: TaskDetailsActivityTimelineProps) {
  return (
    <div className={cn(CRM_TASK_DETAIL_CARD, "flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-6">
        <h2 className={CRM_TASK_DETAIL_SECTION_TITLE}>Activity</h2>
        {logs.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
            {logs.length}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-table sm:px-6">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">No activity yet.</p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />
            {logs.map((log) => (
              <div key={log.id} className="relative pb-4 pl-7 last:pb-0">
                <div
                  className={cn(
                    "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                    activityDotColors[log.actionType] ?? "bg-slate-400",
                  )}
                />
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-semibold text-slate-800">
                      {getUserName(log.actorUserId)}
                    </span>
                    <span className={CRM_TASK_DETAIL_BODY}>{activityLabel(log.actionType)}</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {formatActivityTime(log.createdAt)}
                    </span>
                  </div>

                  {log.actionType === "status_changed" && log.oldValue && log.newValue ? (
                    <p className="mt-1 text-[12px] text-slate-500">
                      {formatStatusLabel(String((log.oldValue as Record<string, string>).status ?? ""))}
                      {" → "}
                      <span className="font-medium text-slate-700">
                        {formatStatusLabel(String((log.newValue as Record<string, string>).status ?? ""))}
                      </span>
                    </p>
                  ) : null}

                  {log.actionType === "updated" && log.newValue ? (
                    <p className="mt-1 text-[12px] text-slate-500">
                      Updated{" "}
                      <span className="font-medium text-slate-700">
                        {Object.keys(log.newValue).join(", ")}
                      </span>
                    </p>
                  ) : null}

                  {log.note ? (
                    <p className="mt-1 text-[12px] italic text-slate-500">&ldquo;{log.note}&rdquo;</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
