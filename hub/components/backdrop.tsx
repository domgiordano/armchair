import type { CSSProperties } from "react";

const ORBS = [
  { top: "-25vmax", left: "-20vmax", tint: "rgb(59 91 255 / 0.14)", dur: "38s", wait: "0s", dx: "18vw", dy: "14vh" },
  { top: "20vh", left: "55vw", tint: "rgb(232 63 208 / 0.1)", dur: "46s", wait: "-12s", dx: "-22vw", dy: "18vh" },
  { top: "60vh", left: "-15vw", tint: "rgb(122 44 255 / 0.12)", dur: "52s", wait: "-30s", dx: "25vw", dy: "-20vh" },
  { top: "75vh", left: "60vw", tint: "rgb(255 122 61 / 0.07)", dur: "44s", wait: "-6s", dx: "-15vw", dy: "-25vh" },
];

const STARS = [
  { top: "14%", left: "8%", wait: "0s" },
  { top: "32%", left: "88%", wait: "-1.4s" },
  { top: "58%", left: "18%", wait: "-2.6s" },
  { top: "72%", left: "76%", wait: "-3.3s" },
  { top: "86%", left: "42%", wait: "-4.1s" },
  { top: "22%", left: "52%", wait: "-0.7s" },
];

/** Fixed behind every page: slow brand-colour orbs and a faint sparkle field. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      {ORBS.map((o) => (
        <div
          key={o.tint}
          className="orb"
          style={
            { top: o.top, left: o.left, "--tint": o.tint, "--dur": o.dur, "--wait": o.wait, "--dx": o.dx, "--dy": o.dy } as CSSProperties
          }
        />
      ))}
      <div className="sparkle-field" />
      <div className="sparkle-field" />
      {STARS.map((s) => (
        <svg key={s.wait} viewBox="-10 -10 20 20" className="star" style={{ top: s.top, left: s.left, "--wait": s.wait } as CSSProperties}>
          <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z" />
        </svg>
      ))}
    </div>
  );
}
