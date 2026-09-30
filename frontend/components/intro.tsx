"use client";

import { getImageProps } from "next/image";
import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

import styles from "./intro.module.css";

// Scene length in ms; intro.module.css and the 3D timeline are both timed against it.
const LENGTH = 5200;

function probeWebGL() {
  if (typeof window.WebGLRenderingContext === "undefined") return false;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  // Hand the probe context back now; iOS caps how many a page may hold.
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return gl !== null;
}

let webglCache: boolean | undefined;
const hasWebGL = () => (webglCache ??= probeWebGL());
const noSubscribe = () => () => {};

// three.js and friends stay out of the landing bundle. A chunk that fails to
// download falls back to the 2D ballroom instead of an empty stage.
const Scene = lazy(() =>
  import("./intro-scene/intro-scene").then(
    (m) => ({ default: m.IntroScene }),
    () => ({ default: Ballroom }),
  ),
);

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
// Offsets from the mirror ball: out across the room (vw/vh), then in to the wordmark.
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

/** The ballroom intro: a real-time mirror ball scene where WebGL allows, the 2D ballroom where not. */
export function Intro({ onDone }: IntroProps) {
  const [start] = useState(() => performance.now());
  // Undecided on the server and through hydration, so neither backdrop is baked into the HTML.
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => null);

  useEffect(() => {
    const id = setTimeout(onDone, LENGTH);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <section aria-label="Intro" data-stage={webgl === null ? undefined : webgl ? "3d" : "2d"} className={styles.scene}>
      {webgl === null ? null : webgl ? (
        <>
          <Poster />
          <Suspense>
            <Scene start={start} />
          </Suspense>
        </>
      ) : (
        <Ballroom />
      )}

      <div className={styles.finale}>
        <p className={styles.wordmark}>
          <span className="text-chrome">armchair judge</span>
        </p>
      </div>

      <button type="button" aria-label="Skip intro" onClick={onDone} className={styles.skip}>
        Skip
      </button>
    </section>
  );
}

/** The 2D ballroom: CSS mirror ball, sweeping beams, sparkles, paddles. */
function Ballroom() {
  return (
    <>
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

      <div aria-hidden="true" className={styles.paddles}>
        {[10, 10, 10].map((n, i) => (
          <span key={i} className={styles.paddle} style={{ animationDelay: `${3050 + i * 110}ms` }}>
            <span className={styles.face}>{n}</span>
          </span>
        ))}
      </div>
    </>
  );
}

// A still of the scene's opening, shown until the WebGL chunk has loaded and drawn.
function Poster() {
  const common = { alt: "", unoptimized: true, priority: true };
  const portrait = getImageProps({ ...common, src: "/intro/poster-portrait.webp", width: 780, height: 1688 }).props;
  const { props } = getImageProps({ ...common, src: "/intro/poster.webp", width: 1600, height: 1000 });
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={portrait.srcSet ?? portrait.src} />
      <img {...props} alt="" className={styles.poster} />
    </picture>
  );
}
