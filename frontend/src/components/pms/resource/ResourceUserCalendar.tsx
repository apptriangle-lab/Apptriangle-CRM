import type { PmsResourceDaySummary, PmsResourceTaskDto } from "@/lib/pmsApi";
import { CalendarView } from "@/components/pms/resource/calendar/CalendarView";

type Props = {
  from: string;
  to: string;
  tasks: PmsResourceTaskDto[];
  tasksByDate: Record<string, PmsResourceTaskDto[]>;
  tasksByDateSummary?: Record<string, PmsResourceDaySummary>;
  onTaskClick?: (taskId: string) => void;
};

export function ResourceUserCalendar(props: Props) {
  return <CalendarView {...props} />;
}

export { CalendarView } from "@/components/pms/resource/calendar/CalendarView";
export { CalendarDayBlock } from "@/components/pms/resource/calendar/CalendarDayBlock";
export { TaskListPerDay } from "@/components/pms/resource/calendar/TaskListPerDay";
export { TaskItem } from "@/components/pms/resource/calendar/TaskItem";
export { TaskStatusIndicator } from "@/components/pms/resource/calendar/TaskStatusIndicator";
