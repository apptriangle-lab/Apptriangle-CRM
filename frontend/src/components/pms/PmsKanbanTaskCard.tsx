import {
  AlertCircle,
  Calendar,
  Check,
  Circle,
  Clock,
  Paperclip,
  Type,
} from "lucide-react";
import { formatPmsTaskStatusLabel, type PmsTaskDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";
import {
  avatarBgClass,
  formatPmsTaskDateRange,
  memberInitials,
  pmsStatusTheme,
  type PmsStatusTheme,
} from "@/components/pms/pmsTaskListStyles";
import { isPmsTaskOverdue } from "@/lib/pmsTaskDates";
import { KanbanStatusIcon } from "@/components/pms/PmsKanbanStatusIcon";

export { KanbanStatusIcon };

function kanbanAttachmentLabel(task: PmsTaskDto): string {
  const count = task.attachments?.length ?? task.attachmentCount ?? 0;
  if (count <= 0) return "";
  const firstName = task.attachments?.[0]?.fileName;
  if (count === 1 && firstName) return firstName;
  return `${count} attachment${count === 1 ? "" : "s"}`;
}

function primaryAssignee(task: PmsTaskDto): { name: string; userId?: string } {
  const first = task.assignees?.[0];
  if (first?.userName) return { name: first.userName, userId: first.userId };
  if (task.assigneeName) return { name: task.assigneeName, userId: task.assignedTo ?? undefined };
  return { name: "—" };
}

function KanbanMetaRow({
  icon: Icon,
  value,
  iconClassName,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-slate-500">
      <Icon className={cn("h-3.5 w-3.5 shrink-0 text-slate-400", iconClassName)} strokeWidth={1.75} />
      <span className={cn("min-w-0 truncate", valueClassName)}>{value}</span>
    </div>
  );
}

export function PmsKanbanTaskCardBody({
  task,
  theme,
  statusLabel,
  showProjectLabel = false,
}: {
  task: PmsTaskDto;
  theme: PmsStatusTheme;
  statusLabel: string;
  showProjectLabel?: boolean;
}) {
  const assignee = primaryAssignee(task);
  const description = task.description?.trim() ?? "";
  const dateLabel =
    task.startDate || task.endDate ? formatPmsTaskDateRange(task) : "";
  const attachmentLabel = kanbanAttachmentLabel(task);
  const dueOverdue = isPmsTaskOverdue(task);
  const hasMeta = Boolean(description || dateLabel || attachmentLabel);

  return (
    <>
      <h4 className="text-[13px] font-semibold leading-snug text-slate-900">{task.title}</h4>
      {showProjectLabel && task.projectTitle ? (
        <p className="mt-1 truncate text-[11px] font-medium text-violet-600">{task.projectTitle}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {assignee.name !== "—" ? (
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white",
              avatarBgClass(assignee.userId),
            )}
            title={assignee.name}
          >
            {memberInitials(assignee.name)}
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500">
            ?
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            theme.kanbanCardPill,
          )}
        >
          <KanbanStatusIcon status={task.status} className="h-3 w-3 shrink-0 opacity-80" />
          {statusLabel}
        </span>
      </div>

      {hasMeta ? (
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
          {description ? (
            <div className="flex items-start gap-2.5 text-[12px] text-slate-600">
              <Type className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
              <p className="min-w-0 line-clamp-2 leading-snug">{description}</p>
            </div>
          ) : null}
          {dateLabel ? (
            <KanbanMetaRow
              icon={Calendar}
              value={dateLabel}
              iconClassName={dueOverdue ? "text-red-500" : undefined}
              valueClassName={dueOverdue ? "font-medium text-red-600" : undefined}
            />
          ) : null}
          {attachmentLabel ? (
            <KanbanMetaRow icon={Paperclip} value={attachmentLabel} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

type PmsKanbanTaskCardProps = {
  task: PmsTaskDto;
  onClick: () => void;
  className?: string;
};

/** Kanban-style task card — matches board card layout. */
export function PmsKanbanTaskCard({ task, onClick, className }: PmsKanbanTaskCardProps) {
  const theme = pmsStatusTheme(task.status);
  const statusLabel = formatPmsTaskStatusLabel(task.status).toUpperCase();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-[10px] border border-slate-200/90 bg-white p-3.5 text-left",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
        className,
      )}
    >
      <PmsKanbanTaskCardBody task={task} theme={theme} statusLabel={statusLabel} />
    </article>
  );
}
