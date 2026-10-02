import { Vector3 } from "three";

// Seconds since the scene's first drawn frame. Every moving part is a pure
// function of this, so a posed frame and a live one are the same picture.
// intro.module.css times the DOM half (the title, the fade out) against the
// same clock.
//
// The set is one long stone hall running down -z to an arched door, with a
// fire beyond it. Shot one: the procession walks out of the fog towards a low
// camera until the lead's cloak fills the lens. Shot two picks up on the lead's
// chest in the same black, cranes up to the hood against the fire, and the
// hood slides back onto the shoulders to leave only darkness.

/** The whole intro, in seconds. intro.tsx ends it after this. */
export const LENGTH = 7;
/** The cut, hidden in the black of the lead's cloak filling the lens. */
export const CUT = 3.25;
/** The lead's hood slides back over these seconds. */
export const HOOD = [4.35, 5.55] as const;
/** The title burns in, letter by letter, over these seconds. intro.module.css uses the same beats. */
export const TITLE = [5.1, 6.3] as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0 before `from`, 1 after `to`, smoothstepped between. */
export const phase = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};

/** Like phase, but with no acceleration at either end either: a camera move that settles. */
export const glide = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export type Shot = "procession" | "reveal";
export const shot = (t: number): Shot => (t < CUT ? "procession" : "reveal");

/** Half the hall's width, where the vault springs, and its door and back walls along z. */
export const HALL = { halfWidth: 2.3, spring: 4.4, door: -16, back: 2.4 } as const;
/** Where the door's fire sits, beyond the arch. */
export const FIRE = new Vector3(0, 1.2, HALL.door - 2.4);

// The procession, in column: the lead, then two pairs. x and z behind the lead.
const COLUMN = [
  [0, 0],
  [-0.78, -1.7],
  [0.74, -1.95],
  [-0.66, -3.6],
  [0.7, -3.85],
] as const;
export const FIGURES = COLUMN.length;

/** Metres per second. */
const PACE = 1.3;
/** One footfall every this many metres. */
export const STRIDE = 0.72;
const LEAD_START = -5.15;
const LEAD_STOP = LEAD_START + PACE * CUT;

/** The head's centre, above the feet. */
export const HEAD_Y = 1.63;
/** Where the void is: the lead's head, once they've stopped. */
export const VOID = new Vector3(0, HEAD_Y, LEAD_STOP);

export interface Pose {
  position: Vector3;
  yaw: number;
  /** 1 mid-stride, 0 standing. */
  walk: number;
}

export function pose(i: number, t: number, out: Pose) {
  const [x, dz] = COLUMN[i];
  // In the second shot the column has come to a stop and closed up a little.
  const walking = shot(t) === "procession";
  const z = walking ? LEAD_START + PACE * t + dz : LEAD_STOP + dz * 1.1;
  const walk = walking ? 1 : 0;
  out.walk = walk;
  // A small sway over each step, and a body that rises a little at mid-stride.
  const step = (z / STRIDE) * Math.PI;
  out.position.set(x + 0.012 * Math.sin(step) * walk, 0.014 * Math.abs(Math.sin(step)) * walk, z);
  out.yaw = 0.025 * Math.sin(step * 0.5 + i) * walk + (walking ? 0 : x * -0.12);
  return out;
}

const scratch: Pose = { position: new Vector3(), yaw: 0, walk: 0 };
const dir = new Vector3();
const toward = new Vector3();
const chest = new Vector3();

// Blend headings, not points: a near target and a far one lerped as points
// would swing the frame off both.
function aim(eye: Vector3, a: Vector3, b: Vector3, k: number, look: Vector3) {
  dir.subVectors(a, eye).normalize();
  toward.subVectors(b, eye).normalize();
  look.copy(eye).add(dir.lerp(toward, k).normalize());
}

const DOOR_LOOK = new Vector3(0, 2.1, HALL.door);

