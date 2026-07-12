import type { Sale, SalesActivity } from "@/data/mockData";
import type { Task } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, CalendarDays, FileText, ListTodo, Pencil, Plus, ShoppingBag, Trash2, User } from "lucide-react";
import type { RfqSummaryDto } from "@/lib/api";
import { RfqReopenedChip, RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { formatStatusLabel, formatTableDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { categoryBadgeClass } from "./constants";

const tabListClass =
  "inline-flex h-auto w-full justify-start flex-wrap gap-1 rounded-2xl border border-border/80 bg-muted/40 p-1.5 shadow-inner shadow-slate-200/20 dark:bg-muted/25 dark:shadow-none";
const tabTriggerClass =
  "rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-4 sm:text-sm";

export type SalesDetailsTabsProps = {
  activities: SalesActivity[];
  companyTasks: Task[];
  companySales: Sale[];
  companyId: string;
  /** RFQs whose `salesId` matches this deal (loaded on the parent when user can access RFQ). */
  dealRfqs: RfqSummaryDto[];
  canAccessRfq: boolean;
  /** Current sale id — used to prefill New RFQ from this deal. */
  saleId: string;
  getCompanyName: (companyId: string) => string;
  formatRevenueWithCurrency: (companyId: string, amount: number) => string;
  getKamNameByCompany: (companyId: string) => string;
  getUserName: (userId: string) => string;
  navigate: (path: string) => void;
  statusColors: Record<string, string>;
  activityDialogOpen: boolean;
  setActivityDialogOpen: (v: boolean) => void;
  activityForm: { title: string; note: string; date: string };
  setActivityForm: Dispatch<SetStateAction<{ title: string; note: string; date: string }>>;
  activityErrors: Record<string, string>;
  activitySaving: boolean;
  editingActivity: string | null;
  resetActivityForm: () => void;
  handleAddActivity: () => void;
  openEditActivity: (id: string) => void;
  handleDeleteActivity: (id: string) => void;
};

export function SalesDetailsTabs({
  activities,
  companyTasks,
  companySales,
  dealRfqs,
  canAccessRfq,
  saleId,
  getCompanyName,
  formatRevenueWithCurrency,
  getKamNameByCompany,
  getUserName,
  navigate,
  statusColors,
  activityDialogOpen,
  setActivityDialogOpen,
  activityForm,
  setActivityForm,
  activityErrors,
  activitySaving,
  editingActivity,
  resetActivityForm,
  handleAddActivity,
  openEditActivity,
  handleDeleteActivity,
  companyId,
}: SalesDetailsTabsProps) {
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-border/80 bg-card shadow-sm ring-1 ring-slate-950/[0.04] dark:ring-white/10">
      <Tabs defaultValue="tasks" className="flex flex-col h-full min-h-0 w-full gap-0">
        <div className="shrink-0 border-b border-border/80 bg-muted/20 px-3 py-3 sm:px-4">
          <TabsList className={tabListClass}>
            <TabsTrigger value="tasks" className={tabTriggerClass}>
              <ListTodo className="mr-1.5 hidden h-4 w-4 sm:inline" />
              Tasks
              <span className="ml-1.5 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {companyTasks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="deals" className={tabTriggerClass}>
              <ShoppingBag className="mr-1.5 hidden h-4 w-4 sm:inline" />
              Deals
              <span className="ml-1.5 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {companySales.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="activity" className={tabTriggerClass}>
              <Activity className="mr-1.5 hidden h-4 w-4 sm:inline" />
              Activity
              <span className="ml-1.5 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {activities.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="rfq" className={tabTriggerClass}>
              <FileText className="mr-1.5 hidden h-4 w-4 sm:inline" />
              RFQ
              <span className="ml-1.5 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {dealRfqs.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* This wrapper inherits flex-1 and sets overflow-y-auto to allow internal scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 py-3 sm:px-4 sm:py-4">
          <TabsContent value="tasks" className="mt-0 animate-in fade-in-50 duration-200">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {companyTasks.length} {companyTasks.length === 1 ? "task" : "tasks"} for this company.
              </p>
              <Button size="sm" className="rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500" onClick={() => setTaskModalOpen(true)}>
                <ListTodo className="mr-2 h-4 w-4" />
                Create task
              </Button>
            </div>
            <TaskFormModal
              open={taskModalOpen}
              onOpenChange={setTaskModalOpen}
              defaultCompanyId={companyId}
            />
            {companyTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
                <ListTodo className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No tasks for this company</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a task to coordinate follow-ups.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Assigned To</TableHead>
                      <TableHead className="hidden md:table-cell">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyTasks.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/tasks/${t.id}`)}
                      >
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("rounded-md text-xs", statusColors[t.status] ?? "")}>
                            {t.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{getUserName(t.assignToUserId)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatTableDate(t.dueDatetime)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals" className="mt-0 animate-in fade-in-50 duration-200">
            {companySales.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">No other deals for this company</p>
                <p className="mt-1 text-sm text-muted-foreground">Other opportunities on this account will show here.</p>
              </div>
            ) : (
              <div className="data-table overflow-x-auto rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Company ({companySales.length})</TableHead>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Closing Date</TableHead>
                      <TableHead className="hidden md:table-cell">Closing In</TableHead>
                      <TableHead className="hidden lg:table-cell">KAM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companySales.map((s) => {
                      const closeDate = new Date(s.expectedClosingDate);
                      const now = new Date();
                      const diffDays = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const isClosed = s.status === "closed" || s.status === "disqualified";
                      return (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate(`/sales/${s.id}`)}
                        >
                          <TableCell className="font-medium">{getCompanyName(s.companyId)}</TableCell>
                          <TableCell>{s.prospect}</TableCell>
                          <TableCell className="tabular-nums">
                            {formatRevenueWithCurrency(s.companyId, s.expectedRevenue)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("rounded-md text-xs", statusColors[s.status] ?? "")}>
                              {formatStatusLabel(s.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className={cn("rounded-md text-xs", categoryBadgeClass(s.category))}>
                              {formatStatusLabel(s.category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatTableDate(s.expectedClosingDate)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {isClosed ? (
                              <span className="text-muted-foreground">—</span>
                            ) : diffDays < 0 ? (
                              <span className="font-medium text-destructive">{Math.abs(diffDays)}d</span>
                            ) : diffDays === 0 ? (
                              <span className="font-medium text-warning">Today</span>
                            ) : (
                              <span>{diffDays}d</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{getKamNameByCompany(s.companyId)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0 animate-in fade-in-50 duration-200">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {activities.length} {activities.length === 1 ? "activity" : "activities"} logged for this deal.
              </p>
              <Dialog
                open={activityDialogOpen}
                onOpenChange={(v) => {
                  setActivityDialogOpen(v);
                  if (!v) resetActivityForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl bg-indigo-600 hover:bg-indigo-500">
                    <Plus className="mr-2 h-4 w-4" />
                    Add activity
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingActivity ? "Edit activity" : "New activity"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Title *</Label>
                      <Input
                        value={activityForm.title}
                        onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                        placeholder="Activity title"
                        className="rounded-xl"
                      />
                      {activityErrors.title && <p className="text-sm text-destructive">{activityErrors.title}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>Note *</Label>
                      <Textarea
                        value={activityForm.note}
                        onChange={(e) => setActivityForm({ ...activityForm, note: e.target.value })}
                        placeholder="Details…"
                        className="min-h-[88px] rounded-xl"
                      />
                      {activityErrors.note && <p className="text-sm text-destructive">{activityErrors.note}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={activityForm.date}
                        onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                        className="rounded-xl"
                      />
                      {activityErrors.date && <p className="text-sm text-destructive">{activityErrors.date}</p>}
                    </div>
                    <Button onClick={handleAddActivity} disabled={activitySaving} className="w-full rounded-xl">
                      {activitySaving ? "Saving…" : editingActivity ? "Update activity" : "Add activity"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
                <Activity className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">No activities yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add one to track progress on this deal.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />
                <div className="space-y-0">
                  {activities.map((act) => (
                    <div key={act.id} className="group relative pb-6 pl-12 last:pb-0">
                      <div className="absolute left-3 top-2 h-3 w-3 rounded-full border-2 border-background bg-indigo-500 shadow ring-4 ring-indigo-500/15" />
                      <div className="rounded-2xl border border-border/80 bg-muted/10 p-4 transition-colors hover:bg-muted/20 dark:hover:bg-muted/15">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-foreground">{act.title}</h4>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{act.note}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border/80">
                                <CalendarDays className="h-3 w-3" />
                                {act.date}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border/80">
                                <User className="h-3 w-3" />
                                {getUserName(act.createdByUserId)}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEditActivity(act.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDeleteActivity(act.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rfq" className="mt-0 animate-in fade-in-50 duration-200">
            {!canAccessRfq ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">RFQ module not available</p>
                <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have access to RFQ. Ask an administrator if you need it.</p>
              </div>
            ) : dealRfqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">No RFQs for this deal</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a quote request linked to this opportunity.</p>
                <Button
                  size="sm"
                  className="mt-4 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500"
                  onClick={() => navigate(`/rfq/new?salesId=${encodeURIComponent(saleId)}`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New RFQ
                </Button>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {dealRfqs.length} {dealRfqs.length === 1 ? "RFQ" : "RFQs"} for this deal.
                </p>
                <div className="data-table overflow-x-auto rounded-xl border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Deal ({dealRfqs.length})</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="min-w-[140px]">Requested by</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealRfqs.map((r) => (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate(`/rfq/${r.id}`)}
                        >
                          <TableCell className="font-medium">{r.deal?.prospect ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{r.customer?.name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <span className="text-foreground">
                              {r.createdBy?.name?.trim() || r.createdBy?.email || "—"}
                            </span>
                            {r.createdBy?.name?.trim() && r.createdBy?.email ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">{r.createdBy.email}</span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <RfqStatusBadge status={r.status} />
                              {(r.versionNumber ?? 1) > 1 ? <RfqReopenedChip /> : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {formatTableDate(r.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
