import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PmsProjectFormModal,
  type ProjectFormState,
} from "@/components/pms/PmsProjectFormModal";
import { PmsProjectsToolbar } from "@/components/pms/PmsProjectsToolbar";
import { PmsProjectsTableSkeleton } from "@/components/pms/PmsProjectsTableSkeleton";
import { PmsProjectTableProgress } from "@/components/pms/PmsProjectTableProgress";
import {
  PmsProjectMembersAvatars,
  PmsProjectOwnerAvatar,
} from "@/components/pms/PmsProjectTablePeople";
import { Building2, FolderKanban, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { pmsApi, PMS_PRIORITIES, type PmsProjectDto } from "@/lib/pmsApi";
import { sortPmsProjectsByStar } from "@/lib/pmsProjectStars";
import { formatPmsProjectTableDate } from "@/components/pms/pmsTaskListStyles";
import { PmsProjectStarButton } from "@/components/pms/PmsProjectStarButton";
import { useProjectTypeColorMap } from "@/hooks/useProjectTypeColorMap";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { companiesApi, usersApi } from "@/lib/api";
import { cn, formatStatusLabel } from "@/lib/utils";
import { progressFromTaskStats } from "@/lib/pmsProjectProgress";
import { joinMultiFilterParam } from "@/components/pms/pmsMultiFilterUtils";
import { usePmsHubToolbarSlot } from "@/contexts/PmsHubToolbarContext";

const STATUS_BADGE: Record<string, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "text-slate-600",
  medium: "text-blue-600",
  high: "text-orange-600",
  urgent: "text-rose-600",
};

const emptyForm = (): ProjectFormState => ({
  title: "",
  description: "",
  companyId: "",
  projectTypeId: "",
  status: "",
  priority: "medium",
  startDate: "",
  endDate: "",
});

function projectToForm(p: PmsProjectDto): ProjectFormState {
  return {
    title: p.title,
    description: p.description ?? "",
    companyId: p.companyId ?? "",
    projectTypeId: p.projectTypeId ?? "",
    status: p.status,
    priority: p.priority,
    startDate: p.startDate?.slice(0, 10) ?? "",
    endDate: p.endDate?.slice(0, 10) ?? "",
  };
}

