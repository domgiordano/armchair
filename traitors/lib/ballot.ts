import type { EpisodeEvent } from "@/lib/api/traitors";

/** Tap a player in or out. A full slate ignores new names; removing one moves the rest up. */
export function toggle(picks: string[], id: string, max: number): string[] {
  if (picks.includes(id)) return picks.filter((p) => p !== id);
  if (max === 1) return [id];
  return picks.length < max ? [...picks, id] : picks;
}

/**
 * Chalk `id` as rank `r`, the focus card's way to pick. On its own rank it rubs
 * out; from another rank it moves; on a full slate it takes rank `r`'s place,
 * otherwise it goes in at `r` and the ranks below it move down.
 */
export function chalk(picks: string[], id: string, r: number, max: number): string[] {
  if (picks[r] === id) return picks.filter((p) => p !== id);
  const rest = picks.filter((p) => p !== id);
  if (rest.length >= max) return rest.map((p, i) => (i === r ? id : p));
  return [...rest.slice(0, r), id, ...rest.slice(r)];
}

/** Ranks are filled in order: `id` can take rank `r` only if every rank above it would be filled. */
export function chalkable(picks: string[], id: string, r: number, max: number): boolean {
  const rest = picks.filter((p) => p !== id);
  return picks[r] === id || rest.length >= max || r <= rest.length;
}

/** Swap rank `i` with the one above (-1) or below (+1). */
export function move(picks: string[], i: number, by: -1 | 1): string[] {
  const j = i + by;
  if (j < 0 || j >= picks.length) return picks;
  const next = [...picks];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * What everyone else called, most popular first. The round table counts who people
 * ranked first: that's the one who leaves.
 */
export function consensusRows(event: EpisodeEvent, top = 3): { id: string; count: number; share: number }[] {
  const c = event.consensus;
  if (!c || c.voters === 0) return [];
  const counts = (event.type === "RT" ? c.first : undefined) ?? c.picks;
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, top)
    .map(([id, count]) => ({ id, count, share: count / c.voters }));
}

