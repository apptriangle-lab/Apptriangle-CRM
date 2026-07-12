import { cn } from "@/lib/utils";
import {
  CRM_TASK_DETAIL_BODY,
  CRM_TASK_DETAIL_CARD,
  CRM_TASK_DETAIL_SECTION_TITLE,
} from "./taskDetailsConstants";

type TaskDetailsNoteCardProps = {
  note: string | null;
};

export function TaskDetailsNoteCard({ note }: TaskDetailsNoteCardProps) {
  return (
    <div className={CRM_TASK_DETAIL_CARD}>
      <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
        <h2 className={CRM_TASK_DETAIL_SECTION_TITLE}>Description</h2>
      </div>
      <div className="px-5 py-4 sm:px-6">
        {note?.trim() ? (
          <p className={cn(CRM_TASK_DETAIL_BODY, "whitespace-pre-wrap leading-relaxed")}>{note}</p>
        ) : (
          <p className="text-[13px] text-slate-400">No description added.</p>
        )}
      </div>
    </div>
  );
}
