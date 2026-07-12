export function formatPmsFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPmsFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase();
}

export type PmsDocumentFileCategory = "image" | "pdf" | "spreadsheet" | "document" | "archive" | "other";

export function getPmsDocumentFileCategory(
  fileName: string,
  fileType?: string | null,
): PmsDocumentFileCategory {
  const mime = (fileType ?? "").toLowerCase();
  const ext = getPmsFileExtension(fileName);

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(ext)
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    mime.startsWith("text/") ||
    ["doc", "docx", "txt", "md", "rtf"].includes(ext)
  ) {
    return "document";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

export function isPmsDocumentPreviewable(fileName: string, fileType?: string | null): boolean {
  const category = getPmsDocumentFileCategory(fileName, fileType);
  return category === "image" || category === "pdf";
}

export const PMS_DOCUMENT_FILE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDF" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "document", label: "Documents" },
  { value: "archive", label: "Archives" },
  { value: "other", label: "Other" },
];
