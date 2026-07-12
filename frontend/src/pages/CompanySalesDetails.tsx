import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useSalesStore } from "@/contexts/SalesStoreContext";
import { useTaskStore } from "@/contexts/TaskStoreContext";
import { companiesApi, salesApi, usersApi } from "@/lib/api";
import { formatStatusLabel, formatTableDate } from "@/lib/utils";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Clock,
  CheckSquare,
  AlertTriangle,
  MapPin,
  Globe,
  UserCheck,
  TrendingUp,
  CalendarDays,
  Tag,
} from "lucide-react";

const statusColors: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  prospect: "bg-info/10 text-info",
  negotiation: "bg-warning/10 text-warning",
  closed: "bg-success/10 text-success",
  disqualified: "bg-destructive/10 text-destructive",
};

const categoryColors: Record<string, string> = {
  hot: "bg-destructive/10 text-destructive border-destructive/20",
  warm: "bg-warning/10 text-warning border-warning/20",
  cold: "bg-info/10 text-info border-info/20",
};

const taskStatusColors: Record<string, string> = {
  completed: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

// Task statuses now come from context

interface CompanyType { id: string; name: string; location: string; country: string; kamUserId: string }
interface SaleType { id: string; companyId: string; category: string; prospect: string; expectedClosingDate: string; expectedRevenue: number; status: string }
interface LogType { id: string; salesId: string; fromStatus: string; toStatus: string; note: string; changedByUserId: string; changedAt: string }

export default function CompanySalesDetails() {
  const { companyId, saleId } = useParams<{ companyId: string; saleId: string }>();
  const navigate = useNavigate();
  const { fetchSales } = useSalesStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { taskStatuses } = useStatusConfig();

  const [company, setCompany] = useState<CompanyType | null>(null);
  const [sale, setSale] = useState<SaleType | null>(null);
  const [logs, setLogs] = useState<LogType[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTaskStatus, setFilterTaskStatus] = useState("all");
  const [filterAssignTo, setFilterAssignTo] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const now = new Date();

  useEffect(() => {
    if (!companyId || !saleId) return;
    setLoading(true);
    Promise.all([
      companiesApi.get(companyId),
      salesApi.get(saleId),
      salesApi.logs(saleId),
      usersApi.list(),
    ])
      .then(([companyRes, saleRes, logsRes, usersRes]) => {
        setCompany({
          id: companyRes.id,
          name: companyRes.name,
          location: companyRes.location ?? "",
          country: companyRes.country ?? "",
          kamUserId: companyRes.kamUserId ?? "",
        });
        setSale({
          id: saleRes.id,
          companyId: saleRes.companyId,
          category: saleRes.category,
          prospect: saleRes.prospect,
          expectedClosingDate: saleRes.expectedClosingDate?.split?.("T")[0] ?? saleRes.expectedClosingDate ?? "",
          expectedRevenue: typeof saleRes.expectedRevenue === "number" ? saleRes.expectedRevenue : parseFloat(String(saleRes.expectedRevenue)) || 0,
          status: saleRes.status,
        });
        setLogs(logsRes);
        setUsers(usersRes.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name })));
        fetchTasks({ companyId });
        fetchSales({ companyId });
      })
      .catch(() => {
        setCompany(null);
        setSale(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, saleId, fetchTasks, fetchSales]);

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "—";

  const companyTasks = useMemo(() => {
    if (!company) return [];
    return tasks.filter(t => {
      if (t.companyId !== company.id) return false;
      if (filterTaskStatus !== "all" && t.status !== filterTaskStatus) return false;
      if (filterAssignTo !== "all" && t.assignToUserId !== filterAssignTo) return false;
      if (overdueOnly) {
        const due = new Date(t.dueDatetime);
        if (due >= now || t.status === "completed" || t.status === "cancelled") return false;
      }
      return true;
    });
  }, [tasks, company?.id, filterTaskStatus, filterAssignTo, overdueOnly, now]);

  const activeUsers = users;
  const isOverdue = (dueDatetime: string, status: string) =>
    new Date(dueDatetime) < now && status !== "completed" && status !== "cancelled";

  if (loading) {
    return (
      <Layout>
        <Loader message="Loading…" size="lg" className="py-16" />
      </Layout>
    );
  }

  if (!company || !sale || sale.companyId !== company.id) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-2">Record not found</h2>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="page-title">{company.name} — Sales Dashboard</h1>
            <p className="text-sm text-muted-foreground">{sale.prospect}</p>
          </div>
        </div>
      </div>

      {/* A) Company Info + B) Sales Summary — side by side */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* A) Company Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Company Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Name</span>
                  <span className="font-medium">{company.name}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Location</span>
                  <span className="font-medium">{company.location}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Country</span>
                  <span className="font-medium">{company.country}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">KAM</span>
                  <span className="font-medium">{getUserName(company.kamUserId)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B) Sales Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Sales Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Category</span>
                  <Badge variant="outline" className={categoryColors[sale.category]}>{formatStatusLabel(sale.category)}</Badge>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Status</span>
                  <Badge variant="outline" className={statusColors[sale.status]}>{formatStatusLabel(sale.status)}</Badge>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Expected Revenue</span>
                  <span className="font-semibold text-lg">${sale.expectedRevenue.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Expected Closing</span>
                  <span className="font-medium">{sale.expectedClosingDate}</span>
                </div>
              </div>
              <div className="col-span-2 flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground block text-xs">Prospect</span>
                  <span className="font-medium">{sale.prospect}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* C) Status Change Timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Status Change Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No status changes recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Date / Time</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead></TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatTableDate(log.changedAt)}
                      </TableCell>
                      <TableCell className="font-medium">{getUserName(log.changedByUserId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusColors[log.fromStatus]}`}>{log.fromStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center">→</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusColors[log.toStatus]}`}>{log.toStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={log.note}>{log.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* D) Related Tasks */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" /> Related Tasks
            </CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filterTaskStatus} onValueChange={setFilterTaskStatus}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {taskStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAssignTo} onValueChange={setFilterAssignTo}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Assigned To" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {activeUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} id="overdue-tasks" className="scale-90" />
                <Label htmlFor="overdue-tasks" className="text-xs cursor-pointer">Overdue</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {companyTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tasks found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Assigned To</TableHead>
                    <TableHead className="hidden md:table-cell">Assigned By</TableHead>
                    <TableHead className="hidden lg:table-cell">Due</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyTasks.map(t => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tasks/${t.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.title}</span>
                          {isOverdue(t.dueDatetime, t.status) && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${taskStatusColors[t.status] || "bg-muted text-muted-foreground"}`}>{t.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{getUserName(t.assignToUserId)}</TableCell>
                      <TableCell className="hidden md:table-cell">{getUserName(t.assignByUserId)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className={isOverdue(t.dueDatetime, t.status) ? "text-destructive font-medium" : ""}>
                          {new Date(t.dueDatetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={e => { e.stopPropagation(); navigate(`/tasks/${t.id}`); }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
