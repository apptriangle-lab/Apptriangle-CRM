import { useRef, useState, type ReactNode } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pmsApi } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  onUploaded?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  /** Ref to wire toolbar Upload button to the hidden input */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onUploadingChange?: (uploading: boolean) => void;
};

export function PmsProjectDocumentsUploadZone({
  projectId,
  onUploaded,
  disabled,
  className,
  children,
  inputRef: externalInputRef,
  onUploadingChange,
}: Props) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const setBusy = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || uploading) return;
    setBusy(true);
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        await pmsApi.uploadProjectDocument(projectId, file);
        uploadedCount += 1;
      }
      toast.success(uploadedCount === 1 ? "File uploaded" : `${uploadedCount} files uploaded`);
      onUploaded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      setDragActive(false);
    }
  };

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        void uploadFiles(e.dataTransfer.files);
      }}
    >
      {children}

      {(dragActive || uploading) && !disabled ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-[2px]",
            uploading
              ? "border-violet-300 bg-white/85"
              : "border-violet-400 bg-violet-50/80",
          )}
        >
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="text-sm font-semibold text-slate-800">Uploading files…</p>
              </>
            ) : (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
                  <CloudUpload className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-slate-800">Drop files to upload</p>
                <p className="text-xs text-slate-500">Files are added to this project</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => void uploadFiles(e.target.files)}
      />
    </div>
  );
}
