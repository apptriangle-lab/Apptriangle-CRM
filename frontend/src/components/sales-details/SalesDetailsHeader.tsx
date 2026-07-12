import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCcw,
  User,
  CircleDollarSign,
  Briefcase,
  Timer,
} from "lucide-react";
import { formatStatusLabel } from "@/lib/utils";
import { categoryBadgeClass } from "./constants";
import { cn } from "@/lib/utils";

/** Days until expected close; overdue shown as negative-style copy. */
function remainingDaysDisplay(dateStr: string): {
  line: string;
  overdue: boolean;
} {
  const raw = (dateStr ?? "").trim();
  if (!raw) return { line: "—", overdue: false };
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { line: "—", overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { line: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { line: "Today", overdue: false };
  if (diff === 1) return { line: "1 day", overdue: false };
  return { line: `${diff} days`, overdue: false };
}

export type SalesDetailsHeaderProps = {
  prospect: string;
  companyName: string;
  categoryKey: string;
  expectedRevenue: number;
  revenueCurrency: { symbol: string; code: string } | null;
  expectedClosingDate: string;
  createdBy: string;
  createdAt: string;
  onBack: () => void;
  onEdit: () => void;
  salesScopeAdmin: boolean;
  onDelete: () => void;
  onChangeStatus: () => void;
  statusLocked: boolean;
};

export function SalesDetailsHeader({
  prospect,
  companyName,
  categoryKey,
  expectedRevenue,
  revenueCurrency,
  expectedClosingDate,
  createdBy,
  onEdit,
  salesScopeAdmin,
  onDelete,
  onChangeStatus,
  statusLocked,
}: SalesDetailsHeaderProps) {
  const remaining = remainingDaysDisplay(expectedClosingDate);
  const currencySymbol = revenueCurrency?.symbol || "$";

  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* 1. Primary Identity Section (Large) */}
      <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className=" text-2xl font-black tracking-tight text-slate-900 dark:text-white ">
                {prospect}
              </h1>
              <Badge
                className={cn(
                  "border-none px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                  categoryBadgeClass(categoryKey),
                )}
              >
                {formatStatusLabel(categoryKey)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Building2 className="h-5 w-5 text-indigo-500" />
              <span>{companyName}</span>
            </div>
          </div>
        </div>

        {/* Action — ⋮ menu with high-contrast hover / focus */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "group h-12 w-12 rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm",
                "transition-all duration-200",
                "hover:border-indigo-400/80 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 hover:text-indigo-800 hover:shadow-md hover:shadow-indigo-500/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                "dark:hover:border-indigo-500/55 dark:hover:from-indigo-950/90 dark:hover:to-violet-950/70 dark:hover:text-indigo-100 dark:hover:shadow-indigo-900/30",
                "dark:focus-visible:ring-offset-slate-950",
              )}
            >
              <MoreHorizontal className="h-6 w-6 text-slate-500 transition-colors group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className={cn(
              "z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl shadow-slate-900/10",
              "dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/25",
            )}
          >
            <DropdownMenuItem
              onClick={onEdit}
              className={cn(
                "cursor-pointer gap-3 rounded-xl py-3 pl-3 pr-3 font-semibold text-slate-800",
                "transition-colors duration-150",
                "hover:bg-indigo-50 hover:text-indigo-950",
                "focus:bg-indigo-50 focus:text-indigo-950",
                "data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-950",
                "dark:text-slate-800 dark:hover:bg-indigo-50 dark:hover:text-indigo-950",
                "dark:focus:bg-indigo-50 dark:data-[highlighted]:bg-indigo-50",
              )}
            >
              <Pencil className="h-4 w-4 shrink-0 text-indigo-600" /> Edit Deal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onChangeStatus}
              disabled={statusLocked}
              className={cn(
                "cursor-pointer gap-3 rounded-xl py-3 pl-3 pr-3 font-semibold text-slate-800",
                "transition-colors duration-150",
                "hover:bg-emerald-50 hover:text-emerald-950",
                "focus:bg-emerald-50 focus:text-emerald-950",
                "data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-950",
                "dark:text-slate-800 dark:hover:bg-emerald-50 dark:hover:text-emerald-950",
                "dark:focus:bg-emerald-50 dark:data-[highlighted]:bg-emerald-50",
                "data-[disabled]:opacity-45 data-[disabled]:hover:bg-transparent dark:data-[disabled]:hover:bg-transparent",
              )}
            >
              <RefreshCcw className="h-4 w-4 shrink-0 text-emerald-600" /> Update Status
            </DropdownMenuItem>
            {salesScopeAdmin && (
              <>
                <DropdownMenuSeparator className="my-1.5 bg-slate-200/90" />
                <DropdownMenuItem
                  onClick={onDelete}
                  className={cn(
                    "cursor-pointer gap-3 rounded-xl py-3 pl-3 pr-3 font-semibold text-red-700",
                    "transition-colors duration-150",
                    "hover:bg-red-50 hover:text-red-800",
                    "focus:bg-red-50 focus:text-red-800",
                    "data-[highlighted]:bg-red-50 data-[highlighted]:text-red-800",
                    "dark:text-red-700 dark:hover:bg-red-50 dark:hover:text-red-800",
                    "dark:focus:bg-red-50 dark:data-[highlighted]:bg-red-50",
                  )}
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-red-600" /> Delete Deal
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Responsive Metric Strip (Optimized for 720p) */}
      <div className="grid grid-cols-1 gap-2 rounded-[1.5rem] border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-3 lg:grid-cols-4">
        {/* Revenue Chip */}
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50 text-emerald-600 dark:bg-emerald-500/10">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Revenue
            </p>
            <p className="truncate text-lg font-black tabular-nums text-slate-900 dark:text-emerald-400">
              {currencySymbol}
              {expectedRevenue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Date Chip */}
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100/50 text-blue-600 dark:bg-blue-500/10">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Closing Date
            </p>
            <p className="truncate text-base font-bold text-slate-800 dark:text-slate-200">
              {expectedClosingDate}
            </p>
          </div>
        </div>

        {/* Timer Chip */}
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              remaining.overdue
                ? "bg-red-100/50 text-red-600 dark:bg-red-500/10"
                : "bg-amber-100/50 text-amber-600 dark:bg-amber-500/10",
            )}
          >
            <Timer className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Remaining
            </p>
            <p
              className={cn(
                "truncate text-base font-bold",
                remaining.overdue
                  ? "text-red-600"
                  : "text-slate-800 dark:text-slate-200",
              )}
            >
              {remaining.line}
            </p>
          </div>
        </div>

        {/* Owner Chip (Full width on 720p tablet break, single col on laptop) */}
        <div className="hidden items-center gap-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100/50 text-violet-600 dark:bg-violet-500/10">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Deal Owner
            </p>
            <p className="truncate text-base font-bold text-slate-800 dark:text-slate-200">
              {createdBy}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
