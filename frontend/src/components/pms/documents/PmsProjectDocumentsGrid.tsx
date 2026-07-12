import { Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  downloadPmsProjectDocument,
  openPmsProjectDocument,
} from "@/components/pms/documents/pmsDocumentActions";
import { formatPmsFileSize, isPmsDocumentPreviewable } from "@/components/pms/documents/pmsDocumentUtils";
import {
  getPmsDocumentUploaderInitials,
  getPmsDocumentVisual,
  PMS_DOCUMENT_LOCATION_VISUAL,
} from "@/components/pms/documents/pmsDocumentVisuals";
import { type PmsProjectDocumentDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

type Props = {
  documents: PmsProjectDocumentDto[];
  onOpenTask?: (taskId: string) => void;
};

function CardActionButton({
  label,
  icon: Icon,
  onClick,
  variant = "default",
}: {
  label: string;
  icon: typeof Download;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-all",
        variant === "primary"
          ? "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100"
          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

function DocumentCard({ document, onOpenTask }: { document: PmsProjectDocumentDto; onOpenTask?: (taskId: string) => void }) {
  const visual = getPmsDocumentVisual(document.fileName, document.fileType);
  const Icon = visual.icon;
  const canPreview = isPmsDocumentPreviewable(document.fileName, document.fileType);
  const location =
    document.source === "project"
      ? PMS_DOCUMENT_LOCATION_VISUAL.project
      : PMS_DOCUMENT_LOCATION_VISUAL.task;

  const handleDownload = async () => {
    try {
      await downloadPmsProjectDocument(document);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const handleView = async () => {
    try {
      await openPmsProjectDocument(document);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  const addedAt = document.createdAt
    ? format(new Date(document.createdAt), "MMM d, yyyy · h:mm a")
    : "—";

  return (
    <div className="group flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.04]",
            visual.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", visual.iconColor)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800" title={document.fileName}>
            {document.fileName}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {visual.typeLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatPmsFileSize(document.fileSize)} · {addedAt}
          </p>
        </div>
      </div>

      <div className="mt-3 min-w-0 flex-1 border-t border-slate-100 pt-3">
        {document.source === "project" ? (
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
              location.pill,
            )}
          >
            {location.label}
          </span>
        ) : document.taskTitle && document.taskId ? (
          <button
            type="button"
            className="line-clamp-2 text-left text-[11px] font-medium text-violet-700 hover:underline"
            onClick={() => onOpenTask?.(document.taskId!)}
          >
            {document.taskTitle}
          </button>
        ) : null}
        {document.uploadedByName ? (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
              {getPmsDocumentUploaderInitials(document.uploadedByName)}
            </span>
            <p className="truncate text-[11px] text-slate-500">{document.uploadedByName}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {canPreview ? (
          <CardActionButton
            label="Preview"
            icon={ExternalLink}
            onClick={() => void handleView()}
            variant="primary"
          />
        ) : null}
        <CardActionButton label="Download" icon={Download} onClick={() => void handleDownload()} />
      </div>
    </div>
  );
}

export function PmsProjectDocumentsGrid({ documents, onOpenTask }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => (
        <DocumentCard key={`${document.source}-${document.id}`} document={document} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}
