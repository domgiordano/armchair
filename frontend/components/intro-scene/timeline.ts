import { Vector3 } from "three";

// Seconds into the intro. Every moving part of the scene is a pure function of
// this, so a scene that loads late joins mid-shot instead of starting over.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0 before `from`, 1 after `to`, smoothstepped between. */
export const phase = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};

export const easeOutBack = (x: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

export const BALL = new Vector3(0, 6.2, 0);
export const BALL_RADIUS = 1.1;
export const ROOM_RADIUS = 14;
export const CEILING = 11;

/** Radians per second the ball turns; the thrown spots sweep at the same rate. */
export const SPIN = 0.32;

// Looking up at the ball, a slow push-in, then a tilt down to the floor where
// the paddles come up.
const EYE_START = new Vector3(0.5, 3.6, 6.4);
const EYE_PUSH = new Vector3(0.15, 4.3, 4.6);
const EYE_END = new Vector3(0, 2.05, 8.3);
const LOOK_END = new Vector3(0, 1.55, 2.2);

export function camera(t: number, eye: Vector3, look: Vector3) {
  eye.lerpVectors(EYE_START, EYE_PUSH, phase(t, 0, 2.4));
  eye.lerp(EYE_END, phase(t, 2.1, 3.7));
  look.lerpVectors(BALL, LOOK_END, phase(t, 1.9, 3.7));
}

/** House lights come up over the first half second. */
export const houseLights = (t: number) => phase(t, 0, 0.6);

export const PADDLES_UP = 3.05;
export const PADDLE_Z = 5.4;
export const PADDLE_Y = 1.3;
