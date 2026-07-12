import { useRef, useState, type RefObject } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { pmsApi, type PmsTaskAttachmentDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  /** When set, files upload immediately. When null, files stay pending until task is created. */
  taskId?: string | null;
  attachments?: PmsTaskAttachmentDto[];
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  onAttachmentsChange?: (attachments: PmsTaskAttachmentDto[]) => void;
  disabled?: boolean;
  className?: string;
  /** Optional ref for hidden file input (e.g. sidebar upload button). */
  fileInputRef?: RefObject<HTMLInputElement | null>;
};

export function PmsTaskAttachmentsSection({
  taskId,
  attachments = [],
  pendingFiles = [],
  onPendingFilesChange,
  onAttachmentsChange,
  disabled,
  className,
  fileInputRef: externalInputRef,
}: Props) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const [uploading, setUploading] = useState(false);

  const addPending = (files: FileList | null) => {
    if (!files?.length || disabled) return;
    const next = [...pendingFiles, ...Array.from(files)];
    onPendingFilesChange?.(next);
  };

  const removePending = (index: number) => {
    onPendingFilesChange?.(pendingFiles.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !taskId || disabled) return;
    setUploading(true);
    const uploaded: PmsTaskAttachmentDto[] = [];
    try {
      for (const file of Array.from(files)) {
        const row = await pmsApi.uploadAttachment(taskId, file);
        uploaded.push(row);
      }
      onAttachmentsChange?.([...uploaded, ...attachments]);
      toast.success(uploaded.length === 1 ? "File uploaded" : `${uploaded.length} files uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onPick = (files: FileList | null) => {
    if (taskId) void uploadFiles(files);
    else addPending(files);
  };

  const handleDownload = async (att: PmsTaskAttachmentDto) => {
    if (!taskId) return;
    try {
      await pmsApi.downloadAttachment(taskId, att.id, att.fileName);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const hasList = attachments.length > 0 || pendingFiles.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-slate-800">Attachments</h4>

      {hasList && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:text-violet-700"
                onClick={() => void handleDownload(att)}
                disabled={!taskId}
              >
                {att.fileName}
              </button>
              {att.fileSize != null && (
                <span className="shrink-0 text-xs text-slate-400">{formatFileSize(att.fileSize)}</span>
              )}
            </li>
          ))}
          {pendingFiles.map((file, index) => (
            <li key={`pending-${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50/80">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{formatFileSize(file.size)}</span>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                onClick={() => removePending(index)}
                disabled={disabled}
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-6 text-center text-sm text-slate-500 transition-colors",
          !disabled && "hover:border-slate-300 hover:bg-slate-50",
          (disabled || uploading) && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onPick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <span className="text-slate-600">Uploading…</span>
        ) : (
          <>
            <Paperclip className="mb-2 h-5 w-5 text-slate-400" />
            <span>Drop your files here to upload</span>
            {!taskId && pendingFiles.length > 0 && (
              <span className="mt-1 block text-xs text-slate-400">
                Files will upload when you create the task
              </span>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => onPick(e.target.files)}
        />
      </div>
    </div>
  );
}

/** Upload pending files after task creation. */
export async function uploadPendingPmsAttachments(
  taskId: string,
  files: File[],
): Promise<PmsTaskAttachmentDto[]> {
  const uploaded: PmsTaskAttachmentDto[] = [];
  for (const file of files) {
    uploaded.push(await pmsApi.uploadAttachment(taskId, file));
  }
  return uploaded;
}
