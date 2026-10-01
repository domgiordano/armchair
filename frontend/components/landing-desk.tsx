"use client";

import { useEffect, useState } from "react";

import { Desk } from "@/components/desk";
import { formatScore } from "@/components/performance-card";
import type { Judge, RevealedCard } from "@/lib/api/show";
import { useReducedMotion } from "@/lib/motion";

// Invented panel and couples. Nothing here is a real person or a real score.
const JUDGES: Judge[] = [
  { id: "marisol", name: "Marisol Vega", headshot: null },
  { id: "theo", name: "Theo Laurent", headshot: null },
  { id: "vivienne", name: "Vivienne Hart", headshot: null },
];
const JUDGE_MAP = new Map(JUDGES.map((j) => [j.id, j]));

interface Dance {
  couple: string;
  style: string;
  judges: number[];
  you: number;
  mean: number;
  count: number;
}

const DANCES: Dance[] = [
  { couple: "Ava & Luca", style: "Rumba", judges: [8, 8, 9], you: 8, mean: 7.9, count: 214 },
  { couple: "Noah & Sienna", style: "Quickstep", judges: [7, 8, 7], you: 9, mean: 7.4, count: 198 },
  { couple: "Maya & Jonah", style: "Argentine Tango", judges: [10, 10, 10], you: 10, mean: 9.6, count: 231 },
];

// Long enough for the staggered raise to settle and the gap line to be read.
const HOLD = 5000;

const toCard = (d: Dance): RevealedCard => ({
  key: d.couple,
  contestants: [],
  n: 1,
  style: d.style,
  song: null,
  locked: false,
  judges: d.judges.map((value, i) => ({ id: JUDGES[i].id, value, state: "confirmed" })),
  mine: { value: d.you },
  others: [],
  aggregate: { count: d.count, mean: d.mean },
});

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The real judges' desk on a loop of invented dances, for the signed-out landing. */
export function LandingDesk() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const still = useReducedMotion();

  useEffect(() => {
    if (paused || still) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % DANCES.length), HOLD);
    return () => clearInterval(id);
  }, [paused, still]);

  const dance = DANCES[index];
  const panel = average(dance.judges);
  const gap = Math.abs(dance.you - panel);

  return (
    <figure className="flex flex-col gap-4 rounded-2xl border border-silver/15 bg-ballroom/60 p-4 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">Week 4 · {dance.style}</p>
          <p className="font-display text-xl tracking-[-0.03em] text-silver">{dance.couple}</p>
        </div>
        {!still && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play the illustration" : "Pause the illustration"}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-silver-dim hover:bg-silver/10 hover:text-silver focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light active:bg-silver/15"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-current">
              {paused ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />}
            </svg>
            {paused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <Desk key={index} card={toCard(dance)} judges={JUDGE_MAP}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-silver">
          <dt>Judges&apos; average</dt>
          <dd className="text-right tabular-nums">{formatScore(Math.round(panel * 10) / 10)}</dd>
          <dt>Everyone</dt>
          <dd className="text-right tabular-nums">{formatScore(dance.mean)}</dd>
        </dl>
      </Desk>

      <p className="text-sm text-silver-dim">
        {gap === 0 ? (
          <>
            <span className="font-semibold text-gold-light">Dead on.</span> You matched the judges exactly.
          </>
        ) : (
          <>
            You were <span className="font-semibold text-gold-light tabular-nums">{formatScore(Math.round(gap * 10) / 10)}</span>{" "}
            off the judges&apos; average.
          </>
        )}
      </p>
      <figcaption className="border-t border-silver/10 pt-3 text-xs text-silver-dim">
        Illustration with invented couples, judges and scores.
      </figcaption>
    </figure>
  );
}
