export function toggleMultiFilterValue(selected: string[], id: string): string[] {
  if (selected.includes(id)) {
    return selected.filter((value) => value !== id);
  }
  return [...selected, id];
}

export function formatMultiFilterLabel(
  defaultLabel: string,
  selected: string[],
  resolveLabel?: (id: string) => string | undefined,
): string {
  if (!selected.length) return defaultLabel;
  if (selected.length === 1) {
    return resolveLabel?.(selected[0]) ?? selected[0];
  }
  return `${defaultLabel} (${selected.length})`;
}

export function hasMultiFilter(selected: string[]): boolean {
  return selected.length > 0;
}

export function joinMultiFilterParam(selected: string[]): string {
  return selected.join(",");
}
