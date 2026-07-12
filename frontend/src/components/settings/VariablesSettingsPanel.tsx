import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  FolderKanban,
  Globe,
  ListChecks,
  Plus,
  UserRound,
  Wallet,
} from "lucide-react";
import { VariablesSettings } from "@/components/settings/VariablesSettings";
import { LeaveTypeSettings } from "@/components/settings/LeaveTypeSettings";
import { EmployeeTypeSettings } from "@/components/settings/EmployeeTypeSettings";
import { AccountParticularSettings } from "@/components/settings/AccountParticularSettings";
import { ExpensePurposeSettings } from "@/components/settings/ExpensePurposeSettings";
import { CurrencySettings, type CurrencySettingsRef } from "@/components/settings/CurrencySettings";
import { ProjectTypeSettings } from "@/components/settings/ProjectTypeSettings";
import { StatusSettings } from "@/components/settings/StatusSettings";
import type { RefObject } from "react";

const VARIABLES_SECTIONS = [
  { value: "hr-org", label: "Departments & Designations", icon: Briefcase },
  { value: "leave-types", label: "Leave Types", icon: CalendarIcon },
  { value: "employee-types", label: "Employee Types", icon: UserRound },
  { value: "account-particulars", label: "Account Particulars", icon: Wallet },
  { value: "expense-purposes", label: "Expense Purposes", icon: ListChecks },
  { value: "project-types", label: "Project Types", icon: FolderKanban },
  { value: "currency", label: "Currency", icon: Globe },
  { value: "statuses", label: "Global Statuses", icon: ListChecks },
] as const;

type VariablesSection = (typeof VARIABLES_SECTIONS)[number]["value"];

type Props = {
  currencySettingsRef: RefObject<CurrencySettingsRef | null>;
};

export function VariablesSettingsPanel({ currencySettingsRef }: Props) {
  const [section, setSection] = useState<VariablesSection>("hr-org");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-semibold">Variables</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage system-wide configuration variables
        </p>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as VariablesSection)} className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          {VARIABLES_SECTIONS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-1.5 rounded-md px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="hr-org" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Departments & Designations</h3>
            </div>
            <VariablesSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="leave-types" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Leave Types</h3>
            </div>
            <LeaveTypeSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="employee-types" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Employee Types</h3>
            </div>
            <EmployeeTypeSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="account-particulars" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-medium">Account Particulars</h3>
            </div>
            <AccountParticularSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="expense-purposes" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-medium">Expense Purposes</h3>
            </div>
            <ExpensePurposeSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="project-types" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-medium">Project Types</h3>
            </div>
            <ProjectTypeSettings hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="currency" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-medium">Currency Configuration</h3>
              </div>
              <Button
                size="sm"
                onClick={() => currencySettingsRef.current?.openCreate()}
                className="h-7 bg-purple-600 text-xs hover:bg-purple-700"
              >
                <Plus className="mr-1.5 h-3 w-3" />
                Add Currency
              </Button>
            </div>
            <CurrencySettings ref={currencySettingsRef} hideHeader />
          </div>
        </TabsContent>

        <TabsContent value="statuses" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-medium">Global Statuses</h3>
            </div>
            <StatusSettings hideHeader />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
