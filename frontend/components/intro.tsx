"use client";

import Image from "next/image";
import { useEffect, type CSSProperties } from "react";

import styles from "./intro.module.css";

// Scene length in ms; intro.module.css times every keyframe against it.
const LENGTH = 5200;

interface IntroProps {
  onDone: () => void;
}

// Seeded so the scatter is the same on every visit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(35);
// Offsets from the mirror ball: out across the room (vw/vh), then in to the mark.
const SPARKLES = Array.from({ length: 34 }, (_, i) => {
  const angle = next() * Math.PI * 2;
  const reach = 22 + next() * 34;
  return {
    x: Math.cos(angle) * reach * 1.1,
    y: Math.sin(angle) * reach * 0.85 + 14,
    tx: (next() - 0.5) * 10,
    ty: 18 + (next() - 0.5) * 8,
    size: 1.6 + next() * 2.4,
    delay: 1300 + i * 22 + next() * 200,
    gold: i % 3 === 0,
  };
});

const BEAMS = [
  { from: -58, to: 18, gold: true },
  { from: -20, to: 46, gold: false },
  { from: 30, to: -34, gold: true },
  { from: 62, to: -6, gold: false },
];

const FACETS = Array.from({ length: 14 }, () => ({
  x: 18 + next() * 64,
  y: 16 + next() * 68,
  delay: next() * 900,
}));

// Evenly spaced polar angles, projected: latitudes at 50 - 48cos(a), longitudes rx 48sin(a).
const LATITUDES = [1, 2, 3, 4, 5, 6, 7].map((k) => 50 - 48 * Math.cos((k * Math.PI) / 8));
const LONGITUDES = [1, 2, 3].map((k) => 48 * Math.sin((k * Math.PI) / 8));

/** The ballroom intro: mirror ball, sweeping beams, sparkles that gather into the mark. */
export function Intro({ onDone }: IntroProps) {
  useEffect(() => {
    const id = setTimeout(onDone, LENGTH);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <section aria-label="Intro" className={styles.scene}>
      <div aria-hidden="true" className={styles.floor} />

      <div aria-hidden="true" className={styles.rig}>
        {BEAMS.map((b, i) => (
          <span
            key={i}
            className={`${styles.beam} ${b.gold ? styles.gold : ""}`}
            style={{ "--from": `${b.from}deg`, "--to": `${b.to}deg` } as CSSProperties}
          />
        ))}
        <div className={styles.ball}>
          <span className={styles.chain} />
          <svg viewBox="0 0 100 100" className={styles.sphere}>
            <defs>
              <radialGradient id="intro-silver" cx="36%" cy="30%" r="75%">
                <stop offset="0" stopColor="#f4f6fc" />
                <stop offset="0.35" stopColor="#c3cadc" />
                <stop offset="0.75" stopColor="#58627f" />
                <stop offset="1" stopColor="#1c2445" />
              </radialGradient>
              <clipPath id="intro-ball">
                <circle cx="50" cy="50" r="48" />
              </clipPath>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#intro-silver)" />
            <g clipPath="url(#intro-ball)" fill="none" stroke="#0d1535" strokeOpacity="0.55" strokeWidth="0.9">
              {LATITUDES.map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} />
              ))}
              <line x1="50" x2="50" y1="0" y2="100" />
              {LONGITUDES.map((rx) => (
                <ellipse key={rx} cx="50" cy="50" rx={rx} ry="48" />
              ))}
            </g>
            <g clipPath="url(#intro-ball)">
              {FACETS.map((f, i) => (
                <rect
                  key={i}
                  x={f.x}
                  y={f.y}
                  width="6"
                  height="6"
                  fill="#fdf6de"
                  className={styles.facet}
                  style={{ animationDelay: `${f.delay}ms` }}
                />
              ))}
            </g>
          </svg>
        </div>
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className={`${styles.sparkle} ${s.gold ? styles.gold : ""}`}
            style={
              {
                "--x": `${s.x}vw`,
                "--y": `${s.y}vh`,
                "--tx": `${s.tx}vmin`,
                "--ty": `${s.ty}vh`,
                "--size": s.size,
                animationDelay: `${s.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.finale}>
        <div className={styles.mark}>
          <Image src="/brand/mark-320.png" alt="" width={160} height={160} unoptimized priority />
        </div>
        <p className={styles.wordmark}>
          Armchair <span className="text-brand-gradient">Judge</span>
        </p>
        <div aria-hidden="true" className={styles.paddles}>
          {[10, 10, 10, 10].map((n, i) => (
            <span key={i} className={styles.paddle} style={{ animationDelay: `${4000 + i * 90}ms` }}>
              <span className={styles.face}>{n}</span>
            </span>
          ))}
        </div>
      </div>

      <button type="button" aria-label="Skip intro" onClick={onDone} className={styles.skip}>
        Skip
      </button>
    </section>
  );
}
