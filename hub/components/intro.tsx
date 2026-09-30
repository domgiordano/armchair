"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { ChairMark } from "@/components/chair-mark";
import { INTRO_KEY } from "@/lib/intro";

// When the exit fade in app/intro.css finishes.
export const INTRO_MS = 5200;

const TAGLINE = "DISCOVER / WATCH / JUDGE";

function wanted(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return !window.sessionStorage.getItem(INTRO_KEY);
  } catch {
    // Storage blocked: play it, there is nowhere to remember that it played.
    return true;
  }
}

function remember() {
  try {
    window.sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked; the next page load plays it again.
  }
}

const noSubscribe = () => () => {};

export function Intro() {
  // The server can't know, so the static HTML carries the stage; the head
  // script hides it before paint when it won't play.
  const play = useSyncExternalStore(noSubscribe, wanted, () => true);
  const [ended, setEnded] = useState(false);
  const refocus = useRef(false);
  const showing = play && !ended;

  const end = () => {
    // A keyboard user on Skip would be left focused on nothing once it unmounts.
    refocus.current = document.activeElement?.closest(".intro") != null;
    // Only here, never in the effect cleanup: StrictMode's rehearsal cleanup
    // would mark it seen and the next render would drop the stage mid-play.
    remember();
    setEnded(true);
  };
  const timeUp = useEffectEvent(end);

  useEffect(() => {
    if (!showing) return;
    const root = document.documentElement;
    // #page wraps header, main and footer; all of it sits under the stage.
    const page = document.getElementById("page");
    const main = document.getElementById("main");
    root.style.overflow = "hidden";
    page?.setAttribute("inert", "");
    const timer = window.setTimeout(timeUp, INTRO_MS);
    return () => {
      window.clearTimeout(timer);
      root.style.overflow = "";
      page?.removeAttribute("inert");
      if (refocus.current) main?.focus();
    };
  }, [showing]);

  if (!showing) return null;

  return (
    <div className="intro" aria-label="Armchair Judge intro" role="region">
      <div className="intro-beam" aria-hidden="true" />
      <div className="intro-stage">
        <div className="intro-halo" aria-hidden="true" />
        <ChairMark className="intro-chair" />
        <p className="intro-wordmark">
          <span className="sr-only">Armchair Judge</span>
          <span className="intro-line" aria-hidden="true">
            <span>Armchair</span>
          </span>
          <span className="intro-line" aria-hidden="true">
            <span className="text-brand-gradient">Judge</span>
          </span>
        </p>
        <p className="intro-tagline">
          <span className="sr-only">Discover, watch, judge</span>
          {/* Holds the full width, so typing runs left to right without moving the line. */}
          <span className="intro-ghost" aria-hidden="true">
            {TAGLINE}
          </span>
          <span className="intro-typed" aria-hidden="true">
            {Array.from(TAGLINE, (ch, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {ch}
              </span>
            ))}
            <span className="intro-caret" />
          </span>
        </p>
      </div>
      <button type="button" className="intro-skip" onClick={end}>
        Skip
      </button>
    </div>
  );
}
