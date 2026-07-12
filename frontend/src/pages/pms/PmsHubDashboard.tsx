import { PmsComingSoon } from "@/components/pms/PmsComingSoon";
import { LayoutDashboard } from "lucide-react";

export default function PmsHubDashboard() {
  return (
    <PmsComingSoon
      title="Dashboard"
      description="Cross-project metrics, workload insights, and PMS analytics will live here."
      icon={LayoutDashboard}
    />
  );
}
