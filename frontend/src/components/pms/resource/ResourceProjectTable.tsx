import { useCallback, useState } from "react";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import type { PmsResourceActivityDto } from "@/lib/pmsApi";
import { ResourceProjectRow } from "@/components/pms/resource/ResourceProjectRow";

type Props = {
  data?: PmsResourceActivityDto;
  loading?: boolean;
  fetched?: boolean;
  onTaskClick?: (taskId: string) => void;
};

export function ResourceProjectTable({ data, loading, fetched, onTaskClick }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((projectId: string, open: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(projectId);
      else next.delete(projectId);
      return next;
    });
  }, []);

  if (loading) {
    return <Loader message="Loading resource activity…" className="py-20" />;
  }

  if (!fetched) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <EmptyState
          icon={FolderKanban}
          title="Resource planning"
          description="Select a user and date range, then click Apply to see project activity."
        />
      </div>
    );
  }

  if (!data?.projects.length) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <EmptyState
          icon={FolderKanban}
          title="No project activity"
          description="This user has no assigned tasks in the selected date range."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {data.userName ?? "User"} · {data.summary.projectCount} project
            {data.summary.projectCount === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.summary.taskCount} task{data.summary.taskCount === 1 ? "" : "s"} · {data.from} → {data.to}
          </p>
        </div>
      </div>
      <div>
        {data.projects.map((project) => (
          <ResourceProjectRow
            key={project.projectId}
            project={project}
            from={data.from}
            to={data.to}
            expanded={expandedIds.has(project.projectId)}
            onExpandedChange={(open) => toggleExpanded(project.projectId, open)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
