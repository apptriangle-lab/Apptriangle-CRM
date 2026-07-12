import type { PmsPermissionsDto } from "@/lib/pmsApi";

/** Only PMS module admins may filter the cross-project hub Tasks tab by any assignee. */
export function canViewAllHubTasks(
  perms: Pick<PmsPermissionsDto, "isPmsAdmin" | "isSystemAdmin">,
): boolean {
  return perms.isPmsAdmin || perms.isSystemAdmin;
}
