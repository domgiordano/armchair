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
  /** The centre of the seat's face, in percent of the table's box. */
  x: number;
  y: number;
}

export interface TableLayout {
  /** The box at its narrowest, in px. It scales up, never down. */
  width: number;
  height: number;
  /** The seat ring, in px of that box. */
  ring: { cx: number; cy: number; rx: number; ry: number };
  /** The head of the table, kept empty for the host. */
  host: SeatSpot;
  seats: SeatSpot[];
}

// A seat is a 44px face over its name, 56px wide; this keeps neighbours' tap areas apart.
const SPACING = 60;
// A camera a few degrees off straight down: the ring is a touch shorter than it is wide.
export const TILT = 0.94;
// Faces sit on the ring; names hang below the lowest ones.
const MARGIN = { x: 30, top: 30, bottom: 48 };

/** Ramanujan's approximation of an ellipse's perimeter. */
const perimeter = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

/**
 * The table seen from above: the host's place at the head, the players round the
 * rest of the rim at equal distances along it, clockwise from the host's left.
 * The ring grows until every seat fits; wider than a phone, the view scrolls.
 */
export function tableLayout(n: number): TableLayout {
  const slots = n + 1;
  let rx = 110;
  while (perimeter(rx, rx * TILT) < slots * SPACING) rx += 2;
  const ry = rx * TILT;
  const width = 2 * (rx + MARGIN.x);
  const height = 2 * ry + MARGIN.top + MARGIN.bottom;
  const ring = { cx: width / 2, cy: MARGIN.top + ry, rx, ry };

  // Equal steps along the rim, not equal angles: the tilt would bunch the sides.
  const steps = 720;
  const at = (t: number) => ({ x: ring.cx + rx * Math.sin(t), y: ring.cy - ry * Math.cos(t) });
  const lengths = [0];
  for (let i = 1; i <= steps; i++) {
    const a = at(((i - 1) / steps) * 2 * Math.PI);
    const b = at((i / steps) * 2 * Math.PI);
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const slot = (i: number): SeatSpot => {
    const goal = (i / slots) * lengths[steps];
    const p = at((lengths.findIndex((l) => l >= goal) / steps) * 2 * Math.PI);
    return { x: (p.x / width) * 100, y: (p.y / height) * 100 };
  };
  return { width, height, ring, host: slot(0), seats: Array.from({ length: n }, (_, i) => slot(i + 1)) };
}

/** A point `share` of the way from a seat to the table's middle, for tokens set in front of it. */
export function toward(t: TableLayout, s: SeatSpot, share: number): SeatSpot {
  const cx = (t.ring.cx / t.width) * 100;
  const cy = (t.ring.cy / t.height) * 100;
  return { x: cx + (s.x - cx) * (1 - share), y: cy + (s.y - cy) * (1 - share) };
}
