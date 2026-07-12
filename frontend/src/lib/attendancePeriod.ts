import { addDays, startOfDay, subDays } from "date-fns";

/** Work week runs Sunday through Thursday (5 days). */
const WORK_WEEK_LENGTH_DAYS = 5;

function daysSinceWorkWeekStart(date: Date): number {
  return (date.getDay() + 1) % 7;
}

export function getCurrentWorkWeekRange(reference = new Date()): {
  from: Date;
  to: Date;
} {
  const today = startOfDay(reference);
  const sunday = subDays(today, daysSinceWorkWeekStart(today));
  const thursday = addDays(sunday, WORK_WEEK_LENGTH_DAYS - 1);
  return { from: sunday, to: thursday < today ? thursday : today };
}

export function getPreviousWorkWeekRange(reference = new Date()): {
  from: Date;
  to: Date;
} {
  const today = startOfDay(reference);
  const sunday = subDays(today, daysSinceWorkWeekStart(today));
  const prevSunday = subDays(sunday, 7);
  const prevThursday = addDays(prevSunday, WORK_WEEK_LENGTH_DAYS - 1);
  return { from: prevSunday, to: prevThursday };
}
