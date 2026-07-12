import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format sales status/category for display: "win_close" → "Win Close", "cool_water" → "Cool Water". */
export function formatStatusLabel(value: string): string {
  if (!value) return value;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Replace snake_case / kebab tokens in arbitrary text (e.g. notification bodies).
 * "… to in_progress" → "… to In Progress". Does not alter normal words.
 */
export function humanizeSnakeCaseTokensInText(text: string): string {
  if (!text) return text;
  return text.replace(
    /\b[a-z0-9]+(?:[-_][a-z0-9]+)+\b/gi,
    (token) => formatStatusLabel(token.replace(/-/g, "_")),
  );
}

/** Format date for table display: "11-Feb-26" (DD-MMM-YY) */
export function formatTableDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  
  return `${day}-${month}-${year}`;
}

/**
 * Format a Date using the user's local calendar/time — use instead of toISOString() for form fields
 * and API payloads where the user picked a local date/time (toISOString shifts the calendar day in non-UTC zones).
 */
export function formatLocalDatetimeInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Local YYYY-MM-DD for `<input type="date" />` (avoids UTC parsing of date-only strings). */
export function toLocalDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD from a date input as local midnight. */
export function localDateFromDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}