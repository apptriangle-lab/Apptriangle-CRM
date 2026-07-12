/**
 * Display title for the main app navbar, derived from the URL.
 * Keep in sync with `App.tsx` routes and `pathnameToPageKey` in rbacPaths where relevant.
 */
export function pathnameToPageTitle(pathname: string): string {
  const p = pathname.split("?")[0];
  if (p === "/" || p === "") return "Dashboard";

  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "Dashboard";

  if (parts[0] === "profile") return "Profile";
  if (parts[0] === "no-access") return "Access";

  if (parts[0] === "companies" && parts.length >= 4 && parts[2] === "sales") {
    return "Sales";
  }
  if (parts[0] === "companies" && parts.length >= 2) {
    return "Company";
  }
  if (parts[0] === "companies") return "Companies";

  if (parts[0] === "tasks" && parts.length >= 2) return "Task";
  if (parts[0] === "tasks") return "Tasks";

  if (parts[0] === "sales" && parts.length >= 2) return "Sales";
  if (parts[0] === "sales") return "Sales";

  if (parts[0] === "rfq" && parts.length >= 2 && parts[1] === "new") return "New RFQ";
  if (parts[0] === "rfq" && parts.length >= 2) return "RFQ";
  if (parts[0] === "rfq") return "RFQ";

  if (parts[0] === "pms") {
    if (parts.length === 1) return "PMS";
    if (parts.length === 2 && parts[1] === "resource") return "Resource";
    if (parts.length === 2 && parts[1] === "dashboard") return "Dashboard";
    if (parts.length >= 2 && parts[1] === "tasks") {
      if (parts.length === 2) return "My Tasks";
      if (parts[2] === "kanban") return "My Tasks · Kanban";
      if (parts[2] === "calendar") return "My Tasks · Calendar";
      return "My Tasks";
    }
    if (parts[1] === "projects" && parts.length >= 3) {
      const section = parts[3] ?? "";
      if (!section || section === "dashboard") return section === "dashboard" ? "Project Overview" : "Tasks";
      if (section === "tasks") return parts.length >= 5 ? "Task" : "Tasks";
      if (section === "kanban") return "Kanban Board";
      if (section === "my-tasks") return "My Tasks";
      if (section === "settings") return "Project Settings";
      return "Project";
    }
    return "PMS";
  }

  if (parts[0] === "expenses") return "Expense";

  if (parts[0] === "hr" && parts.length >= 2) return "Employee";
  if (parts[0] === "hr") return "HRM";

  const bySegment: Record<string, string> = {
    contacts: "Contacts",
    accounts: "Accounts",
    credentials: "Credentials",
    settings: "Settings",
    leaves: "Leaves",
    attendance: "Attendance",
    lunch: "Lunch",
  };

  return bySegment[parts[0] ?? ""] ?? "Page";
}
