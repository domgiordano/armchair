import type { CSSProperties } from "react";

import styles from "./disco-loader.module.css";

type Size = "sm" | "md" | "lg";

const PX: Record<Size, number> = { sm: 24, md: 48, lg: 96 };
// Fewer, bigger mirrors at 24 px, or the grout swallows them.
const RINGS: Record<Size, number> = { sm: 6, md: 9, lg: 12 };

const R = 40;
const deg = Math.PI / 180;
const round = (n: number) => Math.round(n * 100) / 100;

interface Tile {
  points: string;
  fill: string;
  delay: string;
}

// Lit from the upper left, like the intro's key light.
const LIGHT = [-0.45, 0.55, 0.7];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(" ")})`;
const DARK = [28, 35, 82];
const LIT = [150, 160, 222];
const WARM = [236, 226, 214];

// The front half of a ball of square mirrors, projected flat. Each tile flashes
// in turn by longitude, so the light runs across the ball and it reads as spinning.
function mirrors(rings: number): Tile[] {
  const band = 180 / rings;
  const tiles: Tile[] = [];
  for (let i = 0; i < rings; i++) {
    const lat0 = -90 + i * band + band * 0.07;
    const lat1 = -90 + (i + 1) * band - band * 0.07;
    const mid = (lat0 + lat1) / 2;
    const count = Math.max(4, Math.round((360 * Math.cos(mid * deg)) / band));
    const step = 360 / count;
    const offset = i % 2 ? step / 2 : 0;
    for (let j = 0; j < count; j++) {
      const lon0 = -180 + offset + j * step + step * 0.08;
      const lon1 = lon0 + step * 0.84;
      if (lon1 <= -90 || lon0 >= 90) continue;
      const a = Math.max(lon0, -90);
      const b = Math.min(lon1, 90);
      const corner = (lat: number, lon: number) =>
        `${round(50 + R * Math.cos(lat * deg) * Math.sin(lon * deg))},${round(50 - R * Math.sin(lat * deg))}`;
      const lon = (a + b) / 2;
      const n = [Math.cos(mid * deg) * Math.sin(lon * deg), Math.sin(mid * deg), Math.cos(mid * deg) * Math.cos(lon * deg)];
      const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      // The row just under the equator catches the room's warm bulbs.
      const warm = i === Math.floor(rings / 2) - 1 && j % 3 !== 1;
      tiles.push({
        points: [corner(lat0, a), corner(lat0, b), corner(lat1, b), corner(lat1, a)].join(" "),
        fill: warm ? mix(LIT, WARM, 0.35 + 0.5 * lit) : mix(DARK, LIT, 0.15 + 0.85 * lit ** 1.5),
        delay: `${round(-((90 - lon) / 180) * 1.8 - i * 0.09)}s`,
      });
    }
  }
  return tiles;
}

const TILES: Record<Size, Tile[]> = { sm: mirrors(RINGS.sm), md: mirrors(RINGS.md), lg: mirrors(RINGS.lg) };

// Where the thrown specks land, as fractions of the ball's size.
const SPECKS = [
  { x: -0.75, y: -0.45, delay: 0, gold: true },
  { x: 0.8, y: -0.2, delay: 0.55, gold: false },
  { x: -0.6, y: 0.7, delay: 1.1, gold: false },
  { x: 0.65, y: 0.65, delay: 1.6, gold: true },
];

interface DiscoLoaderProps {
  size?: Size;
  label?: string;
}

/** A spinning mirror ball for loading states. The label is for screen readers only. */
export function DiscoLoader({ size = "md", label = "Loading" }: DiscoLoaderProps) {
  const px = PX[size];
  return (
    <div role="status" aria-live="polite" className={styles.loader} style={{ "--px": `${px}px` } as CSSProperties}>
      <svg viewBox="0 0 100 100" width={px} height={px} aria-hidden="true" className={styles.ball}>
        <circle cx="50" cy="50" r={R + 1} className={styles.grout} />
        {TILES[size].map((t, i) => (
          <g key={i}>
            <polygon points={t.points} fill={t.fill} />
            <polygon points={t.points} className={styles.flash} style={{ animationDelay: t.delay }} />
          </g>
        ))}
        <circle cx="50" cy="50" r={R + 1} className={styles.rim} />
        <path d="M36 30 L38 36 L44 38 L38 40 L36 46 L34 40 L28 38 L34 36 Z" className={styles.glint} />
      </svg>
      {size !== "sm" &&
        SPECKS.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`${styles.speck} ${s.gold ? styles.gold : ""}`}
            style={{ "--dx": s.x, "--dy": s.y, animationDelay: `${s.delay}s` } as CSSProperties}
          />
        ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface PageLoaderProps {
  label?: string;
}

/** A page's whole content area while its data loads. */
export function PageLoader({ label = "Loading" }: PageLoaderProps) {
  return (
    <div className="flex min-h-[50dvh] w-full flex-1 items-center justify-center py-12">
      <DiscoLoader size="lg" label={label} />
    </div>
  );
}
