"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { ChairLoader } from "@/components/chair-loader";

// When the exit fade in app/intro.css finishes.
export const INTRO_MS = 5200;

// three.js and friends load only when the intro plays; the landing never pays for them.
const IntroScene = dynamic(() => import("@/components/intro-3d/scene").then((m) => m.IntroScene), { ssr: false });

const wanted = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let webgl: boolean | undefined;
function hasWebGL(): boolean {
  if (webgl === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl = gl != null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webgl;
}

const noSubscribe = () => () => {};

// A GPU that fails mid-setup (context creation, shader compile) leaves the
// static mark on stage instead of taking the landing down with it.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Intro() {
  // Plays on every load. The server can't read the motion preference, so the
  // static HTML carries the stage and app/intro.css hides it under reduced motion.
  const play = useSyncExternalStore(noSubscribe, wanted, () => true);
  const webglOk = useSyncExternalStore(noSubscribe, hasWebGL, () => false);
  const [ended, setEnded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const showing = play && !ended;

  const end = () => {
    // A keyboard user on Skip would be left focused on nothing once it unmounts.
    refocus.current = document.activeElement?.closest(".intro") != null;
    setEnded(true);
  };
  const timeUp = useEffectEvent(end);

  // The CSS copy started with the first paint, before any JS; the 3D clock
  // starts from the same moment so the two stay in step on a slow load.
  const origin = () => {
    const start = root.current?.getAnimations?.()[0]?.startTime;
    return typeof start === "number" ? start : performance.now();
  };

  useEffect(() => {
    if (!showing) return;
    const html = document.documentElement;
    // #page wraps header, main and footer; all of it sits under the stage.
    const page = document.getElementById("page");
    const main = document.getElementById("main");
    html.style.overflow = "hidden";
    page?.setAttribute("inert", "");
    const timer = window.setTimeout(timeUp, INTRO_MS);
    return () => {
      window.clearTimeout(timer);
      html.style.overflow = "";
      page?.removeAttribute("inert");
      if (refocus.current) main?.focus();
    };
  }, [showing]);

  if (!showing) return null;

  return (
    <div ref={root} className="intro" data-scene={sceneReady ? "ready" : undefined} aria-label="Armchair Judge intro" role="region">
      {webglOk && (
        <SceneBoundary>
          <IntroScene origin={origin} onReady={() => setSceneReady(true)} />
        </SceneBoundary>
      )}
      <ChairLoader className="intro-poster" />
      <div className="intro-copy">
        <p className="intro-wordmark">
          <span className="sr-only">Armchair Judge</span>
          <span aria-hidden="true">Armchair</span>
          <span className="text-brand-gradient" aria-hidden="true">
            Judge
          </span>
        </p>
        <p className="intro-tagline">DISCOVER / WATCH / JUDGE</p>
      </div>
      <button type="button" className="intro-skip" onClick={end}>
        Skip
      </button>
    </div>
  );
}
