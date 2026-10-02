"use client";

import { useEffect, useState } from "react";

import { useMediaQuery } from "@/lib/motion";
import { cn } from "@/lib/ui";

import styles from "./landing.module.css";

// Invented names: an illustration, not anyone's game.
const NAMES = ["Morag", "Fergus", "Isla", "Hamish"];
// The votes in the order they're read out, as indexes into NAMES.
const READ = [0, 1, 0, 2, 0, 1, 3, 0, 2, 0, 1, 0];
const STEP = 650;
const HOLD = 3200;

/** How many votes have been read out, looping; all of them, still, for reduced motion. */
function useVotesRead() {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [read, setRead] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setRead((n) => (n >= READ.length + Math.round(HOLD / STEP) ? 0 : n + 1)), STEP);
    return () => clearInterval(id);
  }, [reduced]);
  return reduced ? READ.length : Math.min(read, READ.length);
}

const HOODS = [
  { x: 92, s: 0.82 },
  { x: 176, s: 0.92 },
  { x: 262, s: 1 },
  { x: 348, s: 0.92 },
  { x: 432, s: 0.82 },
];

const HOOD = "M0 -112 C-22 -110 -36 -88 -38 -62 C-40 -44 -44 -30 -62 -16 C-74 -6 -80 6 -82 20 L82 20 C80 6 74 -6 62 -16 C44 -30 40 -44 38 -62 C36 -88 22 -110 0 -112 Z";
const FACE = "M0 -92 C-13 -90 -20 -76 -20 -60 C-20 -46 -12 -36 0 -32 C12 -36 20 -46 20 -60 C20 -76 13 -90 0 -92 Z";

/**
 * The hero's illustration: the round table seen across its near edge, five
 * hooded players behind it in candlelight, and a slate where the votes are
 * chalked up as they're read out. Never seen from above.
 */
export function TableScene() {
  const read = useVotesRead();
  const tally = NAMES.map((_, n) => READ.slice(0, read).filter((v) => v === n).length);
  const done = read === READ.length;

  return (
    <figure className="relative mx-auto w-full max-w-xl">
      <div className={styles.scene}>
        <svg viewBox="0 0 520 360" role="img" aria-label="Five hooded players at a candlelit round table" className="block h-auto w-full">
          <defs>
            <radialGradient id="ts-hall" cx="260" cy="220" r="320" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#3a2412" />
              <stop offset="0.45" stopColor="#140d08" />
              <stop offset="1" stopColor="#070706" />
            </radialGradient>
            <linearGradient id="ts-cloak" x1="0" y1="-112" x2="0" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0d1d14" />
              <stop offset="0.75" stopColor="#163322" />
              <stop offset="1" stopColor="#3b3a1e" />
            </linearGradient>
            <linearGradient id="ts-rim" x1="0" y1="-112" x2="0" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0.3" stopColor="#e9b949" stopOpacity="0" />
              <stop offset="1" stopColor="#ffd27a" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="ts-wood" x1="0" y1="190" x2="0" y2="312" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2a170b" />
              <stop offset="0.5" stopColor="#4b2d16" />
              <stop offset="1" stopColor="#231309" />
            </linearGradient>
            <radialGradient id="ts-pool" cx="262" cy="250" r="190" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 0.32 0 170)">
              <stop offset="0" stopColor="#ffb45a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffb45a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ts-glow" cx="0" cy="0" r="1">
              <stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" />
              <stop offset="0.4" stopColor="#f2662a" stopOpacity="0.16" />
              <stop offset="1" stopColor="#f2662a" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="520" height="360" fill="url(#ts-hall)" />
          {/* Two pointed windows in the dark wall behind. */}
          {[120, 400].map((x) => (
            <path
              key={x}
              d={`M${x - 26} 150 L${x - 26} 70 Q${x - 26} 38 ${x} 22 Q${x + 26} 38 ${x + 26} 70 L${x + 26} 150 Z`}
              fill="#0c0c0b"
              stroke="#2a2017"
              strokeWidth="3"
            />
          ))}

          {HOODS.map((h) => (
            <g key={h.x} transform={`translate(${h.x} ${206 + (1 - h.s) * 40}) scale(${h.s})`}>
              <path d={HOOD} fill="url(#ts-cloak)" stroke="url(#ts-rim)" strokeWidth="2" />
              <path d={FACE} fill="#020302" />
            </g>
          ))}

          {/* The table, seen across its near edge: the underside, then the top and its gilt rim. */}
          <ellipse cx="262" cy="270" rx="250" ry="62" fill="#120a05" />
          <ellipse cx="262" cy="252" rx="250" ry="60" fill="url(#ts-wood)" />
          {[0.82, 0.62, 0.42].map((k) => (
            <ellipse key={k} cx="262" cy="252" rx={250 * k} ry={60 * k} fill="none" stroke="#1d0f07" strokeOpacity="0.5" />
          ))}
          <ellipse cx="262" cy="252" rx="250" ry="60" fill="url(#ts-pool)" />
          <ellipse cx="262" cy="252" rx="250" ry="60" fill="none" stroke="#c79a3a" strokeWidth="3" />

          {/* The candelabra. */}
          <path d="M262 252 L262 214 M232 220 Q262 236 292 220" stroke="#c79a3a" strokeWidth="3" fill="none" />
          {[232, 262, 292].map((x, i) => (
            <g key={x}>
              <rect x={x - 4} y={i === 1 ? 186 : 196} width="8" height={i === 1 ? 28 : 24} fill="#e6d8b8" />
              <circle cx={x} cy={i === 1 ? 176 : 186} r="30" fill="url(#ts-glow)" style={{ mixBlendMode: "screen" }} className={styles.glowFlicker} />
              <path
                d={`M${x} ${i === 1 ? 168 : 178} C${x - 5} ${i === 1 ? 176 : 186} ${x - 4} ${i === 1 ? 184 : 194} ${x} ${i === 1 ? 186 : 196} C${x + 4} ${i === 1 ? 184 : 194} ${x + 5} ${i === 1 ? 176 : 186} ${x} ${i === 1 ? 168 : 178} Z`}
                fill="#ffd27a"
                className={styles.flame}
                style={{ animationDelay: `${i * -0.4}s` }}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className={styles.tallyBoard} aria-live="off">
        <p className="font-display text-[0.65rem] font-semibold tracking-[0.2em] text-ash uppercase">Votes cast</p>
        <ol className="mt-2 flex flex-col gap-1.5">
          {NAMES.map((name, n) => (
            <li key={name} className="flex items-center gap-3">
              <span className={cn("w-16 font-hand text-2xl leading-none text-bone/90", done && n === 0 && styles.circled)}>{name}</span>
              <Tally count={tally[n]} />
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-3 max-w-[45%] text-sm text-ash italic">An example round table. The names are made up.</figcaption>
    </figure>
  );
}

/** Chalk tally marks: four strokes and a fifth across them, each drawn in as it's counted. */
function Tally({ count }: { count: number }) {
  const strokes = Array.from({ length: 10 }, (_, i) => {
    const group = Math.floor(i / 5);
    const k = i % 5;
    const x = group * 34;
    return k < 4 ? `M${x + 3 + k * 6} 4 L${x + 2 + k * 6} 24` : `M${x} 20 L${x + 26} 7`;
  });
  return (
    <svg viewBox="0 0 64 28" className="h-7 w-16" aria-hidden="true">
      {strokes.map((d, i) => (
        <path key={i} d={d} pathLength={1} data-drawn={i < count || undefined} className={styles.tallyStroke} />
      ))}
    </svg>
  );
}
