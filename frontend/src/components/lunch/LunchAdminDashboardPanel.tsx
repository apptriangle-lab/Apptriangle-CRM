import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Users, UtensilsCrossed, Vote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBalanceBdt, lunchApi, type LunchDashboardDto } from "@/lib/lunchApi";
import { LUNCH_CARD, LUNCH_OPTION_TYPE_COLORS } from "@/components/lunch/lunchConstants";

export function LunchAdminDashboardPanel() {
  const [data, setData] = useState<LunchDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await lunchApi.getDashboard());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={cn(LUNCH_CARD, "flex min-h-[200px] items-center justify-center p-8")}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={UtensilsCrossed}
          label="Office orders today"
          value={String(data.officeOrderCount)}
          accent="orange"
        />
        <StatCard icon={Vote} label="Total votes today" value={String(data.totalVotesToday)} accent="indigo" />
        <StatCard icon={Users} label="Active polls" value={String(data.activePolls)} accent="violet" />
      </div>

      {data.todayPoll ? (
        <div className={cn(LUNCH_CARD, "p-5")}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{data.todayPoll.title}</h3>
              <p className="text-sm text-slate-500">
                {format(new Date(data.today + "T12:00:00"), "EEEE, MMM d")} ·{" "}
                {formatBalanceBdt(data.todayPoll.costAmount)} per office meal
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                data.todayPoll.status === "active"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
              )}
            >
              {data.todayPoll.status}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.options ?? []).map((opt) => (
              <div
                key={opt.optionId}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{opt.label}</p>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset",
                      LUNCH_OPTION_TYPE_COLORS[opt.optionType],
                    )}
                  >
                    {opt.optionType}
                  </span>
                </div>
                <span className="ml-3 text-2xl font-bold tabular-nums text-slate-900">{opt.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={cn(LUNCH_CARD, "p-8 text-center text-slate-500")}>No poll created for today yet.</div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "orange" | "indigo" | "violet";
}) {
  const colors = {
    orange: "from-orange-50 to-white border-orange-100 text-orange-700",
    indigo: "from-indigo-50 to-white border-indigo-100 text-indigo-700",
    violet: "from-violet-50 to-white border-violet-100 text-violet-700",
  };
  return (
    <div className={cn(LUNCH_CARD, "bg-gradient-to-br p-4", colors[accent])}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
