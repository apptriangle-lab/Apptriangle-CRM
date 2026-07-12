import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePmsProject } from "@/contexts/PmsProjectContext";
import { usePmsTaskModal } from "@/contexts/PmsTaskModalContext";

/** Legacy route: open task modal and return to tasks list. */
export default function PmsProjectTaskRedirect() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { basePath } = usePmsProject();
  const { openTask } = usePmsTaskModal();

  useEffect(() => {
    if (!taskId) return;
    openTask(taskId);
    navigate(`${basePath}/tasks`, { replace: true });
  }, [taskId, openTask, navigate, basePath]);

  return null;
}
