import { AlertCircle, Check, Circle, Clock } from "lucide-react";

export function KanbanStatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (key.includes("complete") || key.includes("done")) {
    return <Check className={className} strokeWidth={2.5} />;
  }
  if (key.includes("review")) {
    return <AlertCircle className={className} strokeWidth={2} />;
  }
  if ((key.includes("not") && key.includes("start")) || key === "to_do" || key === "todo") {
    return <Circle className={className} strokeWidth={2} />;
  }
  if (key.includes("test") || key.includes("qa")) {
    return <Clock className={className} strokeWidth={2} />;
  }
  return <Clock className={className} strokeWidth={2} />;
}
