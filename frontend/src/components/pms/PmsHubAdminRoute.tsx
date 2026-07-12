import { Navigate } from "react-router-dom";
import { usePmsPermissions } from "@/hooks/usePmsPermissions";

type PmsHubAdminRouteProps = {
  children: React.ReactNode;
  permission: "canViewResource" | "canViewHubDashboard";
};

export function PmsHubAdminRoute({ children, permission }: PmsHubAdminRouteProps) {
  const { perms, loading } = usePmsPermissions();

  if (loading) {
    return null;
  }

  if (!perms[permission]) {
    return <Navigate to="/pms" replace />;
  }

  return children;
}
