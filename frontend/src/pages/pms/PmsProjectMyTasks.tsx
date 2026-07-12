import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { useAuth } from "@/contexts/AuthContext";
import { pmsApi, type PmsTaskDto } from "@/lib/pmsApi";
import { usePmsProject } from "@/contexts/PmsProjectContext";

export default function PmsProjectMyTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, basePath } = usePmsProject();
  const [items, setItems] = useState<PmsTaskDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    pmsApi
      .listTasks({ projectId, assignedTo: user.id, perPage: 100 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [projectId, user?.id]);

  if (loading) return <Loader className="py-16" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My tasks in this project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned to you.</p>
        ) : (
          items.map((t) => (
            <button
              key={t.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
              onClick={() => navigate(`${basePath}/tasks/${t.id}`)}
            >
              <span className="font-medium text-sm">{t.title}</span>
              <Badge variant="outline">{t.status.replace(/_/g, " ")}</Badge>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
