import { Vector3 } from "three";

// Seconds since the scene's first drawn frame. Every moving part is a pure
// function of this, so a posed frame and a live one are the same picture.
// intro.module.css times the DOM half (the title, the fade out) against the
// same clock.

/** The whole intro, in seconds. intro.tsx ends it after this. */
export const LENGTH = 7;
/** The cut from the corridor to the hall, hidden in a dip to black. */
export const CUT = 2.4;
/** The lead's hood falls back over these seconds. */
export const HOOD_FALL = [4.2, 5.0] as const;
/** The title fades in once the hood is down. intro.module.css uses the same beats. */
export const TITLE_IN = [5.0, 5.6] as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0 before `from`, 1 after `to`, smoothstepped between. */
export const phase = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};

/** Up over `rise`, held, down over `fall`: the envelope of a move that comes and goes. */
export const envelope = (t: number, from: number, to: number, rise: number, fall: number) =>
  phase(t, from, from + rise) * (1 - phase(t, to - fall, to));

export type Shot = "corridor" | "hall";
export const shot = (t: number): Shot => (t < CUT ? "corridor" : "hall");

/** How black the frame is, peaking on the cut. */
export const dip = (t: number) => envelope(t, CUT - 0.3, CUT + 0.35, 0.3, 0.35);

// The hall is built well clear of the corridor, so neither shows in the other.
export const TABLE = new Vector3(0, 0, 30);
export const TABLE_RADIUS = 1.9;
export const TABLE_TOP = 0.8;
/** Where the void opens: the lead's head, once they've stopped behind the table. */
export const VOID = new Vector3(0, 1.6, 27.6);

/** How far the hood has fallen, 0 up to 1 down, settling with a little overshoot. */
export function hoodFall(t: number) {
  const x = clamp01((t - HOOD_FALL[0]) / (HOOD_FALL[1] - HOOD_FALL[0]));
  // Slow to start, as cloth peels off a head, then a soft bounce on the shoulders.
  const c = 1.4;
  const e = x * x;
  return x === 0 ? 0 : 1 + (c + 1) * (e - 1) ** 3 + c * (e - 1) ** 2;
}

/** How wide the void has opened around the head, 0 to 1. */
export const voidOpen = (t: number) => phase(t, 4.5, 5.3);

/** The title's opacity. */
export const titleIn = (t: number) => phase(t, TITLE_IN[0], TITLE_IN[1]);

// The procession. In the corridor they come in column, two by two behind the
// lead; in the hall they fan out behind the table. x, then z (behind the lead
// in the corridor, absolute in the hall).
const COLUMN = [
  [0, 0],
  [-0.55, -1.5],
  [0.55, -1.75],
  [-0.5, -3.3],
  [0.5, -3.55],
] as const;
const PLACES = [
  [0, VOID.z],
  [-1.3, 27.05],
  [1.3, 26.95],
  [-2.4, 26.2],
  [2.45, 26.1],
] as const;
export const FIGURES = COLUMN.length;

/** Metres per second down the corridor. */
const PACE = 1.3;
/** One footfall every this many metres. */
export const STRIDE = 0.7;

export interface Pose {
  position: Vector3;
  yaw: number;
  /** 1 mid-stride, 0 standing. */
  walk: number;
}

export function pose(i: number, t: number, out: Pose) {
  if (shot(t) === "corridor") {
    const [x, dz] = COLUMN[i];
    const z = -8.6 + PACE * t + dz;
    out.position.set(x, bob(z, 1), z);
    out.yaw = Math.sin(z * 1.3 + i) * 0.04;
    out.walk = 1;
    return out;
  }
  const [x, z] = PLACES[i];
  // Each comes through the door a beat after the one ahead, and slows to a stop.
  const arrive = CUT + 1.0 + i * 0.15;
  const k = phase(t, CUT - 0.4, arrive);
  const along = z - 1.7 * (1 - k);
  const walk = 1 - phase(t, arrive - 0.4, arrive);
  out.position.set(x * (0.55 + 0.45 * k), bob(along, walk), along);
  // The lead faces the camera's side of the table; the rest turn in towards it.
  out.yaw = i === 0 ? 0 : Math.atan2(TABLE.x - x, TABLE.z - z) * 0.7;
  out.walk = walk;
  return out;
}

