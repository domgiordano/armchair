import { Vector3 } from "three";

// Seconds since the scene's first drawn frame. Every moving part is a pure
// function of this, so a posed frame and a live one are the same picture.
// intro.module.css times the DOM half of the show against the same clock.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0 before `from`, 1 after `to`, smoothstepped between. */
export const phase = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};

export const easeOutBack = (x: number, c = 1.7) => 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;

/** Up over `rise`, held, down over `fall`: the envelope of a move that comes and goes. */
export const envelope = (t: number, from: number, to: number, rise = 0.35, fall = 0.4) =>
  phase(t, from, from + rise) * (1 - phase(t, to - fall, to));

export const BALL_RADIUS = 1.05;
export const BALL_REST = new Vector3(0, 6.6, -0.6);
export const CEILING = 12;
export const ROOM_RADIUS = 15;

/** Radians per second the ball turns; the thrown spots sweep at the same rate. */
export const SPIN = 0.42;

// Up it goes as the camera tilts away, taking its light with it only slowly.
export const ballY = (t: number) => BALL_REST.y + 3.2 * phase(t, 1.3, 2.9);

export const DESK_Z = 6.6;
export const DESK_TOP = 0.95;
/** When each judge's card pops, in seconds. The lower-third in intro.module.css ticks on the same beats. */
export const CARD_TIMES = [3.2, 3.55, 3.9] as const;
export const SCORES = [9, 10, 10] as const;
export const DESK_LIGHT = 2.9;

// Up at the ball, tilt down to the floor, then crane back over the judges' desk.
const EYE_BALL = new Vector3(0.35, 4.6, 5.9);
const EYE_PUSH = new Vector3(0.15, 4.9, 5.2);
const EYE_FLOOR = new Vector3(0, 2.35, 8.9);
const EYE_DESK = new Vector3(0, 2.25, 10.6);
const LOOK_FLOOR = new Vector3(0, 1.2, -0.6);
const LOOK_DESK = new Vector3(0, 1.3, 0.8);
const look0 = new Vector3();

export function camera(t: number, eye: Vector3, look: Vector3) {
  eye.lerpVectors(EYE_BALL, EYE_PUSH, phase(t, 0, 1.8));
  eye.lerp(EYE_FLOOR, phase(t, 1.3, 2.5));
  eye.lerp(EYE_DESK, phase(t, 2.6, 3.3));
  // Follow the ball up for a beat before letting it go.
  look0.set(BALL_REST.x, ballY(Math.min(t, 1.6)), BALL_REST.z);
  look.lerpVectors(look0, LOOK_FLOOR, phase(t, 1.3, 2.5));
  look.lerp(LOOK_DESK, phase(t, 2.6, 3.3));
  // A little operator sway, so it reads as a camera and not a render.
  eye.x += Math.sin(t * 0.7) * 0.05;
  eye.y += Math.sin(t * 1.1 + 1.3) * 0.02;
}

/** A vertical field of view that crops like `object-fit: cover` around a reference aspect, so the poster lines up. */
export function coverFov(aspect: number) {
  const portrait = aspect < 1;
  const base = portrait ? 60 : 40;
  const ref = portrait ? 780 / 1688 : 1600 / 1000;
  if (aspect <= ref) return base;
  const half = Math.atan((Math.tan((base * Math.PI) / 360) * ref) / aspect);
  return (half * 360) / Math.PI;
}
