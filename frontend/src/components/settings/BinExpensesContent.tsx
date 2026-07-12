import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { expensesApi, companiesApi, usersApi } from "@/lib/api";
import type { ExpenseDto } from "@/lib/api";
import { cn, formatTableDate } from "@/lib/utils";
import { format, parseISO } from "date-fns";

function displayAmount(exp: ExpenseDto): number {
  if (exp.tripType === "round_trip" && exp.amountReturn != null) {
    return exp.amount + exp.amountReturn;
  }
  return exp.amount;
}

export function BinExpensesContent() {
  const [rows, setRows] = useState<ExpenseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [restoringBulk, setRestoringBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [binList, companies, users] = await Promise.all([
        expensesApi.listBin(),
        companiesApi.list(),
        usersApi.list(),
      ]);
      setRows(binList);
      setSelectedIds([]);
      setCompanyNames(
        Object.fromEntries(companies.map((c) => [c.id, c.name])),
      );
      setUserNames(
        Object.fromEntries(users.map((u) => [u.id, u.name])),
      );
    } catch {
      toast.error("Failed to load deleted expenses");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSelect = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllRows = (e: MouseEvent) => {
    e.stopPropagation();
    const ids = rows.map((r) => r.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const r = await expensesApi.restore([id]);
      if (r.count < 1) {
        toast.error("Could not restore this expense");
        return;
      }
      toast.success("Expense restored");
      setRows((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch {
      toast.error("Failed to restore expense");
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreSelected = async () => {
    const ids = selectedIds.filter((id) => rows.some((e) => e.id === id));
    if (ids.length === 0) {
      setSelectedIds([]);
      return;
    }
    setRestoringBulk(true);
    try {
      const r = await expensesApi.restore(ids);
      if (r.count < 1) {
        toast.error("Could not restore selected expenses");
        return;
      }
      const restored = new Set(r.restoredIds ?? []);
      setRows((prev) => prev.filter((e) => !restored.has(e.id)));
      setSelectedIds([]);
      toast.success(
        r.count === 1 ? "1 expense restored" : `${r.count} expenses restored`,
      );
      if (r.count < ids.length) {
        toast.warning(
          `${ids.length - r.count} expense(s) could not be restored`,
        );
      }
    } catch {
      toast.error("Failed to restore expenses");
    } finally {
      setRestoringBulk(false);
    }
  };

  const formatDeletedAt = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      return format(parseISO(iso), "MMM d, yyyy · HH:mm");
    } catch {
      return formatTableDate(iso);
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Deleted expenses
        </CardTitle>
        <CardDescription>
          Expenses removed from the Expenses page are kept here. Select rows
          and use the Restore selected action, or restore one row from the Actions
          column.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader message="Loading bin…" className="py-12" />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20">
            <EmptyState
              icon={Trash2}
              title="No deleted expenses"
              description="When you delete expenses from the Expenses page, they will appear here."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {selectedIds.length > 0 && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/50",
                )}
              >
                <span className="text-sm font-medium">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handleRestoreSelected()}
                  disabled={restoringBulk || restoringId !== null}
                >
                  <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                  {restoringBulk ? "Restoring…" : "Restore selected"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  disabled={restoringBulk || restoringId !== null}
                >
                  Clear selection
                </Button>
              </div>
            )}
            <div className="rounded-lg border bg-card">
            <Table maxHeight="min(62vh, 520px)">
              <TableHeader className="[&_tr]:border-b-0 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted/95 [&_th]:backdrop-blur-sm [&_th]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 font-semibold">
                    <Checkbox
                      checked={
                        rows.length > 0 &&
                        rows.every((r) => selectedIds.includes(r.id))
                      }
                      onCheckedChange={() => {}}
                      onClick={selectAllRows}
                      aria-label="Select all"
                      disabled={restoringBulk || restoringId !== null}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Company</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Purpose</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">
                    Created by
                  </TableHead>
                  <TableHead className="font-semibold w-[190px]">Deleted</TableHead>
                  <TableHead className="font-semibold text-right w-[120px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell
                      className="w-10"
                      onClick={(e) => toggleSelect(exp.id, e)}
                    >
                      <Checkbox
                        checked={selectedIds.includes(exp.id)}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleSelect(exp.id, e)}
                        aria-label="Select row"
                        disabled={restoringBulk || restoringId !== null}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {companyNames[exp.companyId] ?? "—"}
                    </TableCell>
                    <TableCell>{formatTableDate(exp.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {displayAmount(exp).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {exp.purposeName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          exp.status === "paid"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      >
                        {exp.status === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {userNames[exp.createdByUserId] ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDeletedAt(exp.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={restoringBulk || restoringId !== null}
                        onClick={() => void handleRestore(exp.id)}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                        {restoringId === exp.id ? "…" : "Restore"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
