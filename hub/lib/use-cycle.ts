"use client";

import { useEffect, useRef, useState } from "react";

import { useIntroPlaying } from "@/lib/intro-state";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Steps a looping demo through `length` frames every `ms`, only while it is on
 * screen, not paused and not under the intro. Reduced motion holds frame 0.
 */
export function useCycle<T extends Element>(length: number, ms: number) {
  const ref = useRef<T>(null);
  const still = useReducedMotion();
  const covered = useIntroPlaying();
  const [paused, setPaused] = useState(false);
  // jsdom has no IntersectionObserver: count the demo as on screen there.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = seen && !paused && !still && !covered;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % length), ms);
    return () => window.clearInterval(timer);
  }, [running, length, ms]);

  // `seen` in the key replays the current frame's entrance when it scrolls back in.
  return { ref, index, still, paused, toggle: () => setPaused((p) => !p), frameKey: `${index}-${seen}-${covered}` };
}
