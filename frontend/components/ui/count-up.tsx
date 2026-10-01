"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  /** Milliseconds. */
  duration?: number;
}

const noop = () => () => {};

const animates = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that counts up from zero when it first shows. Lands on the exact value; still under reduced motion. */
export function CountUp({ value, format = String, duration = 900 }: CountUpProps) {
  const still = useSyncExternalStore(noop, () => !animates(), () => true);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease out: fast at first, settling onto the number.
      setShown(t === 1 ? value : value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, still]);

  return <>{format(still || shown === value ? value : roundLike(shown, value))}</>;
}

// Mid-count values carry the final value's decimals, so 1.05 counts 0.00, 0.37... not 0.3712.
function roundLike(n: number, target: number) {
  const places = (String(target).split(".")[1] ?? "").length;
  return Number(n.toFixed(places));
}
