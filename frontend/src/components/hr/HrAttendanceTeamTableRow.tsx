import { format } from "date-fns";
import { Building2, DoorOpen, LogIn, MapPin } from "lucide-react";
import { PmsMemberAvatar } from "@/components/pms/PmsTaskAssigneesPicker";
import { HrAttendanceLocationMapTooltip } from "@/components/hr/HrAttendanceLocationMapTooltip";
import {
  HR_ATT_TEAM_COL_GRID,
  HR_ATT_TEAM_DATE_PL,
} from "@/components/hr/hrAttendanceTeamTableStyles";
import { AttendanceStatusBadges } from "@/lib/attendanceStatusBadges";
import type { AttendanceDto, HRInfoDto, UserDto } from "@/lib/api";
import { cn } from "@/lib/utils";

function TimeCell({
  time,
  location,
  locationLabel,
  variant,
}: {
  time: string;
  location?: string | null;
  locationLabel?: string;
  variant: "check-in" | "check-out";
}) {
  const isCheckIn = variant === "check-in";
  const Icon = isCheckIn ? LogIn : DoorOpen;
  const iconWrap = isCheckIn
    ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
    : "bg-orange-50 text-orange-600 ring-orange-100";

  const content = (
    <div className="min-w-0 space-y-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
            iconWrap,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate font-medium tabular-nums text-slate-800">{time}</span>
      </div>
      {location && locationLabel ? (
        <div className="flex min-w-0 items-center gap-1 pl-8 text-[11px] text-slate-400">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </div>
      ) : null}
    </div>
  );

  if (location && locationLabel) {
    return (
      <HrAttendanceLocationMapTooltip
        coordinates={location}
        variant={variant}
        locationLabel={locationLabel}
      >
        <div className="cursor-default">{content}</div>
      </HrAttendanceLocationMapTooltip>
    );
  }

  return content;
}

type Props = {
  attendance: AttendanceDto;
  user: UserDto;
  hr?: HRInfoDto;
  locationNames: Record<string, string>;
  onClick: () => void;
};

export function HrAttendanceTeamTableRow({
  attendance,
  user,
  hr,
  locationNames,
  onClick,
}: Props) {
  const checkInTime = attendance.checkInTime;
  const checkOutTime = attendance.checkOutTime;
  const inTimeStr = checkInTime ? format(new Date(checkInTime), "hh:mm a") : "";
  const outTimeStr = checkOutTime ? format(new Date(checkOutTime), "hh:mm a") : "";

  const checkInLocation = attendance.checkInLocation;
  const checkOutLocation = attendance.checkOutLocation;
  const checkInLabel = checkInLocation
    ? locationNames[checkInLocation] || checkInLocation
    : undefined;
  const checkOutLabel = checkOutLocation
    ? locationNames[checkOutLocation] || checkOutLocation
    : undefined;

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        HR_ATT_TEAM_COL_GRID,
        "group cursor-pointer border-b border-slate-100 py-2.5 text-[13px] transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none",
      )}
    >
      <span
        className={cn(
          "truncate font-medium tabular-nums text-slate-700",
          HR_ATT_TEAM_DATE_PL,
        )}
      >
        {attendance.date ? format(new Date(attendance.date), "MMM d, yyyy") : "—"}
      </span>

      <div className="flex min-w-0 items-center gap-2.5">
        <PmsMemberAvatar name={user.name} userId={user.id} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-[11px] text-slate-400">{user.email}</p>
        </div>
      </div>

      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-slate-600">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{hr?.department || "—"}</span>
      </span>

      {checkInTime ? (
        <TimeCell
          time={inTimeStr}
          location={checkInLocation}
          locationLabel={checkInLabel}
          variant="check-in"
        />
      ) : (
        <span className="text-slate-400">—</span>
      )}

      {checkOutTime ? (
        <TimeCell
          time={outTimeStr}
          location={checkOutLocation}
          locationLabel={checkOutLabel}
          variant="check-out"
        />
      ) : (
        <span className="text-slate-400">—</span>
      )}

      <AttendanceStatusBadges row={attendance} />
    </div>
  );
}
