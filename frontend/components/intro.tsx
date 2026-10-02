"use client";

import { getImageProps } from "next/image";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type CSSProperties } from "react";

import { DiscoLoader } from "@/components/disco-loader";
import { likelySignedIn } from "@armchair/app-core/auth/session-hint";
import ball from "./intro-assets/ball.webp";
import poster from "./intro-assets/poster.webp";
import posterPortrait from "./intro-assets/poster-portrait.webp";
import styles from "./intro.module.css";

// Scene length in ms, counted from the first drawn frame; intro.module.css and
// the 3D timeline are both timed against the same start.
const LENGTH = 5800;
// How long the poster may wait, once the 3D chunk has arrived, for the scene's
// first frame before the 2D ballroom plays instead. A slow download never
// counts against it: the chunk is ~1 MB and a cold phone can take longer than
// this just to fetch it.
const PATIENCE = 8000;
const SCORES = [9, 10, 10];
const CARD_DELAYS = [3200, 3550, 3900];

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

interface SceneProps {
  onReady: () => void;
  onFail: () => void;
}

function ChunkFailed({ onFail }: SceneProps) {
  useEffect(onFail, [onFail]);
  return null;
}

const loadScene = () => import("./intro-scene/intro-scene");
let pending: ReturnType<typeof loadScene> | undefined;
const sceneModule = () => (pending ??= loadScene());

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// Start the download while the auth check runs, not after it mounts the intro.
// A failure is handled where Scene reads the same promise.
if (typeof window !== "undefined" && !reducedMotion() && !likelySignedIn()) sceneModule().catch(() => {});

// three.js and friends stay out of the landing bundle. A chunk that fails to
// download falls back to the 2D ballroom instead of an empty stage.
const Scene = lazy<ComponentType<SceneProps>>(() =>
  sceneModule().then(
    (m) => ({ default: m.IntroScene }),
    () => ({ default: ChunkFailed }),
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
    delay: 150 + i * 22 + next() * 200,
    gold: i % 3 === 0,
  };
});

const BEAMS = [
  { from: -58, to: 18, gold: true },
  { from: -20, to: 46, gold: false },
  { from: 30, to: -34, gold: true },
  { from: 62, to: -6, gold: false },
];

// Tiles on the ball that catch the light in turn, as % of the ball's box.
const GLINTS = [
  { x: 64, y: 38, size: 1, delay: 0 },
  { x: 22, y: 52, size: 0.8, delay: 700 },
  { x: 56, y: 71, size: 0.7, delay: 1300 },
  { x: 84, y: 61, size: 0.9, delay: 400 },
  { x: 36, y: 17, size: 0.75, delay: 1000 },
  { x: 76, y: 24, size: 0.6, delay: 1650 },
];

/**
 * The ballroom intro: a real-time scene where WebGL allows, the 2D ballroom
 * where not. The static HTML opens on the load-in (the mirror ball loader on
 * the navy stage), which gives way to a poster of the scene's opening frame.
 * The scene takes over once it has compiled and drawn that same frame; the 2D
 * ballroom once its ball sprite, cut from that frame, has loaded.
 */
export function Intro({ onDone }: IntroProps) {
  // Undecided on the server and through hydration, so neither backdrop is baked into the HTML.
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => null);
  const [fallback, setFallback] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [ready, setReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const stage = webgl === null ? null : webgl && !fallback ? "3d" : "2d";
  const playing = stage === "2d" ? spriteLoaded : ready;
  const posterShown = stage !== null && posterLoaded;

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFallback(true), []);
  const onArrive = useCallback(() => setArrived(true), []);
  const onPosterLoad = useCallback(() => setPosterLoaded(true), []);
  // A sprite that fails to load still lets the show go on, ball or no ball.
  const onSprite = useCallback(() => setSpriteLoaded(true), []);

  useEffect(() => {
    if (stage !== "3d" || !arrived || ready) return;
    const id = setTimeout(onFail, PATIENCE);
    return () => clearTimeout(id);
  }, [stage, arrived, ready, onFail]);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(onDone, LENGTH);
    return () => clearTimeout(id);
  }, [playing, onDone]);

  return (
    <section
      aria-label="Intro"
      data-stage={stage ?? undefined}
      data-playing={playing || undefined}
      data-loaded={posterShown || playing || undefined}
      className={styles.scene}
    >
      <div className={styles.loadin}>
        <span aria-hidden="true" className={styles.cord} />
        <DiscoLoader size="lg" label="Loading the intro" />
      </div>
      {/* In the static HTML too, so it downloads alongside the JS rather than after it. */}
      <Poster shown={posterShown} onLoad={onPosterLoad} />
      {stage === "3d" && (
        <Suspense>
          <Scene onReady={onReady} onFail={onFail} />
          <Arrived onArrive={onArrive} />
        </Suspense>
      )}
      {stage === "2d" && !spriteLoaded && (
        // eslint-disable-next-line @next/next/no-img-element -- a hidden preload, not content; next/image defers onLoad behind decode()
        <img src={sprite} alt="" hidden onLoad={onSprite} onError={onSprite} />
      )}
      {stage === "2d" && spriteLoaded && <Ballroom />}

      {playing && (
        <>
          <div aria-hidden="true" className={styles.total}>
            <span className={styles.label}>Total</span>
            <span className={styles.sum}>29</span>
          </div>
          <div className={styles.finale}>
            <p className={styles.wordmark}>
              <span className="text-chrome">armchair judge</span>
            </p>
          </div>
        </>
      )}

      <button type="button" aria-label="Skip intro" onClick={onDone} className={styles.skip}>
        Skip
      </button>
    </section>
  );
}

