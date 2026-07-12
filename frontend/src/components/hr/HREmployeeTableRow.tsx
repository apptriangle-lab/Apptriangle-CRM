import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  parseISO,
  startOfDay,
  differenceInDays,
  differenceInYears,
  addYears,
} from "date-fns";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HREmployeeListItemDto } from "@/lib/api";

function formatTenureFromJoining(joiningDate: Date, now = new Date()): string | null {
  const start = startOfDay(joiningDate);
  const end = startOfDay(now);
  const daysSince = differenceInDays(end, start);
  if (daysSince < 0) return null;
  const fullYears = differenceInYears(end, start);
  if (fullYears >= 1) {
    const afterFullYears = addYears(start, fullYears);
    const remainderDays = differenceInDays(end, afterFullYears);
    const yearPart = fullYears === 1 ? "1 year" : `${fullYears} years`;
    if (remainderDays <= 0) return yearPart;
    const dayPart = remainderDays === 1 ? "1 day" : `${remainderDays} days`;
    return `${yearPart} ${dayPart}`;
  }
  return daysSince === 1 ? "1 day" : `${daysSince} days`;
}

function formatEmployeeType(raw: string): string {
  let formattedType = raw.replace(/^["']|["']$/g, "");
  if (formattedType.includes(",")) {
    const types = formattedType
      .split(",")
      .map((t) => t.trim().replace(/^["']|["']$/g, ""));
    formattedType = types[0] || formattedType;
  }
  if (formattedType.includes("-")) {
    return formattedType
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return formattedType;
}

type HREmployeeTableRowProps = {
  employee: HREmployeeListItemDto;
};

export const HREmployeeTableRow = memo(function HREmployeeTableRow({
  employee: user,
}: HREmployeeTableRowProps) {
  const navigate = useNavigate();
  const hr = user.hr;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  let joiningDate: Date | null = null;
  if (hr?.joiningDate) {
    try {
      joiningDate = parseISO(hr.joiningDate.split("T")[0]);
    } catch {
      joiningDate = null;
    }
  }

  const tenureLabel =
    joiningDate && !Number.isNaN(joiningDate.getTime())
      ? formatTenureFromJoining(joiningDate)
      : null;

  const nextActivityEntry = user.latestEmployment;
  const nextActivityDate = nextActivityEntry?.nextActivityDate;
  const remainingDays = nextActivityDate
    ? differenceInDays(
        startOfDay(parseISO(nextActivityDate)),
        startOfDay(new Date()),
      )
    : null;

  return (
    <TableRow
      className="cursor-pointer group hover:bg-primary/5 transition-colors"
      onClick={() => navigate(`/hr/${user.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-sm text-primary group-hover:scale-105 transition-transform">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-foreground">{user.name}</div>
            {!user.isActive && (
              <Badge variant="outline" className="mt-1 text-xs bg-muted/50">
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{hr?.designation || "—"}</span>
      </TableCell>
      <TableCell>
        {joiningDate ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{format(joiningDate, "MMM dd, yyyy")}</span>
            {tenureLabel ? (
              <span className="text-xs text-muted-foreground">{tenureLabel}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {hr?.reportingManagerName ? (
          <span className="text-sm">{hr.reportingManagerName}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {hr?.employeeType ? (
          <Badge
            variant="outline"
            className="text-xs bg-primary/5 border-primary/20 text-primary"
          >
            {formatEmployeeType(hr.employeeType)}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {nextActivityEntry?.nextActivity ? (
          <span className="text-sm">{nextActivityEntry.nextActivity}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {remainingDays !== null ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              remainingDays <= 7
                ? "bg-red-500/10 text-red-600 border-red-500/20"
                : remainingDays <= 30
                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                  : "bg-green-500/10 text-green-600 border-green-500/20",
            )}
          >
            {remainingDays} {remainingDays === 1 ? "day" : "days"}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
    </TableRow>
  );
});