const bob = (z: number, walk: number) => 0.025 * Math.abs(Math.sin((z / STRIDE) * Math.PI)) * walk;

// Corridor: dolly back ahead of the procession. Hall: low across the table, then
// push in on the lead until their head fills the middle of the frame.
const EYE_HALL = [new Vector3(2.1, 1.3, 34.2), new Vector3(0.08, 1.62, 29.05)] as const;
const LOOK_HALL = new Vector3(0, 1.32, 27.6);

export function camera(t: number, eye: Vector3, look: Vector3) {
  if (shot(t) === "corridor") {
    const k = t / CUT;
    eye.set(0.36 - 0.16 * k, 1.5 - 0.12 * k, -2.2 + 1.3 * k);
    look.set(0.02, 1.42, -12 + 2 * k);
  } else {
    const k = phase(t, CUT + 0.2, LENGTH - 0.2);
    eye.lerpVectors(EYE_HALL[0], EYE_HALL[1], k);
    look.lerpVectors(LOOK_HALL, VOID, phase(t, CUT + 0.2, 4.4));
  }
  // A little operator sway, so it reads as a camera and not a render.
  eye.x += Math.sin(t * 0.7) * 0.03;
  eye.y += Math.sin(t * 1.1 + 1.3) * 0.015;
}

// Fire. Each light runs its own phase through the same summed sines and noise.
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** A flame's brightness around 1, never below ~0.6. */
export function flicker(t: number, seed: number) {
  const waves = Math.sin(t * 7.3 + seed * 1.7) * 0.5 + Math.sin(t * 13.1 + seed * 4.1) * 0.3 + Math.sin(t * 23.7 + seed * 2.3) * 0.2;
  return 0.85 + 0.09 * waves + 0.16 * (noise(t * 11 + seed * 31) - 0.5);
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Every torch on the corridor walls. The first four nearest the camera carry the lights. */
export const CORRIDOR_TORCHES = [
  v(1.42, 2.1, -0.4),
  v(-1.42, 2.1, -3.4),
  v(1.42, 2.1, -6.8),
  v(-1.42, 2.1, -10.2),
  v(1.42, 2.1, -13.6),
  v(-1.42, 2.1, -17),
  v(1.42, 2.1, -20.4),
];
export const HALL_TORCHES = [v(-1.55, 2.25, 23.35), v(1.55, 2.25, 23.35)];
/** Candles on the table: a candelabra at the centre, a cluster at the lead's edge. */
export const CANDLES = [
  // [x, z, height]; the first five stand in the candelabra, off to one side of the camera's line.
  [-0.75, 30.6, 0.34],
  [-1.07, 30.68, 0.26],
  [-0.43, 30.54, 0.26],
  [-1.37, 30.75, 0.2],
  [-0.15, 30.5, 0.2],
  [0.72, 28.6, 0.22],
  [0.92, 28.78, 0.14],
  [-0.78, 28.62, 0.18],
] as const;

const HALL_LIGHTS = [v(0.15, 1.15, 28.55), v(-0.75, 1.45, 30.4), HALL_TORCHES[0], HALL_TORCHES[1]];
/** The light colour of every flame. */
export const FIRE = "#ff9a3c";
/** The four point lights: where they are and how bright, per shot. */
export function light(i: number, t: number, at: Vector3) {
  const hall = shot(t) === "hall";
  at.copy(hall ? HALL_LIGHTS[i] : CORRIDOR_TORCHES[i]);
  if (!hall) at.x *= 0.88;
  else if (i >= 2) at.z += 0.25;
  const base = hall ? [5.5, 4, 7, 7][i] : 9;
  return base * flicker(t, i * 2.7 + (hall ? 9 : 0));
}

/** A vertical field of view that crops like `object-fit: cover` around a reference aspect, so the poster lines up. */
export function coverFov(aspect: number) {
  const portrait = aspect < 1;
  const base = portrait ? 62 : 42;
  const ref = portrait ? 780 / 1688 : 1600 / 1000;
  if (aspect <= ref) return base;
  const half = Math.atan((Math.tan((base * Math.PI) / 360) * ref) / aspect);
  return (half * 360) / Math.PI;
}
