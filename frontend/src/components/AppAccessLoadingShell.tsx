import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function DarkSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/10", className)} />;
}

function NavItemSkeleton({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <DarkSkeleton className="h-4 w-4 shrink-0 rounded-sm" />
      {!collapsed ? <DarkSkeleton className="h-3.5 flex-1 max-w-[5.5rem]" /> : null}
    </div>
  );
}

export function AppAccessLoadingShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading your workspace access"
      className="relative flex h-screen w-full overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-slate-200/80">
        <div className="h-full w-1/3 animate-loading-bar bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
      </div>

      <aside className="relative flex h-screen w-[11.5rem] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#050A15] sm:w-48">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-8 -top-24 h-48 w-48 rounded-full bg-indigo-600/15 blur-[72px]" />
          <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-violet-600/12 blur-[64px]" />
        </div>

        <div className="relative z-10 flex h-14 shrink-0 items-center justify-center border-b border-white/10 px-4">
          <span className="text-xl font-bold tracking-tight text-slate-100">CRM</span>
        </div>

        <nav className="relative z-10 space-y-0.5 px-2 py-3">
          {Array.from({ length: 10 }, (_, i) => (
            <NavItemSkeleton key={i} />
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative flex h-16 shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-white/10 bg-[#050A15] px-4 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#1e293b]" aria-hidden />
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
            <DarkSkeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <DarkSkeleton className="h-6 w-40 max-w-[50vw] rounded-lg sm:w-52" />
          </div>
          <div className="relative z-10 flex items-center gap-2">
            <DarkSkeleton className="h-9 w-9 rounded-xl" />
            <DarkSkeleton className="hidden h-9 w-28 rounded-xl sm:block" />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-lg bg-slate-100" />
                <Skeleton className="h-9 w-28 rounded-lg bg-slate-100" />
                <Skeleton className="h-9 w-20 rounded-lg bg-slate-100" />
              </div>
              <Skeleton className="h-9 w-64 max-w-full rounded-lg bg-slate-100" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32 bg-slate-100" />
                  <Skeleton className="h-4 w-20 bg-slate-100" />
                  <Skeleton className="h-4 w-24 bg-slate-100" />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-0 px-5 py-2 sm:px-6">
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_auto] items-center gap-4 border-b border-slate-50 py-3.5 last:border-0"
                  >
                    <Skeleton
                      className={cn(
                        "h-4 bg-slate-100",
                        ["w-[78%]", "w-[62%]", "w-[88%]", "w-[70%]"][i % 4],
                      )}
                    />
                    <Skeleton className="h-4 w-16 bg-slate-100" />
                    <Skeleton className="h-4 w-20 bg-slate-100" />
                    <Skeleton className="h-6 w-16 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-slate-500">
              <span>Preparing your workspace</span>
              <span className="inline-flex gap-0.5" aria-hidden>
                <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
              </span>
            </p>
          </div>
        </main>
      </div>

      <span className="sr-only">Loading your workspace access</span>
    </div>
  );
}
