import type { ReactNode } from "react";

import { Reveal } from "./reveal";
import styles from "./landing.module.css";

interface Beat {
  numeral: string;
  title: string;
  body: string;
  call: string;
  art: ReactNode;
}

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const BEATS: Beat[] = [
  {
    numeral: "I",
    title: "Breakfast",
    body: "The castle wakes and the players come down in ones and twos. Whoever never walks in was murdered in the night.",
    call: "Your call: who doesn't come down.",
    art: (
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-14">
        {/* An empty chair, and a candle gone out beside its place. */}
        <path {...LINE} d="M14 56V20c0-6 4-10 9-10h4c5 0 9 4 9 10v18H14M14 38v18M36 38v18" />
        <path {...LINE} d="M48 56V40h6v16M51 40v-5" />
        <path {...LINE} strokeOpacity={0.5} d="M51 30c-2-3 2-5 0-8" />
      </svg>
    ),
  },
  {
    numeral: "II",
    title: "The mission",
    body: "A challenge for the prize pot. A few players win a shield, and with it a night the Traitors can't murder them.",
    call: "Nothing to call. Watch who earns a shield.",
    art: (
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-14">
        {/* Gold bars, stacked. */}
        <path {...LINE} d="M10 50h20l-4-10H14zM34 50h20l-4-10H38zM22 38h20l-4-10H26z" />
        <path {...LINE} strokeOpacity={0.5} d="M32 20v-6M24 22l-3-4M40 22l3-4" />
      </svg>
    ),
  },
  {
    numeral: "III",
    title: "The round table",
    body: "They argue, then each chalks one name on a slate. The most votes is banished, and says what they were: Faithful, or Traitor.",
    call: "Your call: the top three, in order.",
    art: (
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-14">
        {/* A slate with three ranks chalked on it. */}
        <rect {...LINE} x="12" y="10" width="40" height="46" rx="2" />
        <path {...LINE} d="M18 22h4M18 33h4M18 44h4" />
        <path {...LINE} strokeOpacity={0.6} d="M27 22c4-3 8 2 12-1s6 1 8 0M27 33c3-2 7 1 10-1M27 44c3-2 6 1 8 0" />
      </svg>
    ),
  },
  {
    numeral: "IV",
    title: "The turret",
    body: "After dark the Traitors meet, cloaked, in the tower. They murder one Faithful, or offer one a place among them.",
    call: "Your calls: the murder, and any recruit.",
    art: (
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-14">
        {/* A tower with one lit window. */}
        <path {...LINE} d="M20 58V24l-4-6h32l-4 6v34zM16 18v-6h6v4h6v-4h8v4h6v-4h6v6" />
        <path {...LINE} d="M29 40v-6a3 3 0 0 1 6 0v6z" />
        <path fill="currentColor" fillOpacity={0.5} d="M30 39v-5a2 2 0 0 1 4 0v5z" />
      </svg>
    ),
  },
];

/** The show's day and night, beat by beat, and which call each one settles. */
export function Night() {
  return (
    <ol className="mt-12 grid gap-px overflow-hidden rounded-sm border border-gilt/25 bg-gilt/15 sm:grid-cols-2 lg:grid-cols-4">
      {BEATS.map((b, i) => (
        <li key={b.numeral} className="bg-night">
          <Reveal delay={i * 110} className="flex h-full flex-col gap-4 p-6 sm:p-7">
            <div className="flex items-start justify-between text-gilt">
              {b.art}
              <span aria-hidden="true" className={`${styles.numeral} text-3xl leading-none`}>
                {b.numeral}
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold text-bone">{b.title}</h3>
            <p className="leading-relaxed">{b.body}</p>
            <p className="mt-auto border-t border-bone/10 pt-4 font-display text-xs font-semibold tracking-[0.14em] text-candle uppercase">
              {b.call}
            </p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
