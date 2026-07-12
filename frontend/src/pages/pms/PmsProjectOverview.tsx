import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PmsProjectDashboardSkeleton } from "@/components/pms/PmsProjectDashboardSkeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  LayoutGrid,
  ListTodo,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PmsMetricCard, type PmsMetricAccent } from "@/components/pms/PmsMetricCard";
import { PmsSectionCard } from "@/components/pms/PmsSectionCard";
import { PmsTaskRow } from "@/components/pms/PmsTaskRow";
import { PmsProjectMembersModal } from "@/components/pms/PmsProjectMembersModal";
import { pmsStatusChartFill } from "@/components/pms/pmsTaskListStyles";
import { pmsApi, formatPmsTaskStatusLabel, type PmsProjectDashboardDto } from "@/lib/pmsApi";
import { useAuth } from "@/contexts/AuthContext";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { formatStatusLabel } from "@/lib/utils";

export default function PmsProjectOverview() {
  const navigate = useNavigate();
  const { openTask } = usePmsTaskModal();
  const { user } = useAuth();
  const { projectId, basePath, project, refreshProject } = usePmsProject();
  const { perms } = usePmsPermissions();
  const { pmsTaskStatuses } = useStatusConfig();
  const [data, setData] = useState<PmsProjectDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!projectId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const dash = await pmsApi.getProjectDashboard(projectId);
      setData(dash);
    } catch (e) {
      if (!opts?.silent) {
        toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Refresh members + KPI counts without unmounting the page or closing the modal. */
  const handleMembersChanged = useCallback(async () => {
    await Promise.all([refreshProject(), load({ silent: true })]);
  }, [refreshProject, load]);

  const statusChartData = useMemo(() => {
    if (!data) return [];
    const order = pmsTaskStatuses.length ? pmsTaskStatuses : Object.keys(data.tasksByStatus);
    const keys = [...new Set([...order, ...Object.keys(data.tasksByStatus)])];
    return keys
      .filter((s) => (data.tasksByStatus[s] ?? 0) > 0)
      .map((status, i) => ({
        status,
        label: formatPmsTaskStatusLabel(status),
        count: data.tasksByStatus[status] ?? 0,
        fill: pmsStatusChartFill(status, i),
      }));
  }, [data, pmsTaskStatuses]);

  const chartConfig = Object.fromEntries(
    statusChartData.map((r) => [r.status, { label: r.label, color: r.fill }]),
  );

  if (loading && !data) return <PmsProjectDashboardSkeleton />;
  if (!data) {
    return <EmptyState title="Dashboard unavailable" description="Try refreshing the page." />;
  }

  const { project: dashProject, kpis } = data;
  const canManageMembers =
    perms.isPmsAdmin ||
    perms.canInviteMember ||
    (data.canInviteMembers ?? (project?.createdBy ?? dashProject.createdBy) === user?.id);

  const metricCards: {
    label: string;
    value: number;
    icon: typeof CheckSquare;
    accent: PmsMetricAccent;
    badge?: string;
  }[] = [
    { label: "Total tasks", value: kpis.totalTasks, icon: CheckSquare, accent: "primary" },
    { label: "Open", value: kpis.openTasks, icon: ClipboardList, accent: "info" },
    { label: "Completed", value: kpis.completedTasks, icon: CheckSquare, accent: "success" },
    { label: "In progress", value: kpis.inProgressTasks, icon: ListTodo, accent: "warning" },
    {
      label: "Overdue",
      value: kpis.overdueTasks,
      icon: AlertTriangle,
      accent: "destructive",
      badge: kpis.overdueTasks > 0 ? "Attention" : undefined,
    },
    { label: "Members", value: kpis.memberCount, icon: Users, accent: "primary" },
    { label: "My tasks", value: kpis.myAssignedTasks, icon: CalendarClock, accent: "accent" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{dashProject.projectCode}</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{dashProject.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-lg">
              {formatStatusLabel(dashProject.status)}
            </Badge>
            <Badge variant="secondary" className="rounded-lg capitalize">
              {dashProject.priority}
            </Badge>
            {dashProject.companyName && (
              <span className="text-sm text-muted-foreground">{dashProject.companyName}</span>
            )}
          </div>
          {(dashProject.startDate || dashProject.endDate) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {dashProject.startDate ?? "—"} → {dashProject.endDate ?? "—"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(`${basePath}/tasks`)}>
            <CheckSquare className="mr-1.5 h-4 w-4" /> Tasks
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(`${basePath}/kanban`)}>
            <LayoutGrid className="mr-1.5 h-4 w-4" /> Kanban
          </Button>
          {canManageMembers && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setMemberDialogOpen(true)}
            >
              <Users className="mr-1.5 h-4 w-4" /> User management
            </Button>
          )}
        </div>
      </div>

      {dashProject.description && (
        <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          {dashProject.description}
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {metricCards.map((k) => (
          <PmsMetricCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            accent={k.accent}
            badge={k.badge}
          />
        ))}
      </div>

      <PmsProjectMembersModal
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        projectId={projectId}
        members={project?.members ?? []}
        projectOwnerId={project?.createdBy ?? dashProject.createdBy}
        canManage={canManageMembers}
        onMembersChanged={handleMembersChanged}
      />

      <PmsSectionCard title="Tasks by status" description="Breakdown for this project">
        {statusChartData.length === 0 ? (
          <EmptyState title="No tasks yet" description="Create tasks to see status analytics." />
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={52}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {statusChartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </PmsSectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <PmsSectionCard title="Overdue" description="Past due and still open">
          {data.overdueTasks.length === 0 ? (
            <EmptyState title="No overdue tasks" />
          ) : (
            <div className="space-y-2">
              {data.overdueTasks.map((t) => (
                <PmsTaskRow
                  key={t.id}
                  task={t}
                  onClick={() => openTask(t.id)}
                />
              ))}
            </div>
          )}
        </PmsSectionCard>

        <PmsSectionCard title="Upcoming" description="Due dates ahead">
          {data.upcomingTasks.length === 0 ? (
            <EmptyState title="Nothing upcoming" />
          ) : (
            <div className="space-y-2">
              {data.upcomingTasks.map((t) => (
                <PmsTaskRow
                  key={t.id}
                  task={t}
                  onClick={() => openTask(t.id)}
                />
              ))}
            </div>
          )}
        </PmsSectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PmsSectionCard title="Recently updated">
          {data.recentTasks.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <div className="space-y-2">
              {data.recentTasks.map((t) => (
                <PmsTaskRow
                  key={t.id}
                  task={t}
                  onClick={() => openTask(t.id)}
                />
              ))}
            </div>
          )}
        </PmsSectionCard>

        <PmsSectionCard title="My tasks" description="Assigned to you in this project">
          {data.myTasks.length === 0 ? (
            <EmptyState title="No assigned tasks" />
          ) : (
            <div className="space-y-2">
              {data.myTasks.map((t) => (
                <PmsTaskRow
                  key={t.id}
                  task={t}
                  onClick={() => openTask(t.id)}
                />
              ))}
            </div>
          )}
        </PmsSectionCard>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="rounded-lg gap-1" onClick={() => navigate(`${basePath}/tasks`)}>
          View all tasks <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
