import type { ProjectTypeDto } from "@/services/settingsService";

const PROJECT_TYPE_CHIP_PALETTE = [
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-blue-200 bg-blue-50 text-blue-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-800",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-cyan-200 bg-cyan-50 text-cyan-700",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  "border-orange-200 bg-orange-50 text-orange-700",
  "border-indigo-200 bg-indigo-50 text-indigo-700",
  "border-teal-200 bg-teal-50 text-teal-700",
  "border-lime-200 bg-lime-50 text-lime-800",
  "border-pink-200 bg-pink-50 text-pink-700",
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-purple-200 bg-purple-50 text-purple-700",
  "border-red-200 bg-red-50 text-red-700",
  "border-yellow-200 bg-yellow-50 text-yellow-800",
];

const PROJECT_TYPE_DOT_PALETTE = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-lime-500",
  "bg-pink-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-yellow-500",
];

function hashPaletteIndex(typeKey: string): number {
  let hash = 0;
  for (let i = 0; i < typeKey.length; i++) {
    hash = typeKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % PROJECT_TYPE_CHIP_PALETTE.length;
}

function resolvePaletteIndex(typeKey?: string | null, colorIndex?: number): number {
  if (typeof colorIndex === "number" && colorIndex >= 0) {
    return colorIndex % PROJECT_TYPE_CHIP_PALETTE.length;
  }
  if (!typeKey) return 0;
  return hashPaletteIndex(typeKey);
}

/** Stable sort: each type gets the next palette slot (unique while count <= palette size). */
export function sortProjectTypesForColors(types: ProjectTypeDto[]): ProjectTypeDto[] {
  return [...types].sort((a, b) => {
    const orderA = a.sortOrder ?? 0;
    const orderB = b.sortOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export function buildProjectTypeColorIndexMap(types: ProjectTypeDto[]): Map<string, number> {
  const map = new Map<string, number>();
  sortProjectTypesForColors(types).forEach((type, index) => {
    map.set(type.id, index);
  });
  return map;
}

/** Chip colors for project type badges — pass colorIndex from buildProjectTypeColorIndexMap when possible. */
export function projectTypeChipClass(typeKey?: string | null, colorIndex?: number): string {
  return PROJECT_TYPE_CHIP_PALETTE[resolvePaletteIndex(typeKey, colorIndex)];
}

/** Solid dot color for filters and compact indicators. */
export function projectTypeDotClass(typeKey?: string | null, colorIndex?: number): string {
  return PROJECT_TYPE_DOT_PALETTE[resolvePaletteIndex(typeKey, colorIndex)];
}
