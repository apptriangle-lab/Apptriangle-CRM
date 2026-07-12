/**
 * Map URL paths to backend PAGE_KEYS for RBAC. Returns null = no module gate (e.g. profile, no-access).
 */
export function pathnameToPageKey(pathname: string): string | null {
  const p = pathname.split("?")[0];
  if (p === "/" || p === "") return "dashboard";
  if (p.startsWith("/profile") || p.startsWith("/no-access")) return null;
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "dashboard";
  if (parts[0] === "companies" && parts.length >= 4 && parts[2] === "sales") return "sales";
  const first = parts[0];
  const keyMap: Record<string, string> = {
    tasks: "tasks",
    sales: "sales",
    rfq: "rfq",
    companies: "companies",
    contacts: "contacts",
    expenses: "expenses",
    accounts: "accounts",
    credentials: "credentials",
    settings: "settings",
    hr: "hr",
    leaves: "leaves",
    attendance: "attendance",
    lunch: "lunch",
    pms: "pms",
  };
  return keyMap[first] ?? null;
}

const NAV_ORDER = [
  "dashboard",
  "tasks",
  "sales",
  "rfq",
  "leaves",
  "attendance",
  "lunch",
  "expenses",
  "accounts",
  "credentials",
  "contacts",
  "companies",
  "hr",
  "pms",
  "settings",
] as const;

const KEY_TO_PATH: Record<string, string> = {
  dashboard: "/",
  tasks: "/tasks",
  sales: "/sales",
  rfq: "/rfq",
  leaves: "/leaves",
  attendance: "/attendance",
  lunch: "/lunch",
  expenses: "/expenses",
  accounts: "/accounts",
  credentials: "/credentials",
  contacts: "/contacts",
  companies: "/companies",
  hr: "/hr",
  pms: "/pms",
  settings: "/settings",
};

/** First module the user may open; `/no-access` if none. */
export function firstAllowedPath(navKeys: Set<string>): string {
  for (const k of NAV_ORDER) {
    if (navKeys.has(k)) return KEY_TO_PATH[k] ?? "/";
  }
  return "/no-access";
}
