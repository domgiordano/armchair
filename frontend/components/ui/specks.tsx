"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Where the mirror ball throws its light: x and y in % of the viewport, size in px,
// drift in px, and the cycle. Fixed, so every render and reload agrees.
const SPECKS = [
  [6, 12, 5, 18, -14, 11, 0, true],
  [18, 64, 3, 22, 10, -16, 3, false],
  [27, 28, 4, 16, 18, 9, 7, false],
  [38, 82, 6, 25, -12, -18, 2, true],
  [47, 9, 3, 19, 14, 12, 9, false],
  [55, 47, 4, 23, -16, 8, 5, false],
  [63, 71, 3, 17, 12, -10, 11, true],
  [71, 21, 5, 21, -10, 14, 1, false],
  [79, 56, 3, 26, 16, -12, 8, false],
  [86, 33, 4, 20, -14, -9, 4, true],
  [93, 77, 5, 24, 10, 16, 6, false],
  [12, 39, 3, 27, 12, 10, 12, false],
  [33, 52, 2, 15, -8, -14, 10, false],
  [59, 92, 4, 22, 14, -8, 13, false],
  [88, 6, 3, 18, -12, 12, 14, true],
] as const;

/**
 * Light specks drifting over the page background, as if from a mirror ball.
 * CSS only; paused while the tab is hidden; still under reduced motion.
 */
export function Specks() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-paused={hidden || undefined}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden data-paused:*:[animation-play-state:paused]"
    >
      <span className="absolute -top-1/3 left-1/4 h-[80vh] w-[40vw] origin-top bg-[radial-gradient(ellipse_at_top,rgb(59_91_255/0.09),transparent_65%)] [animation:sweep_26s_ease-in-out_infinite]" />
      <span className="absolute -top-1/3 right-1/5 h-[70vh] w-[34vw] origin-top bg-[radial-gradient(ellipse_at_top,rgb(232_194_104/0.06),transparent_65%)] [animation:sweep_31s_ease-in-out_-9s_infinite_reverse]" />
      {SPECKS.map(([x, y, size, cycle, dx, dy, delay, gold], i) => (
        <span
          key={i}
          className={`absolute rounded-full ${gold ? "bg-gold-light" : "bg-silver"} shadow-[0_0_8px_2px_currentColor] ${gold ? "text-gold/60" : "text-silver/50"}`}
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              animation: `speck ${cycle}s ease-in-out ${-delay}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
