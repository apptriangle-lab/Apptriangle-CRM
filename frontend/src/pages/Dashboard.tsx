import { useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { mockCompanies, mockContacts, mockUsers, getCompanyName, getUserName } from "@/data/mockData";
import { Building2, Users, CheckSquare, DollarSign, CalendarClock, TrendingUp, Flame, Thermometer, Snowflake, ArrowRight, Target, AlertTriangle, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { formatStatusLabel } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  lead: "hsl(199, 89%, 48%)",
  prospect: "hsl(168, 76%, 42%)",
  negotiation: "hsl(38, 92%, 50%)",
  closed: "hsl(142, 71%, 45%)",
  disqualified: "hsl(0, 72%, 51%)",
};

const CATEGORY_COLORS: Record<string, string> = {
  hot: "hsl(0, 72%, 51%)",
  warm: "hsl(38, 92%, 50%)",
  cold: "hsl(199, 89%, 48%)",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "hsl(220, 10%, 46%)",
  in_progress: "hsl(199, 89%, 48%)",
  completed: "hsl(142, 71%, 45%)",
  cancelled: "hsl(0, 72%, 51%)",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { tasks, fetchTasks } = useTaskStore();
  const { sales, fetchSales } = useSalesStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchTasks({ assignToUserId: user.id }).catch(() => { });
  }, [user?.id, fetchTasks]);

  useEffect(() => {
    fetchSales().catch(() => { });
  }, [fetchSales]);

  const now = startOfDay(new Date());

  const tasksDueToday = useMemo(() => tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && isToday(new Date(t.dueDatetime))), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && isBefore(new Date(t.dueDatetime), now)), [tasks, now]);
  const tasksByStatus = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status: status.replace("_", " "), count, fill: TASK_STATUS_COLORS[status] }));
  }, [tasks]);

  const salesByStatus = useMemo(() => {
    const counts: Record<string, number> = { lead: 0, prospect: 0, negotiation: 0, closed: 0, disqualified: 0 };
    sales.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count, fill: STATUS_COLORS[status] }));
  }, [sales]);

  const salesByCategory = useMemo(() => {
    const counts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    sales.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return Object.entries(counts).map(([cat, count]) => ({ category: cat, count, fill: CATEGORY_COLORS[cat] }));
  }, [sales]);

  const revenueByStatus = useMemo(() => {
    const sums: Record<string, number> = {};
    sales.forEach(s => { sums[s.status] = (sums[s.status] || 0) + s.expectedRevenue; });
    return Object.entries(sums).map(([status, revenue]) => ({ status, revenue, fill: STATUS_COLORS[status] }));
  }, [sales]);

  const tasksDueSoon = useMemo(() =>
    [...tasks]
      .filter(t => t.status !== "completed" && t.status !== "cancelled")
      .sort((a, b) => new Date(a.dueDatetime).getTime() - new Date(b.dueDatetime).getTime())
      .slice(0, 5),
    [tasks]
  );

  const recentLogs = useMemo(() => [], []);

  const kpis = [
    { label: "Companies", value: mockCompanies.length, icon: Building2, color: "text-blue-600", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
    { label: "Contacts", value: mockContacts.length, icon: Users, color: "text-purple-600", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" },
    { label: "Total Tasks", value: tasks.length, icon: CheckSquare, color: "text-emerald-600", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
    { label: "Due Today", value: tasksDueToday.length, icon: CalendarClock, color: "text-amber-600", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" },
    { label: "Overdue", value: overdueTasks.length, icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" },
    { label: "Total Sales", value: sales.length, icon: DollarSign, color: "text-green-600", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" },
  ];

  const chartConfigStatus = Object.fromEntries(salesByStatus.map(s => [s.status, { label: formatStatusLabel(s.status), color: s.fill }]));
  const chartConfigCategory = Object.fromEntries(salesByCategory.map(c => [c.category, { label: formatStatusLabel(c.category), color: c.fill }]));
  const chartConfigRevenue = Object.fromEntries(revenueByStatus.map(r => [r.status, { label: formatStatusLabel(r.status), color: r.fill }]));
  const chartConfigTask = Object.fromEntries(tasksByStatus.map(t => [t.status, { label: t.status, color: t.fill }]));

  return (
    <Layout>
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{k.label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${k.bgColor} border ${k.borderColor} flex items-center justify-center`}>
              <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Task breakdown + Sales by Status */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              </div>
              Tasks by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigTask} className="h-[250px] w-full">
              <BarChart data={tasksByStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="status" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {tasksByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
              Sales by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigStatus} className="h-[250px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={salesByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, count }) => `${status}: ${count}`}>
                  {salesByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Category + Revenue */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Flame className="h-4 w-4 text-purple-600" />
              </div>
              Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigCategory} className="h-[250px] w-full">
              <BarChart data={salesByCategory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {salesByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              Expected Revenue by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigRevenue} className="h-[250px] w-full">
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="status" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `$${Number(value).toLocaleString()}`} />} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {revenueByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* List Widgets */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <CalendarClock className="h-4 w-4 text-amber-600" />
              </div>
              Tasks Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksDueSoon.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No upcoming tasks</p>
              </div>
            )}
            {tasksDueSoon.map((t) => {
              const overdue = isBefore(new Date(t.dueDatetime), now);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 cursor-pointer rounded-lg p-3 hover:bg-muted/50 transition-all border border-transparent hover:border-border group"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{getCompanyName(t.companyId)} · {getUserName(t.assignToUserId)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {overdue && <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Overdue</Badge>}
                    <span className="text-xs text-muted-foreground font-medium">{format(new Date(t.dueDatetime), "MMM d")}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
              Recent Sales Status Changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentLogs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No recent changes</p>
              </div>
            )}
            {recentLogs.map((log) => {
              const sale = sales.find(s => s.id === log.salesId);
              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 cursor-pointer rounded-lg p-3 hover:bg-muted/50 transition-all border border-transparent hover:border-border group"
                  onClick={() => sale && navigate(`/sales/${sale.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{sale?.prospect ?? "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">{log.fromStatus}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">{log.toStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 truncate">{log.note}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 font-medium">
                    {format(new Date(log.changedAt), "MMM d")}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
