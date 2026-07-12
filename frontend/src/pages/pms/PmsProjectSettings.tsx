import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PmsProjectSettingsSkeleton } from "@/components/pms/PmsProjectSettingsSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PmsProjectMembersModal } from "@/components/pms/PmsProjectMembersModal";
import { PmsDeletedTasksPanel } from "@/components/pms/PmsDeletedTasksPanel";
import { RfqUserAvatar } from "@/components/rfq/RfqUserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { usersApi, type UserDto } from "@/lib/api";
import { pmsApi } from "@/lib/pmsApi";
import { cn, formatStatusLabel, formatTableDate } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarRange,
  Crown,
  Settings2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type SettingsTab = "team" | "deleted" | "danger";

export default function PmsProjectSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { perms, loading: permsLoading } = usePmsPermissions();
  const { projectId, project, refreshProject } = usePmsProject();
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<UserDto[]>([]);

  const canManageMembers =
    perms.canInviteMember || perms.isPmsAdmin || project?.createdBy === user?.id;

  const availableTabs = useMemo(() => {
    const tabs: { id: SettingsTab; label: string; icon: typeof Users }[] = [];
    if (canManageMembers) {
      tabs.push({ id: "team", label: "Project team", icon: Users });
    }
    if (perms.canManageDeletedTasks) {
      tabs.push({ id: "deleted", label: "Deleted tasks", icon: Archive });
    }
    if (perms.canCreateProject) {
      tabs.push({ id: "danger", label: "Danger zone", icon: AlertTriangle });
    }
    return tabs;
  }, [canManageMembers, perms.canManageDeletedTasks, perms.canCreateProject]);

  const defaultTab = availableTabs[0]?.id ?? "team";
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  useEffect(() => {
    if (!availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, availableTabs, defaultTab]);

  useEffect(() => {
    usersApi
      .list()
      .then((list) => setUsers(list.filter((u) => u.isActive)))
      .catch(() => {});
  }, []);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const members = project?.members ?? [];
  const memberPreview = useMemo(() => members.slice(0, 6), [members]);

  if (permsLoading) {
    return <PmsProjectSettingsSkeleton />;
  }

  if (!perms.canManageSettings && !canManageMembers && !perms.canManageDeletedTasks) {
    return <Navigate to=".." replace />;
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await pmsApi.deleteProject(projectId);
      toast.success("Project deleted");
      navigate("/pms");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const tabTriggerClass =
    "inline-flex items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-4 text-sm font-semibold text-slate-500 shadow-none data-[state=active]:border-slate-900 data-[state=active]:text-slate-900";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <Settings2 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{project?.projectCode}</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{project?.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Project settings, team access, and workspace configuration.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-lg capitalize">
                  {formatStatusLabel(project?.status ?? "active")}
                </Badge>
                <Badge variant="secondary" className="rounded-lg capitalize">
                  {project?.priority ?? "medium"} priority
                </Badge>
                {project?.companyName && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {project.companyName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {project?.description && (
        <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm">
          {project.description}
        </div>
      )}

      {(project?.startDate || project?.endDate) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Timeline: {formatTableDate(project?.startDate)} → {formatTableDate(project?.endDate)}
          </span>
        </div>
      )}

      {availableTabs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-slate-200 bg-transparent px-5 sm:px-6">
              {availableTabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className={tabTriggerClass}>
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {canManageMembers && (
              <TabsContent value="team" className="mt-0 px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Project team</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      People who can view and work on tasks in this project
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setMembersModalOpen(true)}
                  >
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Manage users
                  </Button>
                </div>

                {members.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] px-4 py-8 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2 text-sm font-medium text-foreground">No members yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Invite teammates to collaborate on this project.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-xl"
                      onClick={() => setMembersModalOpen(true)}
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      Invite first member
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex -space-x-2">
                        {memberPreview.map((m) => {
                          const profile = userById.get(m.userId);
                          return (
                            <RfqUserAvatar
                              key={m.userId}
                              name={profile?.name ?? m.userName ?? "Member"}
                              email={profile?.email ?? m.userEmail ?? ""}
                              profilePicture={profile?.profilePicture}
                              size="sm"
                              className="ring-2 ring-card"
                            />
                          );
                        })}
                      </div>
                      {members.length > memberPreview.length && (
                        <span className="text-xs font-medium text-muted-foreground">
                          +{members.length - memberPreview.length} more
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80">
                      {members.map((m) => {
                        const profile = userById.get(m.userId);
                        const isOwner = project?.createdBy === m.userId;
                        const roleLabel =
                          (m.roleLabel ?? "").trim() || (isOwner ? "Owner" : "Member");
                        return (
                          <div
                            key={m.userId}
                            className="flex items-center gap-3 bg-card/50 px-4 py-3 transition-colors hover:bg-muted/30"
                          >
                            <RfqUserAvatar
                              name={profile?.name ?? m.userName ?? "Member"}
                              email={profile?.email ?? m.userEmail ?? ""}
                              profilePicture={profile?.profilePicture}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {profile?.name ?? m.userName ?? "Member"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {profile?.email ?? m.userEmail ?? "—"}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 rounded-lg capitalize",
                                isOwner && "border-primary/25 bg-primary/5 text-primary",
                              )}
                            >
                              {isOwner && <Crown className="mr-1 h-3 w-3" />}
                              {roleLabel}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            )}

            {perms.canManageDeletedTasks && (
              <TabsContent value="deleted" className="mt-0 px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-5">
                  <h3 className="text-base font-semibold text-foreground">Deleted tasks</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review, restore, or permanently remove soft-deleted tasks
                  </p>
                </div>
                <PmsDeletedTasksPanel projectId={projectId} embedded />
              </TabsContent>
            )}

            {perms.canCreateProject && (
              <TabsContent value="danger" className="mt-0 px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-5">
                  <h3 className="text-base font-semibold text-destructive">Danger zone</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Irreversible actions for this project
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Delete project</p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                      Permanently remove this project, its tasks, and member assignments. This
                      cannot be undone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="shrink-0 rounded-xl"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete project
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      <PmsProjectMembersModal
        open={membersModalOpen}
        onOpenChange={setMembersModalOpen}
        projectId={projectId}
        members={members}
        projectOwnerId={project?.createdBy}
        canManage={canManageMembers}
        onMembersChanged={refreshProject}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{project?.title}</strong> and all related tasks will be permanently removed.
              This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
