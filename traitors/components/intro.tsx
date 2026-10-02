"use client";

import { getImageProps } from "next/image";
import {
  type ComponentType,
  type CSSProperties,
  lazy,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Fallback } from "@/components/intro/fallback";
import { Loader } from "@/components/loader";
import { likelySignedIn } from "@armchair/app-core/auth/session-hint";
import poster from "./intro/poster.webp";
import posterPortrait from "./intro/poster-portrait.webp";
import styles from "./intro.module.css";

// Scene length in ms, counted from the first drawn frame; intro.module.css and
// intro/timeline.ts are both timed against the same start.
const LENGTH = 7000;
// How long the poster may wait, once the 3D chunk has arrived, for the scene's
// first frame before the 2D stage plays instead. A slow download never counts
// against it: the chunk is about 1 MB and a cold phone can take longer than
// this just to fetch it.
const PATIENCE = 8000;
// Burned in one letter at a time, so each is its own element.
const WORD = [..."Traitors"];

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
  title: RefObject<HTMLElement | null>;
}

function ChunkFailed({ onFail }: SceneProps) {
  useEffect(onFail, [onFail]);
  return null;
}

const loadScene = () => import("./intro/scene");
let pending: ReturnType<typeof loadScene> | undefined;
const sceneModule = () => (pending ??= loadScene());

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// Start the download while the auth check runs, not after it mounts the intro.
// A failure is handled where Scene reads the same promise.
if (typeof window !== "undefined" && !reducedMotion() && !likelySignedIn()) sceneModule().catch(() => {});

// three.js and friends stay out of the landing bundle. A chunk that fails to
// download falls back to the 2D stage instead of an empty one.
const Scene = lazy<ComponentType<SceneProps>>(() =>
  sceneModule().then(
    (m) => ({ default: m.IntroScene }),
    () => ({ default: ChunkFailed }),
  ),
);

interface IntroProps {
  onDone: () => void;
}

/**
 * The procession and the hood: a real-time scene where WebGL allows, a 2D stage where not.
 * The static HTML opens on the load-in (the hooded loader), which gives way to
 * a poster of the scene's opening frame. The scene takes over once it has
 * compiled and drawn that same frame.
 */
export function Intro({ onDone }: IntroProps) {
  // Undecided on the server and through hydration, so neither stage is baked into the HTML.
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => null);
  const [fallback, setFallback] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [ready, setReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const title = useRef<HTMLDivElement>(null);
  const stage = webgl === null ? null : webgl && !fallback ? "3d" : "2d";
  const playing = stage === "2d" || (stage === "3d" && ready);
  const posterShown = stage !== null && posterLoaded;

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFallback(true), []);
  const onArrive = useCallback(() => setArrived(true), []);
  const onPosterLoad = useCallback(() => setPosterLoaded(true), []);

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
        <Loader label="Loading the intro" />
      </div>
      {/* In the static HTML too, so it downloads alongside the JS rather than after it. */}
      <Poster shown={posterShown} onLoad={onPosterLoad} />
      {stage === "3d" && (
        <Suspense>
          <Scene onReady={onReady} onFail={onFail} title={title} />
          <Arrived onArrive={onArrive} />
        </Suspense>
      )}
      {stage === "2d" && <Fallback />}

      {playing && (
        <div ref={title} className={styles.title}>
          <p className={styles.word}>
            <span className="sr-only">Traitors</span>
            <span aria-hidden="true">
              {WORD.map((letter, i) => (
                <span key={i} className={styles.letter} style={{ "--i": i } as CSSProperties}>
                  {letter}
                </span>
              ))}
            </span>
          </p>
        </div>
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

interface PosterProps {
  shown: boolean;
  onLoad: () => void;
}

// A still of the scene's opening frame, fading up over the load-in once it has
// loaded and hydration has picked a stage. The scene draws that same frame over
// it, or the 2D stage fades in from it. Regenerate it whenever the scene's t=0
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
    <picture>
      <source media="(orientation: portrait)" srcSet={portrait.srcSet ?? portrait.src} />
      <img {...props} ref={img} alt="" onLoad={onLoad} data-shown={shown || undefined} className={styles.poster} />
    </picture>
  );
}
