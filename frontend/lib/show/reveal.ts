/**
 * The couples the end-of-episode reveal lights up before naming who went home:
 * everyone eliminated, plus the night's lowest judges' totals until at least one
 * of them is safe. Sorted by id, so where a couple stands says nothing.
 */
export function spotlight(eliminated: string[], totals: Record<string, number>, size = 3): string[] {
  const out = new Set(eliminated);
  const want = Math.max(size, out.size + 1);
  const rest = Object.entries(totals)
    .filter(([id]) => !out.has(id))
    .sort(([a, x], [b, y]) => x - y || a.localeCompare(b));
  for (const [id] of rest) {
    if (out.size >= want) break;
    out.add(id);
  }
  return [...out].sort();
}