export default function PmsProjects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { perms } = usePmsPermissions();
  const { getChipClass } = useProjectTypeColorMap();
  const [items, setItems] = useState<PmsProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("all");
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [projectTypeIds, setProjectTypeIds] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PmsProjectDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<
    { id: string; name: string; location: string; country: string }[]
  >([]);
  const [users, setUsers] = useState<
    { id: string; name: string; email: string; phone: string }[]
  >([]);
  const [createForm, setCreateForm] = useState<ProjectFormState>(emptyForm);
  const [editForm, setEditForm] = useState<ProjectFormState>(emptyForm);
  const [createFieldErrors, setCreateFieldErrors] = useState<Partial<Record<keyof ProjectFormState, string>>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Partial<Record<keyof ProjectFormState, string>>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pmsApi
      .listProjects({
        search,
        companyId: company === "all" ? "" : company,
        userId: joinMultiFilterParam(memberUserIds),
        status: joinMultiFilterParam(statuses),
        projectTypeId: joinMultiFilterParam(projectTypeIds),
        priority: joinMultiFilterParam(priorities),
        page: 1,
        perPage: 50,
      })
      .then((r) => {
        if (!cancelled) setItems(sortPmsProjectsByStar(r.items));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, company, memberUserIds, statuses, projectTypeIds, priorities]);

  useEffect(() => {
    companiesApi
      .list()
      .then((list) =>
        setCompanies(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location ?? "",
            country: c.country ?? "",
          })),
        ),
      )
      .catch(() => {});
    usersApi
      .list()
      .then((list) =>
        setUsers(
          list
            .filter((u) => u.isActive)
            .map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email ?? "",
              phone: u.phone ?? "",
            })),
        ),
      )
      .catch(() => {});
  }, []);

  const canEditProject = (p: PmsProjectDto) => perms.isPmsAdmin || p.createdBy === user?.id;
  const showActionsColumn = perms.isPmsAdmin;

  const openCreate = useCallback(() => {
    setCreateForm(emptyForm());
    setCreateFieldErrors({});
    setCreateOpen(true);
  }, []);

  const openEdit = (p: PmsProjectDto) => {
    setEditingProject(p);
    setEditForm(projectToForm(p));
    setEditFieldErrors({});
    setEditOpen(true);
  };

  const handleToggleStar = useCallback(async (project: PmsProjectDto, starred: boolean) => {
    setItems((prev) =>
      sortPmsProjectsByStar(
        prev.map((item) => (item.id === project.id ? { ...item, isStarred: starred } : item)),
      ),
    );
    try {
      await pmsApi.setProjectStarred(project.id, starred);
    } catch {
      setItems((prev) =>
        sortPmsProjectsByStar(
          prev.map((item) => (item.id === project.id ? { ...item, isStarred: !starred } : item)),
        ),
      );
      toast.error("Failed to update starred project");
    }
  }, []);

  const handleCreate = async () => {
    const errors: Partial<Record<keyof ProjectFormState, string>> = {};
    if (!createForm.title.trim()) {
      errors.title = "Project title is required";
    }
    if (!createForm.companyId) {
      errors.companyId = "Company is required";
    }
    if (!createForm.projectTypeId) {
      errors.projectTypeId = "Project type is required";
    }
    if (!createForm.status) {
      errors.status = "Status is required";
    }
    if (Object.keys(errors).length > 0) {
      setCreateFieldErrors(errors);
      if (errors.projectTypeId) {
        toast.error("Please select a project type");
      } else if (errors.title) {
        toast.error("Project title is required");
      } else if (errors.companyId) {
        toast.error("Company is required");
      } else {
        toast.error("Status is required");
      }
      return;
    }
    setCreateFieldErrors({});
    setSaving(true);
    try {
      const created = await pmsApi.createProject({
        title: createForm.title,
        description: createForm.description,
        companyId: createForm.companyId,
        projectTypeId: createForm.projectTypeId,
        status: createForm.status,
        priority: createForm.priority,
        startDate: createForm.startDate || undefined,
        endDate: createForm.endDate || undefined,
      } as Partial<PmsProjectDto>);
      toast.success("Project created");
      setCreateOpen(false);
      navigate(`/pms/projects/${created.id}/tasks`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingProject) return;
    const errors: Partial<Record<keyof ProjectFormState, string>> = {};
    if (!editForm.title.trim()) {
      errors.title = "Project title is required";
    }
    if (!editForm.companyId) {
      errors.companyId = "Company is required";
    }
    if (!editForm.projectTypeId) {
      errors.projectTypeId = "Project type is required";
    }
    if (!editForm.status) {
      errors.status = "Status is required";
    }
    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors);
      if (errors.projectTypeId) {
        toast.error("Please select a project type");
      } else if (errors.title) {
        toast.error("Project title is required");
      } else if (errors.companyId) {
        toast.error("Company is required");
      } else {
        toast.error("Status is required");
      }
      return;
    }
    setEditFieldErrors({});
    setSaving(true);
    try {
      const updated = await pmsApi.updateProject(editingProject.id, {
        title: editForm.title,
        description: editForm.description,
        companyId: editForm.companyId,
        projectTypeId: editForm.projectTypeId,
        status: editForm.status,
        priority: editForm.priority,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
      } as Partial<PmsProjectDto>);
      setItems((prev) => sortPmsProjectsByStar(prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))));
      toast.success("Project updated");
      setEditOpen(false);
      setEditingProject(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const toolbar = useMemo(
    () => (
      <PmsProjectsToolbar
        search={search}
        onSearchChange={setSearch}
        company={company}
        onCompanyChange={setCompany}
        companies={companies}
        memberUserIds={memberUserIds}
        onMemberUserIdsChange={setMemberUserIds}
        users={users}
        statuses={statuses}
        onStatusesChange={setStatuses}
        projectTypeIds={projectTypeIds}
        onProjectTypeIdsChange={setProjectTypeIds}
        priorities={priorities}
        onPrioritiesChange={setPriorities}
        canCreateProject={perms.canCreateProject}
        onCreateProject={openCreate}
      />
    ),
    [search, company, companies, memberUserIds, users, statuses, projectTypeIds, priorities, perms.canCreateProject, openCreate],
  );

  usePmsHubToolbarSlot(toolbar);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        {loading ? (
          <PmsProjectsTableSkeleton showActionsColumn={showActionsColumn} />
        ) : items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={FolderKanban}
              title="No projects found"
              description={
                search ||
                company !== "all" ||
                memberUserIds.length > 0 ||
                statuses.length > 0 ||
                projectTypeIds.length > 0 ||
                priorities.length > 0
                  ? "Try adjusting your search or filters."
                  : "Create a project to get started."
              }
              actionLabel={perms.canCreateProject ? "New project" : undefined}
              onAction={perms.canCreateProject ? openCreate : undefined}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
            <Table scrollContainer={false}>
              <TableHeader>
                <TableRow className="sticky top-0 z-10 border-b border-border/60 bg-card hover:bg-card">
                  <TableHead className="h-10 w-10 px-2" aria-label="Starred" />
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Project{" "}
                    <span className="font-normal text-muted-foreground/80">({items.length})</span>
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Priority
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Start
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    End
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Members
                  </TableHead>
                  <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Owner
                  </TableHead>
                  {showActionsColumn ? (
                    <TableHead className="h-10 w-[72px] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/pms/projects/${p.id}/tasks`)}
                  >
                    <TableCell className="w-10 px-2">
                      <PmsProjectStarButton
                        starred={Boolean(p.isStarred)}
                        title={p.title}
                        onToggle={() => handleToggleStar(p, !p.isStarred)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 truncate font-medium text-foreground">{p.title}</p>
                          {p.projectTypeName ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                                getChipClass(p.projectTypeId),
                              )}
                            >
                              {p.projectTypeName}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.projectCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.companyName ? (
                        <span className="inline-flex max-w-[180px] items-center gap-1.5 text-sm text-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{p.companyName}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[5.5rem]">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                            STATUS_BADGE[p.status] ?? "border-border bg-muted/40",
                          )}
                        >
                          {formatStatusLabel(p.status)}
                        </Badge>
                        <PmsProjectTableProgress stats={progressFromTaskStats(p.taskStats)} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium capitalize",
                          PRIORITY_BADGE[p.priority] ?? "text-foreground",
                        )}
                      >
                        {p.priority}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-foreground">
                      {p.startDate ? formatPmsProjectTableDate(p.startDate) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-foreground">
                      {p.endDate ? formatPmsProjectTableDate(p.endDate) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <PmsProjectMembersAvatars members={p.members} ownerId={p.createdBy} />
                    </TableCell>
                    <TableCell>
                      <PmsProjectOwnerAvatar
                        ownerId={p.createdBy}
                        ownerName={p.ownerName}
                        ownerEmail={p.ownerEmail}
                      />
                    </TableCell>
                    {showActionsColumn ? (
                      <TableCell className="text-right">
                        {canEditProject(p) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                            aria-label={`Edit ${p.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PmsProjectFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        form={createForm}
        onChange={setCreateForm}
        companies={companies}
        saving={saving}
        onSubmit={handleCreate}
        fieldErrors={createFieldErrors}
      />

      <PmsProjectFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        form={editForm}
        onChange={setEditForm}
        companies={companies}
        projectCode={editingProject?.projectCode}
        saving={saving}
        onSubmit={handleUpdate}
        fieldErrors={editFieldErrors}
      />
    </>
  );
}
