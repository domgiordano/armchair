"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/motion";

import styles from "./show-icon.module.css";

export type Show = "dwts" | "traitors" | "survivor";

/** Put on the row, card or link around an icon: hovering, focusing or pressing it plays the animation. */
export const ICON_TRIGGER = styles.trigger;

interface ShowIconProps {
  show: Show;
  size?: number;
  locked?: boolean;
  className?: string;
}

const GLOW: Record<Show, string> = {
  dwts: "rgb(243 217 139 / 0.55)",
  traitors: "rgb(255 181 71 / 0.5)",
  survivor: "rgb(255 140 60 / 0.55)",
};

/** A show's app icon. Decorative: the show's name always sits beside it. */
export function ShowIcon({ show, size = 44, locked = false, className = "" }: ShowIconProps) {
  const still = useReducedMotion();
  const id = useId().replace(/[^\w-]/g, "");
  const Art = ART[show];
  return (
    <span
      className={`${styles.icon} ${locked ? styles.locked : ""} ${className}`}
      style={{ width: size, height: size, "--glow": GLOW[show] } as CSSProperties}
      data-show={show}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64">
        <defs>
          <clipPath id={`${id}-tile`}>
            <rect width="64" height="64" rx="14.4" />
          </clipPath>
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbea" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#fffbea" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbea" stopOpacity="0.4" />
            <stop offset="0.35" stopColor="#fffbea" stopOpacity="0.06" />
            <stop offset="1" stopColor="#fffbea" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${id}-tile)`}>
          <Art id={id} fx={!still} rings={size < 40 ? 5 : size < 64 ? 7 : 9} />
          <rect width="64" height="32" fill={`url(#${id}-gloss)`} />
        </g>
        <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="none" stroke={`url(#${id}-edge)`} />
      </svg>
      {locked && size >= 36 && (
        <span className={styles.lock}>
          <svg viewBox="0 0 16 16">
            <rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="currentColor" />
            <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      )}
    </span>
  );
}

interface ArtProps {
  id: string;
  /** False under reduced motion: the particles are left out, not just paused. */
  fx: boolean;
  rings: number;
}

const ART: Record<Show, (p: ArtProps) => ReactNode> = {
  dwts: MirrorBall,
  traitors: Candle,
  survivor: Torch,
};

const vars = (v: Record<string, string | number>) => v as CSSProperties;

// Four-point star used for glints and sparkles, centred on 0,0 at radius 1.
const STAR = "M0 -1 C0.1 -0.25 0.25 -0.1 1 0 C0.25 0.1 0.1 0.25 0 1 C-0.1 0.25 -0.25 0.1 -1 0 C-0.25 -0.1 -0.1 -0.25 0 -1 Z";

const BALL = { cx: 32, cy: 35, r: 19 };
const deg = Math.PI / 180;
const round = (n: number) => Math.round(n * 100) / 100;
const TONES = ["#c9d0e6", "#9aa4c8", "#e3e7f3", "#6f7aa3", "#b4bcd9", "#dfe3f0", "#8a94bb", "#d8cba2"];

interface Facet {
  y: number;
  h: number;
  w: number;
  r: number;
  lon: number;
  k: number;
  fill: string;
}

// Square mirrors over the whole sphere, laid out by latitude ring. Each one sits
// at a longitude; the CSS turns --ball-spin into its x offset and foreshortening,
// so the ball really rotates and the back half folds away to nothing.
function facets(rings: number): Facet[] {
  const { cy, r } = BALL;
  const band = 180 / rings;
  const out: Facet[] = [];
  for (let i = 0; i < rings; i++) {
    const lat0 = -90 + i * band;
    const mid = lat0 + band / 2;
    const top = cy - r * Math.sin((lat0 + band) * deg);
    const bottom = cy - r * Math.sin(lat0 * deg);
    const rc = r * Math.cos(mid * deg);
    const count = Math.max(4, Math.round((360 * Math.cos(mid * deg)) / band));
    const step = 360 / count;
    for (let j = 0; j < count; j++) {
      out.push({
        y: round(top + 0.35),
        h: round(bottom - top - 0.7),
        w: round(rc * step * deg * 0.84),
        r: round(rc),
        lon: round(j * step + (i % 2 ? step / 2 : 0)),
        // Upper rings face the key light; the lower ones barely flash.
        k: round(0.35 + (0.65 * i) / (rings - 1)),
        fill: TONES[(i * 7 + j * 5 + ((i * j) % 3)) % TONES.length],
      });
    }
  }
  return out;
}

