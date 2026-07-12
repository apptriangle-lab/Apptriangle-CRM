import { format } from "date-fns";
import { UtensilsCrossed } from "lucide-react";

export function LunchUserPageHeader() {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <header className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25">
        <UtensilsCrossed className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">Lunch</h1>
          <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-100">
            {today}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-stone-500">Vote for today&apos;s menu and track your balance</p>
      </div>
    </header>
  );
}
