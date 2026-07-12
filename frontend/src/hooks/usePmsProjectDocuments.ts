import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPmsDocumentFileCategory,
  type PmsDocumentFileCategory,
} from "@/components/pms/documents/pmsDocumentUtils";
import type { PmsDocumentSourceFilter } from "@/components/pms/documents/pmsDocumentVisuals";
import { pmsApi, type PmsProjectDocumentDto } from "@/lib/pmsApi";

type UsePmsProjectDocumentsOptions = {
  projectId?: string;
  search: string;
  fileType: string;
  sourceFilter?: PmsDocumentSourceFilter;
};

export function usePmsProjectDocuments({
  projectId,
  search,
  fileType,
  sourceFilter = "all",
}: UsePmsProjectDocumentsOptions) {
  const [documents, setDocuments] = useState<PmsProjectDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await pmsApi.listProjectDocuments(projectId, {
        search: search.trim() || undefined,
      });
      setDocuments(response.items ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load documents";
      setError(message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (sourceFilter !== "all" && doc.source !== sourceFilter) return false;
      if (fileType === "all") return true;
      return (
        getPmsDocumentFileCategory(doc.fileName, doc.fileType) ===
        (fileType as PmsDocumentFileCategory)
      );
    });
  }, [documents, fileType, sourceFilter]);

  const projectCount = useMemo(
    () => documents.filter((doc) => doc.source === "project").length,
    [documents],
  );
  const taskCount = useMemo(
    () => documents.filter((doc) => doc.source === "task").length,
    [documents],
  );

  return {
    documents: filteredDocuments,
    totalCount: documents.length,
    projectCount,
    taskCount,
    loading,
    error,
    reload: load,
  };
}