/** Where the camera is, and a point it looks through. */
export function camera(t: number, eye: Vector3, look: Vector3) {
  if (shot(t) === "procession") {
    // Low and slow, pushing in a little as they come; the lead walks into the lens.
    const k = glide(t, 0, CUT);
    eye.set(mix(0.16, 0.04, k), mix(1.02, 1.2, k), mix(0, -0.3, k));
    pose(0, t, scratch);
    chest.set(scratch.position.x, 1.22, scratch.position.z);
    aim(eye, DOOR_LOOK, chest, phase(t, 1.2, CUT - 0.15), look);
  } else {
    // Out of the cloak's black, up to the hood, then a slow push on the void.
    const rise = glide(t, CUT, CUT + 0.9);
    const push = glide(t, CUT + 0.7, LENGTH);
    const dist = mix(mix(0.75, 1.35, rise), 0.48, push);
    // Level with the head, so the door's fire sits right behind the hood.
    eye.set(0.02, mix(1.22, VOID.y - 0.03, rise), VOID.z + dist);
    chest.set(VOID.x, 1.2, VOID.z);
    aim(eye, chest, VOID, glide(t, CUT, CUT + 0.8), look);
  }
  // Handheld breath: slow and small, so it reads as an operator and not a shake.
  eye.x += Math.sin(t * 0.63 + 0.4) * 0.008 + Math.sin(t * 1.37) * 0.004;
  eye.y += Math.sin(t * 0.91 + 1.3) * 0.006;
}

/** Where the lens focuses: the lead throughout. */
export function focus(t: number, out: Vector3) {
  pose(0, t, scratch);
  if (shot(t) === "procession") return out.set(scratch.position.x, 1.45, scratch.position.z + 0.15);
  return out.set(VOID.x, mix(1.25, VOID.y, glide(t, CUT, CUT + 1.0)), VOID.z + 0.12);
}

/** How far back the hood has slid, 0 up to 1 down on the shoulders. */
export const hoodSlide = (t: number) => glide(t, HOOD[0], HOOD[1]);

/** How far the darkness has spread over the head as the hood leaves it, 0 to 1. */
export const voidOpen = (t: number) => glide(t, HOOD[0], HOOD[1] + 0.3);

/** The title's progress, 0 to 1. */
export const titleIn = (t: number) => phase(t, TITLE[0], TITLE[1]);

// Fire. Each flame runs its own phase through the same summed sines and noise.
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

/** The torches, in brackets on the hall's walls. */
export const TORCHES = [v(-2.12, 2.35, -3.4), v(2.12, 2.35, -3.4), v(-2.12, 2.35, -10.2), v(2.12, 2.35, -10.2)];

/** The light colour of every flame. */
export const FLAME = "#ff9f5a";

export interface Light {
  at: Vector3;
  intensity: number;
}

// In the second shot the lead is a silhouette against the door's fire, so the
// hood's outline carries the move. A fire just behind and above them puts a
// rim on that outline; a faint torch off to the right keeps the cloth from
// going flat black.
const REVEAL_LIGHTS = [
  { at: new Vector3(0.05, 1.8, VOID.z - 0.85), power: 7 },
  { at: new Vector3(0.7, 1.7, VOID.z + 0.8), power: 1.2 },
  { at: TORCHES[2], power: 3 },
];

/** Three point lights: the torches nearest the lens, or the close-up's rim and key. The door's own light is separate. */
export function light(i: number, t: number, out: Light) {
  if (shot(t) === "reveal") {
    out.at.copy(REVEAL_LIGHTS[i].at);
    out.intensity = REVEAL_LIGHTS[i].power * flicker(t, 4.4 + i * 1.9);
  } else {
    out.at.copy(TORCHES[i]).setX(TORCHES[i].x * 0.9);
    out.intensity = 9 * flicker(t, i * 2.7);
  }
  return out;
}

/** The door's fire, a slower, bigger flicker than a torch's. */
export const doorGlow = (t: number) => 1 + 0.5 * (flicker(t * 0.6, 12) - 0.85);

/** A vertical field of view that crops like `object-fit: cover` around a reference aspect, so the poster lines up. */
export function coverFov(aspect: number) {
  const portrait = aspect < 1;
  const base = portrait ? 62 : 42;
  const ref = portrait ? 780 / 1688 : 1600 / 1000;
  if (aspect <= ref) return base;
  const half = Math.atan((Math.tan((base * Math.PI) / 360) * ref) / aspect);
  return (half * 360) / Math.PI;
}
