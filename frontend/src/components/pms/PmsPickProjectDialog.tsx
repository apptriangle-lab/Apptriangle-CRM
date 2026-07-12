import { useCallback, useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { pmsApi, type PmsProjectDto } from "@/lib/pmsApi";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (project: PmsProjectDto) => void;
};

export function PmsPickProjectDialog({ open, onOpenChange, onSelect }: Props) {
  const [projects, setProjects] = useState<PmsProjectDto[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pmsApi.listProjects({ page: 1, perPage: 200 });
      setProjects(r.items ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Choose a project</DialogTitle>
          <DialogDescription>Select which project this new task belongs to.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <Loader message="Loading projects…" className="py-8" />
        ) : projects.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No projects available.</p>
        ) : (
          <div className="max-h-[320px] space-y-1 overflow-y-auto scrollbar-thin">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  onSelect(project);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  "hover:bg-slate-50",
                )}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <FolderKanban className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{project.title}</span>
                  {project.companyName ? (
                    <span className="block truncate text-xs text-slate-500">{project.companyName}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
