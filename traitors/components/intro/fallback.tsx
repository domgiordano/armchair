import type { CSSProperties } from "react";

import styles from "./fallback.module.css";

// Seeded so the embers rise the same way on every visit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(11);
const EMBERS = Array.from({ length: 16 }, () => ({
  x: 18 + next() * 64,
  drift: (next() - 0.5) * 16,
  size: 2 + next() * 3,
  delay: next() * 5200,
  life: 2600 + next() * 2200,
}));

const CANDLES = [
  { x: 31, h: 7, delay: 0 },
  { x: 38, h: 4.5, delay: 400 },
  { x: 64, h: 6, delay: 250 },
  { x: 70, h: 3.5, delay: 650 },
];

const CLOAK =
  "M172 230 C150 236 126 246 116 268 C104 296 98 360 84 430 C72 490 58 550 46 600 L354 600 C342 550 328 490 316 430 C302 360 296 296 284 268 C274 246 250 236 228 230 Z";
const HOOD =
  "M200 88 C164 92 141 124 137 164 C134 196 129 224 110 254 C150 266 250 266 290 254 C271 224 266 196 263 164 C259 124 236 92 200 88 Z M200 116 C177 118 164 142 164 170 C164 201 179 224 200 232 C221 224 236 201 236 170 C236 142 223 118 200 116 Z";

/**
 * The intro without WebGL: the last shot of the scene in SVG and CSS. The lead
 * stands behind the table in candlelight, the hood falls on the scene's beat,
 * and the void opens where the title lands.
 */
export function Fallback() {
  return (
    <div aria-hidden="true" className={styles.room}>
      <div className={styles.backlight} />
      <svg viewBox="0 0 400 600" className={styles.figure}>
        <defs>
          <linearGradient id="fallback-cloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c1d13" />
            <stop offset="0.55" stopColor="#163522" />
            <stop offset="1" stopColor="#2c4a26" />
          </linearGradient>
          <linearGradient id="fallback-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.2" stopColor="#e9b949" stopOpacity="0" />
            <stop offset="1" stopColor="#ffd27a" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${200 + side * 150} 130) scale(0.62) translate(-200 0)`} className={styles.follower}>
            <path d={CLOAK} />
            <path d={HOOD} fillRule="evenodd" />
            <ellipse cx="200" cy="175" rx="40" ry="52" fill="#000" />
          </g>
        ))}
        <path d={CLOAK} fill="url(#fallback-cloak)" stroke="url(#fallback-rim)" strokeWidth="2" />
        <path d="M200 238 C198 330 202 450 199 600" fill="none" stroke="#06100a" strokeWidth="5" />
        <path
          d="M150 300 C140 380 128 470 112 600 M250 300 C260 380 272 470 288 600 M176 320 C172 420 168 520 160 600 M226 320 C230 420 234 520 240 600"
          fill="none"
          stroke="#08140d"
          strokeWidth="3"
          opacity="0.7"
        />
        <ellipse cx="200" cy="175" rx="40" ry="52" fill="#000" />
        <g className={styles.hood}>
          <path d={HOOD} fillRule="evenodd" fill="url(#fallback-cloak)" stroke="url(#fallback-rim)" strokeWidth="2" />
        </g>
      </svg>
      <div className={styles.void} />
      <div className={styles.table}>
        {CANDLES.map((c, i) => (
          <span key={i} className={styles.candle} style={{ "--x": `${c.x}%`, "--h": `${c.h}cqh` } as CSSProperties}>
            <span className={styles.flame} style={{ animationDelay: `${c.delay}ms` }} />
          </span>
        ))}
      </div>
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className={styles.ember}
          style={
            {
              "--x": `${e.x}%`,
              "--drift": `${e.drift}vw`,
              "--size": `${e.size}px`,
              animationDelay: `${e.delay}ms`,
              animationDuration: `${e.life}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
