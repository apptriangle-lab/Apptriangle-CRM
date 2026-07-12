import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Coins, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { lunchApi, type LunchSettingsDto } from "@/lib/lunchApi";
import {
  LUNCH_ORDER_CARD,
  LUNCH_ORDER_CARD_HEADER,
  LUNCH_ORDER_LIST_HPAD,
} from "@/components/lunch/lunchOrderSummaryStyles";

export function LunchSettingsPanel() {
  const [settings, setSettings] = useState<LunchSettingsDto | null>(null);
  const [costAmount, setCostAmount] = useState("65");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await lunchApi.getSettings();
      setSettings(s);
      setCostAmount(String(s.defaultCostAmount));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const s = await lunchApi.updateSettings({
        defaultCostAmount: parseFloat(costAmount) || 65,
      });
      setSettings(s);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-1 justify-center">
      <div className="flex w-full max-w-lg flex-col gap-3 sm:gap-4">
        <div className="shrink-0 text-center sm:text-left">
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Settings</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Default values for new lunch polls. Amounts are in BDT (Taka).
          </p>
        </div>

        {loading ? (
          <div className={cn(LUNCH_ORDER_CARD, "flex min-h-[220px] w-full items-center justify-center")}>
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className={cn(LUNCH_ORDER_CARD, "w-full")}>
          <div className={cn(LUNCH_ORDER_CARD_HEADER, LUNCH_ORDER_LIST_HPAD)}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
                <Settings2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-stone-900">Lunch module settings</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Applied when creating new polls unless overridden per poll.
                </p>
              </div>
            </div>
          </div>

          <div className={cn(LUNCH_ORDER_LIST_HPAD, "py-5")}>
            <div className="rounded-2xl border border-orange-100/80 bg-gradient-to-br from-white to-orange-50/30 p-4 shadow-[0_2px_10px_rgba(251,146,60,0.05)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100">
                      <Coins className="h-4 w-4" />
                    </span>
                    <Label htmlFor="default-cost" className="text-[13px] font-semibold text-stone-900">
                      Default daily lunch cost
                    </Label>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-stone-500 sm:mt-1">
                    Debited for office menu votes, credited for personal lunch votes.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                  <Input
                    id="default-cost"
                    type="number"
                    min={0}
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 w-[120px] rounded-xl border-stone-200 text-right text-[13px] tabular-nums shadow-sm focus-visible:border-orange-300 focus-visible:ring-orange-200"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">TK</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100/80 bg-gradient-to-r from-orange-50/30 via-white to-amber-50/20 px-4 py-4 sm:px-5">
            {settings?.updatedAt ? (
              <p className="text-xs text-stone-500">
                Last updated {format(new Date(settings.updatedAt), "MMM d, yyyy · h:mm a")}
              </p>
            ) : (
              <span />
            )}
            <Button
              onClick={() => void save()}
              disabled={saving}
              size="sm"
              className="h-9 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-[13px] text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
            </Button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
