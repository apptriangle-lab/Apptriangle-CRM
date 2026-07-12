/** Compare lunch entity ids safely (uuid strings, occasional number coercion). */
export function lunchIdsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
