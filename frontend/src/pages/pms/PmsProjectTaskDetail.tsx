import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { pmsApi, formatPmsTaskStatusLabel, type PmsTaskDto } from "@/lib/pmsApi";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { useStatusConfig } from "@/contexts/StatusConfigContext";
import { ArrowLeft } from "lucide-react";

export default function PmsProjectTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { basePath } = usePmsProject();
  const { perms } = usePmsPermissions();
  const { pmsTaskStatuses } = useStatusConfig();
  const [task, setTask] = useState<PmsTaskDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");

  const load = () => {
    if (!taskId) return;
    pmsApi
      .getTask(taskId)
      .then(setTask)
      .catch(() => toast.error("Task not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [taskId]);

  const patchStatus = async (status: string) => {
    if (!taskId) return;
    try {
      const updated = await pmsApi.patchTaskStatus(taskId, status);
      setTask(updated);
      toast.success("Status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const submitComment = async () => {
    if (!taskId || !comment.trim()) return;
    try {
      await pmsApi.addComment(taskId, comment.trim());
      setComment("");
      load();
      toast.success("Comment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    }
  };

  if (loading || !task) return <Loader className="py-24" />;

  return (
    <>
      <Button variant="ghost" className="mb-4" onClick={() => navigate(`${basePath}/tasks`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to tasks
      </Button>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatPmsTaskStatusLabel(task.status)}</Badge>
          <Select value={task.status} onValueChange={patchStatus}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pmsTaskStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatPmsTaskStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {task.description && (
        <Card className="mb-4">
          <CardContent className="pt-4 text-sm">{task.description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(task.comments ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{c.userName}</p>
              <p>{c.comment}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add comment…" />
            <Button onClick={submitComment}>Post</Button>
          </div>
        </CardContent>
      </Card>

      {perms.canDeleteTask && (
        <Button
          variant="destructive"
          className="mt-4"
          onClick={async () => {
            if (!taskId || !confirm("Delete task?")) return;
            try {
              await pmsApi.deleteTask(taskId);
              toast.success("Deleted");
              navigate(`${basePath}/tasks`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Delete failed");
            }
          }}
        >
          Delete task
        </Button>
      )}
    </>
  );
}
