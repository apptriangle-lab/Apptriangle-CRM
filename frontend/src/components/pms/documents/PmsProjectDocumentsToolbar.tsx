import {
  LayoutGrid,
  List,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PmsDocumentFileTypeFilterDropdown } from "@/components/pms/documents/PmsDocumentFileTypeFilterDropdown";
import {
  PMS_DOCUMENT_FILE_TYPE_OPTIONS,
} from "@/components/pms/documents/pmsDocumentUtils";
import {
  PMS_DOCUMENT_SOURCE_OPTIONS,
  PMS_DOCUMENT_VIEW_OPTIONS,
  type PmsDocumentSourceFilter,
  type PmsDocumentViewMode,
} from "@/components/pms/documents/pmsDocumentVisuals";
import { cn } from "@/lib/utils";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  fileType: string;
  onFileTypeChange: (value: string) => void;
  sourceFilter: PmsDocumentSourceFilter;
  onSourceFilterChange: (value: PmsDocumentSourceFilter) => void;
  viewMode: PmsDocumentViewMode;
  onViewModeChange: (value: PmsDocumentViewMode) => void;
  resultCount: number;
  uploading?: boolean;
  onUploadClick: () => void;
};

export function PmsProjectDocumentsToolbar({
  search,
  onSearchChange,
  fileType,
  onFileTypeChange,
  sourceFilter,
  onSourceFilterChange,
  viewMode,
  onViewModeChange,
  resultCount,
  uploading = false,
  onUploadClick,
}: Props) {
  const fileTypeLabel =
    PMS_DOCUMENT_FILE_TYPE_OPTIONS.find((o) => o.value === fileType)?.label ?? "All types";
  const sourceLabel =
    PMS_DOCUMENT_SOURCE_OPTIONS.find((o) => o.value === sourceFilter)?.label ?? "All files";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            All project files and task attachments in one place
            {resultCount > 0 ? (
              <span className="text-slate-400"> · {resultCount} shown</span>
            ) : null}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={uploading}
          className="h-9 shrink-0 self-start rounded-lg bg-violet-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 lg:self-auto"
          onClick={onUploadClick}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Upload files
        </Button>
      </div>

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1 xl:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by file or task name…"
            className={cn(
              "h-9 w-full border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-violet-300 focus-visible:ring-1 focus-visible:ring-violet-200",
              search.trim() && "border-violet-200 bg-violet-50/30",
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
            {PMS_DOCUMENT_SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSourceFilterChange(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                  sourceFilter === option.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <PmsDocumentFileTypeFilterDropdown value={fileType} onChange={onFileTypeChange} align="end" />

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {PMS_DOCUMENT_VIEW_OPTIONS.map((option) => {
              const Icon = option.value === "list" ? List : LayoutGrid;
              return (
                <button
                  key={option.value}
                  type="button"
                  title={`${option.label} view`}
                  onClick={() => onViewModeChange(option.value)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    viewMode === option.value
                      ? "bg-slate-900 text-white"
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(sourceFilter !== "all" || fileType !== "all") && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
          <span>Active filters:</span>
          {sourceFilter !== "all" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              {sourceLabel}
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => onSourceFilterChange("all")}
                aria-label="Clear source filter"
              >
                ×
              </button>
            </span>
          ) : null}
          {fileType !== "all" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              {fileTypeLabel}
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => onFileTypeChange("all")}
                aria-label="Clear file type filter"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
