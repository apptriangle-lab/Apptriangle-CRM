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
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { type PmsProjectDocumentDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

type Props = {
  document: PmsProjectDocumentDto;
  onOpenTask?: (taskId: string) => void;
};

export function PmsProjectDocumentRow({ document, onOpenTask }: Props) {
  const visual = getPmsDocumentVisual(document.fileName, document.fileType);
  const Icon = visual.icon;
  const canPreview = isPmsDocumentPreviewable(document.fileName, document.fileType);
  const location =
    document.source === "project"
      ? PMS_DOCUMENT_LOCATION_VISUAL.project
      : PMS_DOCUMENT_LOCATION_VISUAL.task;
  const LocationIcon = location.icon;

  const addedAt = document.createdAt
    ? format(new Date(document.createdAt), "MMM d, yyyy · h:mm a")
    : "—";

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

  return (
    <TableRow className="group border-slate-100 hover:bg-slate-50/80">
      <TableCell className="py-2.5 pl-4 pr-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/[0.04]",
              visual.iconBg,
            )}
          >
            <Icon className={cn("h-4 w-4", visual.iconColor)} />
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-[13px] font-semibold text-slate-800"
              title={document.fileName}
            >
              {document.fileName}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {visual.typeLabel}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell className="hidden py-2.5 md:table-cell">
        {document.source === "project" ? (
          <span
            className={cn(
              "inline-flex max-w-[200px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
              location.pill,
            )}
          >
            <LocationIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{location.label}</span>
          </span>
        ) : document.taskTitle && document.taskId ? (
          <button
            type="button"
            className="inline-flex max-w-[220px] items-center gap-1.5 truncate text-left text-[12px] font-medium text-violet-700 hover:text-violet-900 hover:underline"
            onClick={() => onOpenTask?.(document.taskId!)}
            title={document.taskTitle}
          >
            <LocationIcon className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span className="truncate">{document.taskTitle}</span>
          </button>
        ) : (
          <span className="text-[12px] text-slate-400">—</span>
        )}
      </TableCell>

      <TableCell className="hidden py-2.5 text-[12px] tabular-nums text-slate-500 sm:table-cell">
        {formatPmsFileSize(document.fileSize)}
      </TableCell>

      <TableCell className="hidden py-2.5 text-[12px] whitespace-nowrap text-slate-500 lg:table-cell">
        {addedAt}
      </TableCell>

      <TableCell className="hidden py-2.5 xl:table-cell">
        {document.uploadedByName ? (
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
              {getPmsDocumentUploaderInitials(document.uploadedByName)}
            </span>
            <span className="max-w-[120px] truncate text-[12px] text-slate-600">
              {document.uploadedByName}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-slate-400">—</span>
        )}
      </TableCell>

      <TableCell className="py-2.5 pr-4 text-right">
        <div className="flex items-center justify-end gap-0.5">
          {canPreview ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-violet-700 group-hover:opacity-100 group-focus-within:opacity-100"
              title="Preview"
              onClick={() => void handleView()}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:bg-white hover:text-slate-800"
            title="Download"
            onClick={() => void handleDownload()}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
