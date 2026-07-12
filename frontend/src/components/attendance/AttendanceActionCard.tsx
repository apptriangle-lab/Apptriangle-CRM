import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  LogIn,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { useTodayAttendance, NO_SHIFT_UNDER_BUTTON } from "@/hooks/useTodayAttendance";
import { AttendanceActionCardSkeleton } from "@/components/attendance/AttendanceSummaryCardSkeletons";
import { getTodayActionStatusLabel } from "@/lib/attendanceDisplay";
import type { AttendanceDto } from "@/lib/api";
import { cn } from "@/lib/utils";

const HOLD_DURATION = 2000;

export type AttendanceActionCardVariant = "dashboard" | "page";

interface AttendanceActionCardProps {
  variant: AttendanceActionCardVariant;
  onAfterMutation?: () => void;
  /** After a late check-in, host can open reconciliation flow. */
  onLateCheckIn?: (attendance: AttendanceDto) => void;
  /** Show when user dismissed the modal but can still submit reconciliation. */
  showReconciliationButton?: boolean;
  onReconciliationClick?: () => void;
  /** Bump to reload today's attendance (e.g. after reconciliation submit). */
  refreshToken?: number;
}

export function AttendanceActionCard({
  variant,
  onAfterMutation,
  onLateCheckIn,
  showReconciliationButton = false,
  onReconciliationClick,
  refreshToken = 0,
}: AttendanceActionCardProps) {
  const {
    todayAttendance,
    loadingToday,
    loadingAttendance,
    loadTodayAttendance,
    handleCheckIn,
    handleCheckOut,
    attendanceBlocked,
  } = useTodayAttendance();

  useEffect(() => {
    void loadTodayAttendance();
  }, [refreshToken, loadTodayAttendance]);

  const [holdProgress, setHoldProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const runAfterCheckIn = async () => {
    const dto = await handleCheckIn();
    onAfterMutation?.();
    if (dto?.status === "late" && dto.id) {
      onLateCheckIn?.(dto);
    }
  };

  const runAfterCheckOut = async () => {
    await handleCheckOut();
    onAfterMutation?.();
  };

  const stopHold = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const startHold = (type: "in" | "out") => {
    stopHold();
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        rafRef.current = null;
        setHoldProgress(0);
        if (type === "in") {
          void runAfterCheckIn();
        } else {
          void runAfterCheckOut();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const statusLabel = getTodayActionStatusLabel(
    todayAttendance,
    attendanceBlocked,
  );

  const isPage = variant === "page";
  const btnClass = isPage ? "h-8 rounded-lg text-[12px] font-semibold" : "h-10 rounded-lg text-sm";

  const statusDotClass = cn(
    "h-2 w-2 shrink-0 rounded-full",
    attendanceBlocked && "bg-amber-500",
    !attendanceBlocked &&
      todayAttendance?.checkInTime &&
      !todayAttendance?.checkOutTime &&
      "animate-pulse bg-indigo-500",
    !attendanceBlocked &&
      todayAttendance?.checkInTime &&
      todayAttendance?.checkOutTime &&
      "bg-emerald-500",
    !attendanceBlocked && !todayAttendance?.checkInTime && "bg-slate-400",
  );

  if (!isPage) {
    return (
      <Card className="relative overflow-hidden border-border/60 bg-card ">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the Attendance page for check-in and check-out.
        </CardContent>
      </Card>
    );
  }

  if (loadingToday) {
    return (
      <section className="relative flex h-full w-full flex-col overflow-hidden p-4">
        <AttendanceActionCardSkeleton />
      </section>
    );
  }

  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              Today&apos;s attendance
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-slate-700">
                {format(new Date(), "EEE, MMM d, yyyy")}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              attendanceBlocked && "border-amber-200 bg-amber-50 text-amber-900",
              !attendanceBlocked &&
                todayAttendance?.checkInTime &&
                todayAttendance?.checkOutTime &&
                "border-emerald-200 bg-emerald-50 text-emerald-800",
              !attendanceBlocked &&
                !(todayAttendance?.checkInTime && todayAttendance?.checkOutTime) &&
                "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            <span className={statusDotClass} />
            <span className="max-w-[88px] truncate sm:max-w-none">{statusLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className={cn(
              "rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2",
              todayAttendance?.checkInTime &&
                (showReconciliationButton
                  ? "border-amber-100 bg-amber-50/50"
                  : "border-emerald-100 bg-emerald-50/50"),
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Check in
              </p>
              <LogIn
                className={cn(
                  "h-3.5 w-3.5",
                  showReconciliationButton ? "text-amber-600" : "text-emerald-600",
                )}
              />
            </div>
            {todayAttendance?.checkInTime ? (
              <>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums leading-none text-slate-900">
                  {format(new Date(todayAttendance.checkInTime), "hh:mm")}
                  <span className="ml-1 text-[11px] font-medium text-slate-500">
                    {format(new Date(todayAttendance.checkInTime), "a")}
                  </span>
                </p>
                {showReconciliationButton ? (
                  <button
                    type="button"
                    onClick={onReconciliationClick}
                    disabled={loadingAttendance}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <ClipboardList className="h-3 w-3 shrink-0" />
                    Reconciliation
                  </button>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                {attendanceBlocked ? "—" : "Not yet"}
              </p>
            )}
          </div>

          <div
            className={cn(
              "rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2",
              todayAttendance?.checkOutTime && "border-amber-100 bg-amber-50/40",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Check out
              </p>
              <DoorOpen
                className={cn(
                  "h-3.5 w-3.5",
                  todayAttendance?.checkOutTime ? "text-amber-600" : "text-slate-400",
                )}
              />
            </div>
            {todayAttendance?.checkOutTime ? (
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums leading-none text-slate-900">
                {format(new Date(todayAttendance.checkOutTime), "hh:mm")}
                <span className="ml-1 text-[11px] font-medium text-slate-500">
                  {format(new Date(todayAttendance.checkOutTime), "a")}
                </span>
              </p>
            ) : todayAttendance?.checkInTime ? (
              <p className="mt-1 text-[11px] font-medium leading-tight text-amber-800">On duty</p>
            ) : (
              <p className="mt-1 text-[12px] font-medium text-slate-500">—</p>
            )}
          </div>
        </div>

        <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
          {!todayAttendance?.checkInTime ? (
            <button
              type="button"
              onMouseDown={() => startHold("in")}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold("in")}
              onTouchEnd={stopHold}
              disabled={loadingAttendance || attendanceBlocked}
              className={cn(
                "relative w-full overflow-hidden rounded-lg bg-slate-900 font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-800",
                btnClass,
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left border-r border-white/20 bg-white/15"
                style={{ transform: `scaleX(${holdProgress / 100})` }}
              />
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                Hold to check in
              </span>
            </button>
          ) : !todayAttendance?.checkOutTime ? (
            <button
              type="button"
              onMouseDown={() => startHold("out")}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold("out")}
              onTouchEnd={stopHold}
              disabled={loadingAttendance || attendanceBlocked}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border border-amber-300 bg-amber-500 font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 hover:bg-amber-600",
                btnClass,
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left border-r border-white/25 bg-white/20"
                style={{ transform: `scaleX(${holdProgress / 100})` }}
              />
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5" />
                Hold to check out
              </span>
            </button>
          ) : (
            <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-[12px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Checked out
            </div>
          )}

          {attendanceBlocked ? (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-snug text-amber-900">{NO_SHIFT_UNDER_BUTTON}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
