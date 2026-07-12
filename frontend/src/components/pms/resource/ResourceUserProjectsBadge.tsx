import { FolderKanban } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { PmsResourceUserDto, PmsResourceUserProjectPreview } from "@/lib/pmsApi";
import { cn, formatStatusLabel } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

function resolveUserProjects(user: PmsResourceUserDto): PmsResourceUserProjectPreview[] {
  const apiById = new Map((user.projects ?? []).map((project) => [project.projectId, project]));
  const byProject = new Map<string, PmsResourceUserProjectPreview>();

  for (const task of user.tasks) {
    if (!task.projectId) continue;
    const existing = byProject.get(task.projectId);
    if (existing) {
      existing.taskCount += 1;
      continue;
    }
    const meta = apiById.get(task.projectId);
    byProject.set(
      task.projectId,
      meta
        ? { ...meta, taskCount: 1 }
        : {
            projectId: task.projectId,
            projectCode: "",
            projectTitle: task.projectTitle?.trim() || "Project",
            status: "",
            taskCount: 1,
          },
    );
  }

  for (const project of user.projects ?? []) {
    if (!project.projectId || byProject.has(project.projectId)) continue;
    byProject.set(project.projectId, { ...project, taskCount: project.taskCount ?? 0 });
  }

  return [...byProject.values()].sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
}

function ResourceUserProjectsTooltipContent({ projects }: { projects: PmsResourceUserProjectPreview[] }) {
  return (
    <div className="w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projects</p>
        <p className="text-xs text-slate-600">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="max-h-56 overflow-y-auto p-1.5 scrollbar-thinner">
        {projects.map((project) => (
          <li
            key={project.projectId}
            className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700">
              <FolderKanban className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold text-slate-900">{project.projectTitle}</p>
                {project.status ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-medium",
                      STATUS_BADGE[project.status] ?? "border-border bg-muted/40",
                    )}
                  >
                    {formatStatusLabel(project.status)}
                  </Badge>
                ) : null}
              </div>
              {project.projectCode ? (
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">{project.projectCode}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                {project.companyName ? <span className="truncate">{project.companyName}</span> : null}
                {project.priority ? (
                  <span className="capitalize">{project.priority} priority</span>
                ) : null}
                <span className="font-medium text-slate-600">
                  {project.taskCount} task{project.taskCount === 1 ? "" : "s"} in range
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResourceUserProjectsBadge({ user }: { user: PmsResourceUserDto }) {
  const projects = resolveUserProjects(user);
  const projectCount = projects.length > 0 ? projects.length : user.projectCount;
  const label = `${projectCount} project${projectCount === 1 ? "" : "s"}`;

  if (!projects.length) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        {label}
      </span>
    );
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          role="presentation"
          className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200/80"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={8}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <ResourceUserProjectsTooltipContent projects={projects} />
      </TooltipContent>
    </Tooltip>
  );
}