const FACETS: Record<number, Facet[]> = { 5: facets(5), 7: facets(7), 9: facets(9) };

const SPECKS = [
  { x: 18, y: 27, dx: -10, dy: -12, d: 0 },
  { x: 47, y: 30, dx: 12, dy: -9, d: 0.45 },
  { x: 43, y: 49, dx: 11, dy: 10, d: 0.9 },
  { x: 20, y: 46, dx: -11, dy: 9, d: 1.2 },
];

const SPOTS = [
  [9, 14, 1.1],
  [55, 20, 0.9],
  [8, 50, 0.8],
  [57, 52, 1.2],
  [47, 8, 0.7],
  [16, 60, 0.7],
] as const;

function MirrorBall({ id, fx, rings }: ArtProps) {
  const { cx, cy, r } = BALL;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#22357f" />
          <stop offset="0.55" stopColor="#0d1748" />
          <stop offset="1" stopColor="#050a24" />
        </linearGradient>
        <radialGradient id={`${id}-spot`} cx="0.5" cy="0" r="0.75">
          <stop offset="0" stopColor="#f3d98b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f3d98b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx="0.36" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#050a24" stopOpacity="0" />
          <stop offset="0.5" stopColor="#050a24" stopOpacity="0.1" />
          <stop offset="0.8" stopColor="#050a24" stopOpacity="0.5" />
          <stop offset="1" stopColor="#050a24" stopOpacity="0.88" />
        </radialGradient>
        <radialGradient id={`${id}-bloom`}>
          <stop offset="0" stopColor="#fffbea" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fffbea" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-ball`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <rect width="64" height="64" fill={`url(#${id}-bg)`} />
      <rect width="64" height="64" fill={`url(#${id}-spot)`} />
      <g className={styles.spots}>
        {SPOTS.map(([x, y, s]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={s} fill="#f7e2a4" />
        ))}
      </g>
      <path d={`M${cx} 0V${cy - r}`} stroke="#d9c79a" strokeWidth="1.1" />
      <rect x={cx - 2.2} y={cy - r - 2} width="4.4" height="3" rx="0.8" fill="#b8892f" />
      <circle cx={cx} cy={cy} r={r + 0.4} fill="#0a0f2c" />
      <g clipPath={`url(#${id}-ball)`}>
        <g className={styles.ball}>
          {FACETS[rings].map((f, i) => (
            <g key={i} className={styles.facet} style={vars({ "--lon": `${f.lon}deg`, "--r": `${f.r}px`, "--k": f.k })}>
              <rect x={-f.w / 2} y={f.y} width={f.w} height={f.h} rx="0.4" fill={f.fill} />
              <rect x={-f.w / 2} y={f.y} width={f.w} height={f.h} rx="0.4" className={styles.flash} />
            </g>
          ))}
        </g>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-shade)`} />
        <circle cx={cx - 7} cy={cy - 8} r="9" fill={`url(#${id}-bloom)`} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3d98b" strokeOpacity="0.35" strokeWidth="0.6" />
      <g transform={`translate(${cx - 7} ${cy - 8}) scale(6)`}>
        <path className={styles.glint} d={STAR} fill="#fffbea" />
      </g>
      {fx && (
        <g className={styles.fx}>
          {SPECKS.map((s) => (
            <circle
              key={s.x}
              className={styles.speck}
              cx={s.x}
              cy={s.y}
              r="1.2"
              fill="#fff4d6"
              style={vars({ "--dx": `${s.dx}px`, "--dy": `${s.dy}px`, animationDelay: `${s.d}s` })}
            />
          ))}
          <g transform="translate(55 42) scale(4)">
            <path className={styles.sparkle} d={STAR} fill="#f3d98b" />
          </g>
          <g transform="translate(9 25) scale(3)">
            <path className={styles.sparkle} d={STAR} fill="#fffbea" style={{ animationDelay: "0.5s" }} />
          </g>
        </g>
      )}
    </>
  );
}

