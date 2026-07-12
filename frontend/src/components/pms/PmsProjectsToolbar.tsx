import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CrmCompanyFilterDropdown,
  type CrmCompanyFilterOption,
} from "@/components/crm/CrmCompanyFilterDropdown";
import { PmsProjectPriorityFilterDropdown } from "@/components/pms/PmsProjectPriorityFilterDropdown";
import { PmsProjectStatusFilterDropdown } from "@/components/pms/PmsProjectStatusFilterDropdown";
import { PmsProjectTypeFilterDropdown } from "@/components/pms/PmsProjectTypeFilterDropdown";
import {
  PmsUserFilterDropdown,
  type PmsUserFilterOption,
} from "@/components/pms/PmsUserFilterDropdown";
import { cn } from "@/lib/utils";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  company: string;
  onCompanyChange: (value: string) => void;
  companies: CrmCompanyFilterOption[];
  memberUserIds: string[];
  onMemberUserIdsChange: (value: string[]) => void;
  users: PmsUserFilterOption[];
  statuses: string[];
  onStatusesChange: (value: string[]) => void;
  projectTypeIds: string[];
  onProjectTypeIdsChange: (value: string[]) => void;
  priorities: string[];
  onPrioritiesChange: (value: string[]) => void;
  canCreateProject?: boolean;
  onCreateProject?: () => void;
};

export function PmsProjectsToolbar({
  search,
  onSearchChange,
  company,
  onCompanyChange,
  companies,
  memberUserIds,
  onMemberUserIdsChange,
  users,
  statuses,
  onStatusesChange,
  projectTypeIds,
  onProjectTypeIdsChange,
  priorities,
  onPrioritiesChange,
  canCreateProject = false,
  onCreateProject,
}: Props) {
  return (
    <div className="flex h-[52px] items-center gap-2">
      <div className="relative w-64 min-w-[220px] max-w-sm shrink-0 sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className={cn(
            "h-9 w-full border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-200",
            search.trim() && "border-indigo-200 bg-indigo-50/40",
          )}
          placeholder="Search projects…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <CrmCompanyFilterDropdown
        value={company}
        onChange={onCompanyChange}
        companies={companies}
        allSubtitle="Show projects from every company"
        align="end"
      />

      <PmsUserFilterDropdown
        multiple
        value={memberUserIds}
        onChange={onMemberUserIdsChange}
        users={users}
        allSubtitle="Show projects for every member"
        align="end"
      />

      <PmsProjectTypeFilterDropdown value={projectTypeIds} onChange={onProjectTypeIdsChange} align="end" />
      <PmsProjectPriorityFilterDropdown value={priorities} onChange={onPrioritiesChange} align="end" />
      <PmsProjectStatusFilterDropdown value={statuses} onChange={onStatusesChange} align="end" />

      {canCreateProject ? (
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
          onClick={onCreateProject}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New project
        </Button>
      ) : null}
    </div>
  );
}
