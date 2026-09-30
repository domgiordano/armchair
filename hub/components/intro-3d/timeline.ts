// Seconds from the start of the intro. The 2D copy in app/intro.css keys off
// the same clock: it fades in at 3.2 s and the stage exits at 4.7 s.
export const SPOT_ON = 0.35;
export const CROWN_RELEASE = 1.2;
export const PADDLE_FLIP = 2.3;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

const G = 13;
const RESTITUTION = 0.3;

/**
 * Height above rest of a crown dropped from `height` at `s` seconds after
 * release, bouncing on impact; `impact` is seconds since it first landed.
 */
export function crownDrop(s: number, height: number) {
  if (s <= 0) return { y: height, impact: -1 };
  const fall = Math.sqrt((2 * height) / G);
  if (s < fall) return { y: height - 0.5 * G * s * s, impact: -1 };

  const impact = s - fall;
  let t = impact;
  let v = G * fall * RESTITUTION;
  while (v > 0.05) {
    const hop = (2 * v) / G;
    if (t < hop) return { y: v * t - 0.5 * G * t * t, impact };
    t -= hop;
    v *= RESTITUTION;
  }
  return { y: 0, impact };
}

/** Paddle angle: lying flat at pi/2, springing up to upright with one overshoot. */
export function paddleAngle(s: number) {
  if (s <= 0) return Math.PI / 2;
  const w = 13;
  const zeta = 0.45;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return (Math.PI / 2) * Math.exp(-zeta * w * s) * (Math.cos(wd * s) + ((zeta * w) / wd) * Math.sin(wd * s));
}

/** Spot intensity 0..1: a follow spot striking, with a stutter before it holds. */
export function spotLevel(t: number) {
  const up = smooth(SPOT_ON, SPOT_ON + 0.45, t);
  const stutter = t < SPOT_ON + 0.18 ? 0.55 + 0.45 * Math.abs(Math.sin((t - SPOT_ON) * 70)) : 1;
  return up * stutter;
}
