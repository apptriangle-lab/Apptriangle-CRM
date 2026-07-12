import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EmptyState } from "@/components/EmptyState";
import { Trash2 } from "lucide-react";
import { BinCredentialsContent } from "@/components/settings/BinCredentialsContent";
import { BinExpensesContent } from "@/components/settings/BinExpensesContent";
import { BinRenewalsContent } from "@/components/settings/BinRenewalsContent";

/** Mirrors main app routes / areas that may expose a recycle bin later. */
const BIN_PAGE_TABS = [
  { value: "tasks", label: "Tasks" },
  { value: "sales", label: "Sales" },
  { value: "companies", label: "Companies" },
  { value: "contacts", label: "Contacts" },
  { value: "expenses", label: "Expenses" },
  { value: "renewals", label: "Renewals" },
  { value: "credentials", label: "Credentials" },
  { value: "accounts", label: "Accounts" },
  { value: "hr", label: "HR" },
  { value: "leaves", label: "Leaves" },
  { value: "variables", label: "Variables" },
] as const;

function DeletedItemsTablePlaceholder({ pageLabel }: { pageLabel: string }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Deleted from {pageLabel}
        </CardTitle>
        <CardDescription>
          Items you remove from this area will appear here once soft delete is
          enabled for that module.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20">
          <Table maxHeight="min(62vh, 520px)">
            <TableHeader className="[&_tr]:border-b-0 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-muted/95 [&_th]:backdrop-blur-sm [&_th]:shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
              <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="font-semibold w-[180px]">Deleted</TableHead>
                <TableHead className="font-semibold text-right w-[200px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="h-32 p-0 align-middle">
                  <EmptyState
                    icon={Trash2}
                    title="Bin is empty"
                    description={`No deleted ${pageLabel.toLowerCase()} yet. When you delete records, they will be listed here.`}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function BinSettingsPanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-semibold">Bin</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Review soft-deleted records by area of the app. Expenses, renewals, and credentials (restore requires
          Credentials admin scope) are supported; other modules use placeholders for now.
        </p>
      </div>

      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto w-full flex-wrap justify-start gap-1 border min-h-0">
          {BIN_PAGE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-background px-3 py-2 text-xs sm:text-sm shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {BIN_PAGE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {tab.value === "expenses" ? (
              <BinExpensesContent />
            ) : tab.value === "renewals" ? (
              <BinRenewalsContent />
            ) : tab.value === "credentials" ? (
              <BinCredentialsContent />
            ) : (
              <DeletedItemsTablePlaceholder pageLabel={tab.label} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
