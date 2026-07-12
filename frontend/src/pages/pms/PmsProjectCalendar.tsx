import { PmsProjectCalendarView } from "@/components/pms/PmsProjectCalendarView";

/** Month calendar view — tasks on start/due dates. */
export default function PmsProjectCalendar() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PmsProjectCalendarView />
    </div>
  );
}
