import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Users } from "lucide-react";
import { AttendanceToolbarOutlineButton } from "@/components/attendance/AttendanceToolbarOutlineButton";
import { EmptyState } from "@/components/EmptyState";
import { HrAttendanceTeamTableSkeleton } from "@/components/hr/HrAttendanceTeamTableSkeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HrAttendanceTeamTableRow } from "@/components/hr/HrAttendanceTeamTableRow";
import {
  HR_ATT_TEAM_COL_GRID,
  HR_ATT_TEAM_COLUMNS,
  HR_ATT_TEAM_DATE_PL,
  HR_ATT_TEAM_LIST_HPAD,
  HR_ATT_TEAM_TABLE_MIN_W,
} from "@/components/hr/hrAttendanceTeamTableStyles";
import type { AttendanceDto, HRInfoDto, UserDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  records: AttendanceDto[];
  users: UserDto[];
  hrData: Record<string, HRInfoDto>;
  loading: boolean;
  locationNames: Record<string, string>;
  recordCount: number;
  periodSummary: string;
  onRowClick: (user: UserDto, attendance: AttendanceDto) => void;
};

export function HrAttendanceTeamTable({
  records,
  users,
  hrData,
  loading,
  locationNames,
  recordCount,
  periodSummary,
  onRowClick,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") exitFullscreen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen, exitFullscreen]);

  const renderBody = () => {
    if (loading) {
      return <HrAttendanceTeamTableSkeleton />;
    }

    if (records.length === 0) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center py-14">
          <EmptyState
            icon={Users}
            title="No attendance records"
            description="No records match the current filters. Try a different period or employee."
          />
        </div>
      );
    }

    return (
      <TooltipProvider delayDuration={150}>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-table">
          <div className={HR_ATT_TEAM_TABLE_MIN_W}>
            <div
              role="row"
              className={cn(
                HR_ATT_TEAM_COL_GRID,
                HR_ATT_TEAM_LIST_HPAD,
                "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm",
              )}
            >
              <span className={HR_ATT_TEAM_DATE_PL}>{HR_ATT_TEAM_COLUMNS[0]}</span>
              {HR_ATT_TEAM_COLUMNS.slice(1).map((col) => (
                <span key={col} className="truncate">
                  {col}
                </span>
              ))}
            </div>

            {records.map((attendance) => {
              const user = users.find((u) => u.id === attendance.userId);
              if (!user) return null;

              return (
                <div
                  key={`${attendance.userId}_${attendance.date}`}
                  className={HR_ATT_TEAM_LIST_HPAD}
                >
                  <HrAttendanceTeamTableRow
                    attendance={attendance}
                    user={user}
                    hr={hrData[user.id]}
                    locationNames={locationNames}
                    onClick={() => onRowClick(user, attendance)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    );
  };

  const shell = (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden bg-white",
        isFullscreen
          ? "fixed inset-0 z-[200] h-screen w-screen"
          : "h-full flex-1 rounded-xl border border-slate-200 shadow-sm",
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-2.5 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Employee attendance{" "}
            <span className="font-normal text-slate-400">({recordCount})</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {periodSummary}
            {loading ? " · Loading…" : null}
            {isFullscreen ? " · Press Esc to exit" : null}
          </p>
        </div>
        <AttendanceToolbarOutlineButton
          size="sm"
          onClick={() => (isFullscreen ? exitFullscreen() : setIsFullscreen(true))}
          title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-3.5 w-3.5" />
              Exit
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5" />
              Fullscreen
            </>
          )}
        </AttendanceToolbarOutlineButton>
      </div>

      {renderBody()}
    </div>
  );

  if (isFullscreen) {
    return createPortal(shell, document.body);
  }

  return shell;
}
