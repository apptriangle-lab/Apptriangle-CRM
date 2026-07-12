import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArchiveRestore, KeyRound } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { credentialsApi, type CredentialBinRowDto } from "@/lib/api";
import { useRbac } from "@/contexts/RbacContext";
import { formatTableDate } from "@/lib/utils";

export function BinCredentialsContent() {
  const { isPageScopeAdmin } = useRbac();
  const credAdmin = isPageScopeAdmin("credentials");

  const [rows, setRows] = useState<CredentialBinRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!credAdmin) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await credentialsApi.listBin();
      setRows(list);
    } catch {
      toast.error("Failed to load deleted credentials");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [credAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const r = await credentialsApi.restore([id]);
      if (r.count < 1) {
        toast.error("Could not restore this credential");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      toast.success("Credential restored");
    } catch {
      toast.error("Failed to restore credential");
    } finally {
      setRestoringId(null);
    }
  };

  if (!credAdmin) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Deleted credentials</CardTitle>
          <CardDescription>
            Only users with <span className="font-medium text-foreground">Credentials</span> admin scope can
            view and restore items from the vault recycle bin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Deleted credentials</CardTitle>
        <CardDescription>
          Items removed from the Credentials vault are listed here. Restoring puts them back for the owner and
          active shares.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader message="Loading bin…" className="py-12" />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20">
            <EmptyState
              icon={KeyRound}
              title="No deleted credentials"
              description="When you delete credentials from the vault, they appear here until restored."
            />
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table maxHeight="min(62vh, 520px)">
              <TableHeader className="[&_tr]:border-b-0 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted/95 [&_th]:backdrop-blur-sm [&_th]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Owner</TableHead>
                  <TableHead className="font-semibold">Owner email</TableHead>
                  <TableHead className="font-semibold">Deleted</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px] font-medium">
                      <span className="line-clamp-2" title={row.title}>
                        {row.title}
                      </span>
                    </TableCell>
                    <TableCell>{row.ownerName?.trim() ? row.ownerName : "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground" title={row.ownerEmail}>
                      {row.ownerEmail?.trim() ? row.ownerEmail : "—"}
                    </TableCell>
                    <TableCell>{formatTableDate(row.deletedAt || "")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoringId !== null}
                        onClick={() => void handleRestore(row.id)}
                      >
                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
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