interface ArrivedProps {
  onArrive: () => void;
}

// Commits alongside the lazy scene, so its effect runs once the chunk is in.
function Arrived({ onArrive }: ArrivedProps) {
  useEffect(onArrive, [onArrive]);
  return null;
}

/** Twinkles over the ball's tiles, so a still of it doesn't read as frozen. */
function Glints() {
  return (
    <span aria-hidden="true" className={styles.glints}>
      {GLINTS.map((g, i) => (
        <span
          key={i}
          className={styles.glint}
          style={{ left: `${g.x}%`, top: `${g.y}%`, "--size": g.size, animationDelay: `${g.delay}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}

const sprite = getImageProps({ src: ball, alt: "", width: 400, height: 400, unoptimized: true }).props.src;

/** The 2D ballroom: the 3D scene's ball as a sprite over the same room, beams, sparkles, paddles. */
function Ballroom() {
  return (
    <>
      <div aria-hidden="true" className={styles.floor} />
      <div aria-hidden="true" className={styles.bulbs} />

      <div aria-hidden="true" className={styles.rig}>
        <span className={`${styles.cone} ${styles.gold}`} style={{ "--tilt": "47deg" } as CSSProperties} />
        <span className={styles.cone} style={{ "--tilt": "-47deg" } as CSSProperties} />
        {BEAMS.map((b, i) => (
          <span
            key={i}
            className={`${styles.beam} ${b.gold ? styles.gold : ""}`}
            style={{ "--from": `${b.from}deg`, "--to": `${b.to}deg` } as CSSProperties}
          />
        ))}
        <div className={styles.ball}>
          <span className={styles.chain} />
          <span className={styles.sphere} style={{ backgroundImage: `url(${sprite})` }} />
          <Glints />
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
        {SCORES.map((n, i) => (
          <span key={i} className={styles.paddle} style={{ animationDelay: `${CARD_DELAYS[i]}ms` }}>
            <span className={styles.face}>{n}</span>
          </span>
        ))}
      </div>
    </>
  );
}

interface PosterProps {
  shown: boolean;
  onLoad: () => void;
}

// A still of the scene's opening frame, fading up over the load-in once it has
// loaded and hydration has picked a stage. The scene draws that same frame over
// it, or the 2D room fades in from it. Regenerate it whenever the scene's t=0
// changes, or the swap shows a jump. Imported rather than served from public/,
// so a new poster gets a new hashed URL and no browser keeps the old one.
function Poster({ shown, onLoad }: PosterProps) {
  const img = useRef<HTMLImageElement>(null);
  // Lazy: still fetched at first layout, while the JS downloads, but never for
  // the stage hidden from signed-in or reduced-motion visitors.
  const common = { alt: "", unoptimized: true, loading: "lazy" as const, fetchPriority: "high" as const };
  const portrait = getImageProps({ ...common, src: posterPortrait, width: 780, height: 1688 }).props;
  const { props } = getImageProps({ ...common, src: poster, width: 1600, height: 1000 });

  // A poster that finished loading before hydration fired its load event before React was listening.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) onLoad();
  }, [onLoad]);

  return (
    <>
      <picture>
        <source media="(orientation: portrait)" srcSet={portrait.srcSet ?? portrait.src} />
        <img {...props} ref={img} alt="" onLoad={onLoad} data-shown={shown || undefined} className={styles.poster} />
      </picture>
      {shown && (
        <div aria-hidden="true" className={styles.still}>
          <Glints />
        </div>
      )}
    </>
  );
}
