import type { EpisodeEvent } from "@/lib/api/traitors";

/** Tap a player in or out. A full slate ignores new names; removing one moves the rest up. */
export function toggle(picks: string[], id: string, max: number): string[] {
  if (picks.includes(id)) return picks.filter((p) => p !== id);
  if (max === 1) return [id];
  return picks.length < max ? [...picks, id] : picks;
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

export interface SeatSpot {
  /** Percent of the seat ring's width and height. */
  x: number;
  y: number;
  /** 0 at the far side of the table, 1 nearest you. */
  depth: number;
  scale: number;
}

/**
 * Seats round an oval seen from a low three-quarter angle: the first sits at the
 * far end, the rest go round at equal distances along the rim, since equal
 * angles would crowd the oval's ends. Far seats shrink so it reads as a table.
 */
export function seatLayout(n: number, width = tableWidth(n)): SeatSpot[] {
  const a = (width - 2 * RING_INSET.x) / 2;
  const b = (width / TABLE_ASPECT - RING_INSET.top - RING_INSET.bottom) / 2;
  const steps = 720;
  const at = (t: number) => [a * Math.sin(t), b * Math.cos(t)];
  const lengths = [0];
  for (let i = 1; i <= steps; i++) {
    const [x0, y0] = at(((i - 1) / steps) * 2 * Math.PI);
    const [x1, y1] = at((i / steps) * 2 * Math.PI);
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = lengths[steps];
  return Array.from({ length: n }, (_, i) => {
    const goal = ((i + 0.5) / n) * total;
    const t = (lengths.findIndex((l) => l >= goal) / steps) * 2 * Math.PI;
    const depth = (1 - Math.cos(t)) / 2;
    return { x: 50 + 50 * Math.sin(t), y: 50 - 50 * Math.cos(t), depth, scale: 0.8 + 0.3 * depth };
  });
}

/** A point `share` of the way from a seat to the table's middle, for tokens set in front of it. */
export const toward = (s: SeatSpot, share: number) => ({ x: 50 + (s.x - 50) * (1 - share), y: 50 + (s.y - 50) * (1 - share) });

// A seat is about 64px square at full size; this keeps neighbours' tap areas apart.
const SPACING = 66;
export const RING_INSET = { x: 40, top: 40, bottom: 56 };
export const TABLE_ASPECT = 1.45;

/** Ramanujan's approximation of an ellipse's perimeter. */
const perimeter = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

/** The narrowest table whose ring fits `n` seats without them touching. Wider than a phone scrolls. */
export function tableWidth(n: number): number {
  let w = 320;
  const fits = (w: number) => {
    const h = w / TABLE_ASPECT;
    return perimeter((w - 2 * RING_INSET.x) / 2, (h - RING_INSET.top - RING_INSET.bottom) / 2) >= n * SPACING;
  };
  while (!fits(w)) w += 8;
  return w;
}
