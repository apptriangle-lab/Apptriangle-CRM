/**
 * Resolve backend base URL for fetch/SSE.
 * - unset → local Vite dev (http://localhost:5000)
 * - SAME_ORIGIN → relative /api (Docker/nginx proxy)
 * - full URL → explicit backend host
 */
export function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url === "SAME_ORIGIN") return "";
  if (url) return String(url).replace(/\/$/, "");
  return "http://localhost:5000";
}
