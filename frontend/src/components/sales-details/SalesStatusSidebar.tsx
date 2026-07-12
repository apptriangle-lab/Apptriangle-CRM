import type { Sale, SalesStatusLog } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History } from "lucide-react";
import { formatStatusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { statusBadgeClass } from "./constants";

export type SalesStatusSidebarProps = {
  sale: Sale;
  logs: SalesStatusLog[];
  getUserName: (userId: string) => string;
  statusColors: Record<string, string>;
  salesStatuses: string[];
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
  newStatus: string;
  setNewStatus: (v: string) => void;
  statusNote: string;
  setStatusNote: (v: string) => void;
  statusSaving: boolean;
  onStatusSave: () => void;
  openStatusChange: () => void;
  isLockedClosedWon: boolean;
};

export function SalesStatusSidebar({
  sale,
  logs,
  getUserName,
  statusColors,
  salesStatuses,
  statusOpen,
  setStatusOpen,
  newStatus,
  setNewStatus,
  statusNote,
  setStatusNote,
  statusSaving,
  onStatusSave,
  openStatusChange,
  isLockedClosedWon,
}: SalesStatusSidebarProps) {
  return (
    <aside className="flex flex-col h-full min-h-0 w-full">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-sm shadow-slate-200/30 ring-1 ring-slate-950/[0.04] sm:p-4 dark:bg-card dark:shadow-none dark:ring-white/10">
        <section aria-labelledby="pipeline-stage-heading" className="shrink-0">
          <p id="pipeline-stage-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline stage
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-lg px-2.5 py-1 text-sm", statusBadgeClass(sale.status))}>
              {formatStatusLabel(sale.status)}
            </Badge>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg text-xs font-semibold"
              onClick={openStatusChange}
              disabled={isLockedClosedWon}
            >
              Update
            </Button>
          </div>
          {isLockedClosedWon && (
            <p className="mt-2 text-xs text-muted-foreground">Closed Won is final — status cannot be changed.</p>
          )}

          <div
            className={cn(
              "grid transition-all duration-300 ease-in-out",
              statusOpen ? "mt-5 grid-rows-[1fr] opacity-100 visible" : "mt-0 grid-rows-[0fr] opacity-0 invisible"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-500/10 dark:bg-indigo-500/5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-900/70 dark:text-indigo-200/70">New Pipeline Stage</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="h-9 rounded-xl border-indigo-200/50 bg-white text-sm font-medium shadow-sm transition-colors hover:border-indigo-300 dark:border-indigo-500/20 dark:bg-slate-950 dark:hover:border-indigo-500/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      {salesStatuses.map((s) => (
                        <SelectItem key={s} value={s} className="cursor-pointer font-medium">
                          {formatStatusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-indigo-900/70 dark:text-indigo-200/70">Update Note</Label>
                  <Textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    className="min-h-[72px] rounded-xl border-indigo-200/50 bg-white text-sm shadow-sm transition-colors hover:border-indigo-300 focus-visible:ring-indigo-500 dark:border-indigo-500/20 dark:bg-slate-950 dark:hover:border-indigo-500/40"
                    placeholder="Add context for this stage change..."
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button 
                    type="button" 
                    size="sm" 
                    className="flex-1 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500" 
                    onClick={onStatusSave} 
                    disabled={statusSaving}
                  >
                    {statusSaving ? "Updating…" : "Update"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl border-indigo-200/50 bg-white text-foreground hover:bg-white hover:text-foreground dark:border-indigo-500/20 dark:bg-slate-950 dark:hover:bg-slate-950 dark:hover:text-foreground"
                    onClick={() => setStatusOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 min-h-0 flex flex-col mt-5 border-t border-border/80 pt-5 overflow-hidden" aria-labelledby="status-history-heading">
          <div className="shrink-0 flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p id="status-history-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status history
            </p>
          </div>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No status changes yet.</p>
          ) : (
            <div className="flex-1 min-h-0 relative mt-3 overflow-y-auto scrollbar-thin pr-1">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
              <ul className="space-y-4">
                {logs.map((log) => (
                  <li key={log.id} className="relative pl-8">
                    <span className="absolute left-1 top-1.5 z-[1] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-sm" />
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 dark:bg-muted/10">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold text-foreground">{getUserName(log.changedByUserId)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.changedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px] font-medium", statusColors[log.fromStatus] ?? "")}>
                          {formatStatusLabel(log.fromStatus)}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", statusColors[log.toStatus] ?? "")}>
                          {formatStatusLabel(log.toStatus)}
                        </Badge>
                      </div>
                      {log.note ? (
                        <p className="mt-2 text-xs italic leading-snug text-muted-foreground">&ldquo;{log.note}&rdquo;</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
