import { useEffect, useState } from "react";
import { pmsApi, type PmsPermissionsDto } from "@/lib/pmsApi";
import { useAuth } from "@/contexts/AuthContext";

const defaultPerms: PmsPermissionsDto = {
  isSystemAdmin: false,
  isPmsAdmin: false,
  canCreateProject: false,
  canManageSettings: false,
  canViewReports: false,
  canViewResource: false,
  canViewHubDashboard: false,
  canCreateTask: false,
  canUpdateTask: false,
  canUpdateTaskStatus: false,
  canDeleteTask: false,
  canManageDeletedTasks: false,
  canInviteMember: false,
};

export function usePmsPermissions() {
  const { user } = useAuth();
  const [perms, setPerms] = useState<PmsPermissionsDto>(defaultPerms);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerms(defaultPerms);
      setLoading(false);
      return;
    }
    setLoading(true);
    pmsApi
      .getPermissions()
      .then((data) =>
        setPerms({
          ...defaultPerms,
          ...data,
          // All PMS users may soft-delete tasks; default true when API omits the field.
          canDeleteTask:
            data.canDeleteTask ??
            (data.canCreateTask || data.canUpdateTask || data.canUpdateTaskStatus ? true : defaultPerms.canDeleteTask),
        }),
      )
      .catch(() => setPerms(defaultPerms))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return { perms, loading };
}
