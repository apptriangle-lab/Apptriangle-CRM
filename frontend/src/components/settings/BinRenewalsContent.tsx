import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { companiesApi, renewalsApi, usersApi } from "@/lib/api";
import type { RenewalDto } from "@/lib/api";
import { formatTableDate } from "@/lib/utils";

export function BinRenewalsContent() {
  const [rows, setRows] = useState<RenewalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [binList, companies, users] = await Promise.all([
        renewalsApi.listBin(),
        companiesApi.list(),
        usersApi.list(),
      ]);
      setRows(binList);
      setCompanyNames(Object.fromEntries(companies.map((c) => [c.id, c.name])));
      setUserNames(Object.fromEntries(users.map((u) => [u.id, u.name])));
    } catch {
      toast.error("Failed to load deleted renewals");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const r = await renewalsApi.restore([id]);
      if (r.count < 1) {
        toast.error("Could not restore this renewal");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      toast.success("Renewal restored");
    } catch {
      toast.error("Failed to restore renewal");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Deleted renewals</CardTitle>
        <CardDescription>
          Renewals removed from the Sales Renewal tab appear here and can be restored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader message="Loading bin…" className="py-12" />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20">
            <EmptyState
              icon={Trash2}
              title="No deleted renewals"
              description="When you delete renewals from Sales, they will appear here."
            />
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table maxHeight="min(62vh, 520px)">
              <TableHeader className="[&_tr]:border-b-0 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted/95 [&_th]:backdrop-blur-sm [&_th]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Company</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">KAM</TableHead>
                  <TableHead className="font-semibold">Renewal Date</TableHead>
                  <TableHead className="font-semibold">Deleted</TableHead>
                  <TableHead className="font-semibold text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{companyNames[row.companyId] ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={row.productDetails}>{row.productDetails}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{userNames[row.kamUserId] ?? "—"}</TableCell>
                    <TableCell>{formatTableDate(row.renewalDate)}</TableCell>
                    <TableCell>{formatTableDate(row.deletedAt || "")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoringId !== null}
                        onClick={() => void handleRestore(row.id)}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                        {restoringId === row.id ? "…" : "Restore"}
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
  );
}
