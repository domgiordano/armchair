/** A seat's face: the tap target, the same size whatever the table's width. */
export const SEAT = 44;
/** The face at the head of the table, where the host stands on the show. */
export const HEAD = 72;
const GAP = 4;
// A camera a few degrees off straight down: a table with room to spare is a touch shorter than wide.
const TILT = 0.94;
// Above the ring, room for the head's face; below, for the lowest seat's.
const TOP = HEAD / 2 + 4;
const BOTTOM = SEAT / 2 + 8;
const STEPS = 720;

export type Point = { x: number; y: number };

export interface Ring {
  width: number;
  height: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Rim length from the head, clockwise, at each of STEPS + 1 even angles. */
  lengths: number[];
}

const at = (r: Pick<Ring, "cx" | "cy" | "rx" | "ry">, t: number): Point => ({
  x: r.cx + r.rx * Math.sin(t),
  y: r.cy - r.ry * Math.cos(t),
});

function lengthsOf(r: Pick<Ring, "cx" | "cy" | "rx" | "ry">): number[] {
  const lengths = [0];
  for (let i = 1; i <= STEPS; i++) {
    const a = at(r, ((i - 1) / STEPS) * 2 * Math.PI);
    const b = at(r, (i / STEPS) * 2 * Math.PI);
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return lengths;
}

/**
 * The seat ring for a table `width` px wide. It never grows past the width: a
 * cast too big for a round table stretches it into an oval, taller, until every
 * face has its 44px and the head's has room to be bigger.
 */
export function ringFor(width: number, n: number): Ring {
  const rx = width / 2 - SEAT / 2 - 4;
  const need = n * (SEAT + GAP) + (HEAD - SEAT);
  let ry = rx * TILT;
  for (;;) {
    const lengths = lengthsOf({ cx: 0, cy: 0, rx, ry });
    if (lengths[STEPS] >= need) {
      const cy = TOP + ry;
      return { width, height: cy + ry + BOTTOM, cx: width / 2, cy, rx, ry, lengths };
    }
    ry += 4;
  }
}

export const perimeter = (r: Ring) => r.lengths[STEPS];

/** The point `s` px clockwise round the rim from the head. */
export function pointAt(r: Ring, s: number): Point {
  const p = perimeter(r);
  const goal = ((s % p) + p) % p;
  let lo = 0;
  let hi = STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.lengths[mid] <= goal) lo = mid;
    else hi = mid;
  }
  const span = r.lengths[hi] - r.lengths[lo] || 1;
  return at(r, ((lo + (goal - r.lengths[lo]) / span) / STEPS) * 2 * Math.PI);
}

export const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Seats from the head to seat `i`, clockwise positive, in (-n/2, n/2], with the table turned to `turn`. */
export function offset(i: number, turn: number, n: number): number {
  const k = wrap(i - turn, n);
  return k > n / 2 ? k - n : k;
}

/**
 * How far round the rim a seat `k` places from the head sits. Evenly spaced,
 * except that the head's two neighbours step aside for its bigger face.
 */
export function arcOf(r: Ring, k: number, n: number): number {
  const extra = (HEAD - SEAT) / 2;
  const step = (perimeter(r) - 2 * extra) / n;
  return k * step + Math.sign(k) * extra * Math.min(1, Math.abs(k));
}

/** 1 at the head, falling to 0 a place away: how far a face has grown. */
export const headShare = (k: number) => Math.max(0, 1 - Math.abs(k));

/** The seat at the head once a turn comes to rest. */
export const snapIndex = (turn: number, n: number) => wrap(Math.round(turn), n);

/** The turn that brings seat `to` to the head the short way round from `from`. */
export function turnToward(from: number, to: number, n: number): number {
  const d = wrap(to - from, n);
  return from + (d > n / 2 ? d - n : d);
}