function Flame({ id, x, y, s }: { id: string; x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={styles.grow}>
        <g className={styles.breathe}>
          <g className={styles.flicker}>
            <path d="M0 -14 C4.5 -8 6.5 -4 5 0.5 C4 3.4 -4 3.4 -5 0.5 C-6.5 -4 -4.5 -8 0 -14 Z" fill={`url(#${id}-flame)`} />
            <path d="M0 -7 C2.2 -4 2.6 -1.6 1.8 0.6 C1.2 1.8 -1.2 1.8 -1.8 0.6 C-2.6 -1.6 -2.2 -4 0 -7 Z" fill="#fff6dc" />
          </g>
        </g>
      </g>
    </g>
  );
}

function FlameDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff7a2e" />
        <stop offset="0.45" stopColor="#ffb547" />
        <stop offset="1" stopColor="#ffe08a" />
      </linearGradient>
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor="#ffb547" stopOpacity="0.6" />
        <stop offset="0.45" stopColor="#ff8a2e" stopOpacity="0.18" />
        <stop offset="1" stopColor="#ff8a2e" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

function Glow({ id, x, y, r }: { id: string; x: number; y: number; r: number }) {
  return (
    <g className={styles.glow} style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-glow)`} />
    </g>
  );
}

function Candle({ id }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#173d29" />
          <stop offset="0.6" stopColor="#0a1f14" />
          <stop offset="1" stopColor="#030a06" />
        </linearGradient>
        <linearGradient id={`${id}-cloak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c2016" />
          <stop offset="1" stopColor="#020604" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb547" stopOpacity="0.05" />
          <stop offset="0.6" stopColor="#ffb547" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={`${id}-void`} cx="0.5" cy="0.75" r="0.7">
          <stop offset="0" stopColor="#3a1e06" />
          <stop offset="0.5" stopColor="#0c0602" />
          <stop offset="1" stopColor="#010302" />
        </radialGradient>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9b98f" />
          <stop offset="0.45" stopColor="#f6ecd2" />
          <stop offset="1" stopColor="#a8976c" />
        </linearGradient>
        <FlameDefs id={id} />
      </defs>
      <rect width="64" height="64" fill={`url(#${id}-bg)`} />
      <Glow id={id} x={32} y={31} r={26} />
      <path
        d="M4 64 C6 53 12 47 17 44 C16 30 21 16 32 9 C43 16 48 30 47 44 C52 47 58 53 60 64 Z"
        fill={`url(#${id}-cloak)`}
      />
      <path
        d="M4 64 C6 53 12 47 17 44 C16 30 21 16 32 9 C43 16 48 30 47 44 C52 47 58 53 60 64"
        fill="none"
        stroke="#ffb547"
        strokeOpacity="0.18"
        strokeWidth="0.8"
      />
      <path d="M32 17 C25 21 23 30 24 38 C26 45 38 45 40 38 C41 30 39 21 32 17 Z" fill={`url(#${id}-void)`} />
      <path
        className={styles.rim}
        d="M32 17 C25 21 23 30 24 38 C26 45 38 45 40 38 C41 30 39 21 32 17 Z"
        fill="none"
        stroke={`url(#${id}-rim)`}
        strokeWidth="1.1"
      />
      <path d="M26 57 h12 l-1.5 -16.5 c0 -1 -9 -1 -9 0 Z" fill={`url(#${id}-wax)`} />
      <path d="M27.6 41 c0 3 1.4 3.6 1.4 6 c0 1.4 1.6 1.4 1.6 0 v-6.3 Z" fill="#fdf5e0" opacity="0.85" />
      <ellipse cx="32" cy="57.5" rx="10" ry="2.4" fill="#8a6a2a" />
      <ellipse cx="32" cy="57" rx="8" ry="1.6" fill="#d4a94c" />
      <path d="M32 40.4v-2.2" stroke="#2a1d10" strokeWidth="0.9" strokeLinecap="round" />
      <Flame id={id} x={32} y={38.6} s={1} />
    </>
  );
}

const EMBERS = [
  { x: 30, dx: -5, d: 0, s: 1 },
  { x: 34, dx: 6, d: 0.35, s: 0.8 },
  { x: 32, dx: -2, d: 0.7, s: 1.1 },
  { x: 29, dx: 4, d: 1.05, s: 0.7 },
  { x: 35, dx: -6, d: 1.4, s: 0.9 },
];

