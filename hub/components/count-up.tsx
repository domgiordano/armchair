"use client";

import { useEffect, useRef } from "react";

import { onceInView } from "@/lib/intro-state";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export const COUNT_MS = 1600;

const fmt = (n: number) => n.toLocaleString("en-US");

interface CountUpProps {
  value: number;
}

/** Renders `value`, and counts up to it from 0 the first time it scrolls into view. */
export function CountUp({ value }: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    // Written straight to the DOM: a state update per frame would re-render the strip 100 times.
    el.textContent = "0";
    let frame = 0;
    const stop = onceInView(el, () => {
      let start: number | undefined;
      const tick = (now: number) => {
        start ??= now;
        const t = Math.min((now - start) / COUNT_MS, 1);
        el.textContent = fmt(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => {
      stop();
      cancelAnimationFrame(frame);
      el.textContent = fmt(value);
    };
  }, [value, reduced]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {fmt(value)}
      </span>
      <span className="sr-only">{fmt(value)}</span>
    </>
  );
}
