/** The smallest a seat's face gets: a tap target. */
export const SEAT = 44;
/** The smallest the face at the head of the table gets, where the host stands on the show. */
export const HEAD = 64;
const GAP = 2;

export type Point = { x: number; y: number };

/** A round table `size` px square, its seats' centres on a circle of radius `r`. */
export interface Ring {
  size: number;
  cx: number;
  cy: number;
  r: number;
  /** A seat's face, and the head's. */
  seat: number;
  head: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The seat ring for a table `size` px across. Faces grow with the table, up to
 * a size that leaves room between them; a big cast at a phone's width packs them
 * a tap target apart, and only past that do they shrink.
 */
export function ringFor(size: number, n: number): Ring {
  const head = clamp(size * 0.15, HEAD, 104);
  const r = size / 2 - head / 2 - 2;
  const step = (2 * Math.PI * r - (head - SEAT)) / Math.max(n, 1);
  // The gap goes before the tap target does.
  const seat = Math.min(clamp(size * 0.085, SEAT, 64), Math.max(step - GAP, Math.min(step, SEAT)));
  return { size, cx: size / 2, cy: size / 2, r, seat, head };
}

export const perimeter = (r: Ring) => 2 * Math.PI * r.r;

/** The point `s` px clockwise round the rim from the head, at the top. */
export function pointAt(r: Ring, s: number): Point {
  const t = s / r.r;
  return { x: r.cx + r.r * Math.sin(t), y: r.cy - r.r * Math.cos(t) };
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
  const extra = (r.head - r.seat) / 2;
  const step = (perimeter(r) - 2 * extra) / n;
  return k * step + Math.sign(k) * extra * Math.min(1, Math.abs(k));
}

/** 1 at the head, falling to 0 a place away: how far a face has grown. */
export const headShare = (k: number) => Math.max(0, 1 - Math.abs(k));

/** A seat's face size `k` places from the head. */
export const faceSize = (r: Ring, k: number) => r.seat + (r.head - r.seat) * headShare(k);

/** The seat at the head once a turn comes to rest. */
export const snapIndex = (turn: number, n: number) => wrap(Math.round(turn), n);

/** The turn that brings seat `to` to the head the short way round from `from`. */
export function turnToward(from: number, to: number, n: number): number {
  const d = wrap(to - from, n);
  return from + (d > n / 2 ? d - n : d);
}