// A palm frond as one silhouette: a drooping rib whose leaflets sweep toward the tip.
function frond(bx: number, by: number, angle: number, len: number, bend: number): string {
  const a = angle * deg;
  const ex = bx + Math.cos(a) * len;
  const ey = by - Math.sin(a) * len;
  const qx = (bx + ex) / 2 - Math.sin(a) * bend;
  const qy = (by + ey) / 2 - Math.cos(a) * bend;
  const at = (t: number) => [
    (1 - t) ** 2 * bx + 2 * (1 - t) * t * qx + t * t * ex,
    (1 - t) ** 2 * by + 2 * (1 - t) * t * qy + t * t * ey,
  ];
  const n = 10;
  const rib = Array.from({ length: n + 1 }, (_, k) => at(k / n));
  const side = (dir: number) =>
    rib.slice(1).map(([x, y], k) => {
      const [px, py] = rib[k];
      const dx = x - px;
      const dy = y - py;
      const m = Math.hypot(dx, dy);
      const leaf = 9 * Math.sin(Math.PI * (0.1 + (0.85 * (k + 1)) / n));
      return `L${round(x + (-dy / m) * leaf * dir + (dx / m) * leaf * 0.7)} ${round(y + (dx / m) * leaf * dir + (dy / m) * leaf * 0.7)}L${round(x)} ${round(y)}`;
    });
  const back = side(-1).reverse().map((seg) => seg.split("L").filter(Boolean).reverse().map((p) => `L${p}`).join(""));
  return `M${round(bx)} ${round(by)}${side(1).join("")}${back.join("")}Z`;
}

const FRONDS = [frond(-4, 70, 50, 34, 9), frond(-6, 58, 18, 30, 7), frond(4, 72, 82, 30, 11)];

function Torch({ id, fx }: ArtProps) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8571c" />
          <stop offset="0.45" stopColor="#7a2a0c" />
          <stop offset="1" stopColor="#0d1a0c" />
        </linearGradient>
        <linearGradient id={`${id}-pole`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a3a14" />
          <stop offset="0.5" stopColor="#b08a4a" />
          <stop offset="1" stopColor="#4a2e0e" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor="#ffb05a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb05a" stopOpacity="0" />
        </radialGradient>
        <FlameDefs id={id} />
      </defs>
      <rect width="64" height="64" fill={`url(#${id}-bg)`} />
      <rect y="28" width="64" height="36" fill={`url(#${id}-sun)`} />
      <Glow id={id} x={32} y={19} r={24} />
      <g className={styles.frondL}>
        {FRONDS.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? "#0e2a12" : "#1a4420"} />
        ))}
      </g>
      <g transform="matrix(-1 0 0 1 64 0)">
        <g className={styles.frondR}>
          {FRONDS.map((d, i) => (
            <path key={i} d={d} fill={i % 2 ? "#1a4420" : "#0e2a12"} />
          ))}
        </g>
      </g>
      <rect x="29.6" y="33" width="4.8" height="32" rx="1" fill={`url(#${id}-pole)`} />
      {[41, 50, 59].map((y) => (
        <rect key={y} x="29.2" y={y} width="5.6" height="1.4" rx="0.5" fill="#3a2208" />
      ))}
      <path d="M23.5 24 h17 l-3 10 h-11 Z" fill="#6b3d12" />
      <path
        d="M24.4 26.5 h15.2 M25.2 29 h13.6 M26 31.5 h12 M28 24 l1.2 10 M32 24 v10 M36 24 l-1.2 10"
        stroke="#3a1f06"
        strokeWidth="0.7"
      />
      <path d="M23 23.4 h18" stroke="#8a5420" strokeWidth="1.6" strokeLinecap="round" />
      <Flame id={id} x={32} y={24} s={1.25} />
      {fx && (
        <g className={styles.fx}>
          {EMBERS.map((e) => (
            <circle
              key={e.x + e.d}
              className={styles.ember}
              cx={e.x}
              cy={12}
              r={e.s}
              fill="#ffd27a"
              style={vars({ "--dx": `${e.dx}px`, animationDelay: `${e.d}s` })}
            />
          ))}
        </g>
      )}
    </>
  );
}
