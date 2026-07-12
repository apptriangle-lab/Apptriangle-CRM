import { useEffect, useMemo, useRef, useState } from "react";
import { PmsProjectDocumentsGrid } from "@/components/pms/documents/PmsProjectDocumentsGrid";
import {
  PmsProjectDocumentsContentSkeleton,
  PmsProjectDocumentsStatsSkeleton,
} from "@/components/pms/documents/PmsProjectDocumentsSkeleton";
import { PmsProjectDocumentsStats } from "@/components/pms/documents/PmsProjectDocumentsStats";
import { PmsProjectDocumentsTable } from "@/components/pms/documents/PmsProjectDocumentsTable";
import { PmsProjectDocumentsToolbar } from "@/components/pms/documents/PmsProjectDocumentsToolbar";
import { PmsProjectDocumentsUploadZone } from "@/components/pms/documents/PmsProjectDocumentsUploadZone";
import type { PmsDocumentSourceFilter, PmsDocumentViewMode } from "@/components/pms/documents/pmsDocumentVisuals";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { usePmsProjectDocuments } from "@/hooks/usePmsProjectDocuments";

export function PmsProjectDocumentsView() {
  const { projectId } = usePmsProject();
  const { openTask } = usePmsTaskModal();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<PmsDocumentSourceFilter>("all");
  const [viewMode, setViewMode] = useState<PmsDocumentViewMode>("list");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { documents, totalCount, projectCount, taskCount, loading, error, reload } = usePmsProjectDocuments({
    projectId,
    search: debouncedSearch,
    fileType,
    sourceFilter,
  });

  const stats = useMemo(
    () => ({
      total: totalCount,
      projectCount,
      taskCount,
    }),
    [totalCount, projectCount, taskCount],
  );

  const hasActiveFilters =
    search.trim().length > 0 || fileType !== "all" || sourceFilter !== "all";

  const emptyTitle = hasActiveFilters
    ? "No documents match your filters"
    : "No documents yet";
  const emptyDescription = hasActiveFilters
    ? "Try adjusting your search or filters to find what you need."
    : "Upload project files or attach documents to tasks — everything shows up here.";

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6">
        <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Could not load documents</p>
          <p className="max-w-md text-[13px] text-slate-500">{error}</p>
          <Button type="button" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6">
        <div className="shrink-0">
          <PmsProjectDocumentsToolbar
            search={search}
            onSearchChange={setSearch}
            fileType={fileType}
            onFileTypeChange={setFileType}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={loading ? 0 : documents.length}
            uploading={uploading}
            onUploadClick={() => uploadInputRef.current?.click()}
          />
        </div>

        <PmsProjectDocumentsUploadZone
          projectId={projectId}
          inputRef={uploadInputRef}
          onUploaded={() => void reload()}
          onUploadingChange={setUploading}
          className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
            {loading ? (
              <PmsProjectDocumentsStatsSkeleton />
            ) : (
              <PmsProjectDocumentsStats
                total={stats.total}
                projectCount={stats.projectCount}
                taskCount={stats.taskCount}
              />
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
                {loading ? (
                  <PmsProjectDocumentsContentSkeleton viewMode={viewMode} />
                ) : viewMode === "list" ? (
                  <PmsProjectDocumentsTable
                    documents={documents}
                    onOpenTask={(taskId) => openTask(taskId)}
                    onUploadClick={() => uploadInputRef.current?.click()}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                  />
                ) : documents.length === 0 ? (
                  <PmsProjectDocumentsTable
                    documents={documents}
                    onOpenTask={(taskId) => openTask(taskId)}
                    onUploadClick={() => uploadInputRef.current?.click()}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                  />
                ) : (
                  <PmsProjectDocumentsGrid
                    documents={documents}
                    onOpenTask={(taskId) => openTask(taskId)}
                  />
                )}
              </div>
            </div>
          </div>
        </PmsProjectDocumentsUploadZone>
      </div>
    </TooltipProvider>
  );
}
