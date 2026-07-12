import { FolderOpen, Upload } from "lucide-react";
import { PmsProjectDocumentRow } from "@/components/pms/documents/PmsProjectDocumentRow";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type PmsProjectDocumentDto } from "@/lib/pmsApi";

type Props = {
  documents: PmsProjectDocumentDto[];
  onOpenTask?: (taskId: string) => void;
  onUploadClick?: () => void;
  emptyTitle: string;
  emptyDescription: string;
};

export function PmsProjectDocumentsTable({
  documents,
  onOpenTask,
  onUploadClick,
  emptyTitle,
  emptyDescription,
}: Props) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FolderOpen className="h-7 w-7" />
        </span>
        <h3 className="text-base font-semibold text-slate-900">{emptyTitle}</h3>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{emptyDescription}</p>
        {onUploadClick ? (
          <button
            type="button"
            onClick={onUploadClick}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
          >
            <Upload className="h-4 w-4" />
            Upload files
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Table scrollContainer={false} className="text-[13px]">
      <TableHeader>
        <TableRow className="border-slate-200/80 hover:bg-transparent">
          <TableHead className="sticky top-0 z-10 h-10 bg-slate-50/95 pl-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            Name
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm md:table-cell">
            Location
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm sm:table-cell">
            Size
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm lg:table-cell">
            Added
          </TableHead>
          <TableHead className="sticky top-0 z-10 hidden h-10 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm xl:table-cell">
            Uploaded by
          </TableHead>
          <TableHead className="sticky top-0 z-10 h-10 w-[88px] bg-slate-50/95 pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            Download
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <PmsProjectDocumentRow
            key={`${document.source}-${document.id}`}
            document={document}
            onOpenTask={onOpenTask}
          />
        ))}
      </TableBody>
    </Table>
  );
}
