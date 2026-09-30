"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

interface Performance {
  label: string;
  judges: [number, number, number];
  you: number;
  everyone: number;
}

// Invented. No real couples, judges or scores.
const JUDGES = ["Rhea", "Marco", "Dee"];
const PERFORMANCES: Performance[] = [
  { label: "Couple 3 · Paso doble", judges: [8, 7, 8], you: 8, everyone: 7.4 },
  { label: "Couple 5 · Viennese waltz", judges: [9, 9, 10], you: 9, everyone: 8.8 },
  { label: "Couple 1 · Jive", judges: [6, 7, 6], you: 8, everyone: 6.9 },
];
const CYCLE_MS = 6500;

const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function gapLine(you: number, panel: number): string {
  const gap = Math.round((you - panel) * 10) / 10;
  if (gap === 0) return "You matched them exactly.";
  return `You were ${one(Math.abs(gap))} ${gap > 0 ? "above" : "below"}.`;
}

type Tone = "judge" | "you" | "crowd";

interface SeatProps {
  name: string;
  value: number;
  tone: Tone;
  delay: number;
}

function Seat({ name, value, tone, delay }: SeatProps) {
  const face = {
    judge: "bg-text text-night",
    you: "bg-linear-to-br from-blue via-magenta to-orange text-text",
    crowd: "border-2 border-gold/80 bg-night text-gold",
  }[tone];

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-24 w-full items-end justify-center overflow-hidden sm:h-28">
        {tone !== "you" && (
          <span className="demo-hidden absolute bottom-2 text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
            Hidden
          </span>
        )}
        <div className="demo-paddle flex flex-col items-center" style={{ "--delay": `${delay}ms` } as CSSProperties}>
          <span
            className={`flex h-12 w-11 items-center justify-center rounded-xl text-xl font-extrabold tabular-nums shadow-lg shadow-night/60 sm:h-14 sm:w-12 sm:text-2xl ${face}`}
          >
            {one(value)}
          </span>
          <span className="h-6 w-1.5 rounded-b-sm bg-muted/50" />
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-muted">{name}</span>
    </div>
  );
}

export function DeskDemo() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % PERFORMANCES.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduced]);

  const p = PERFORMANCES[index];
  const panel = (p.judges[0] + p.judges[1] + p.judges[2]) / 3;
  const panelText = one(Math.round(panel * 10) / 10);
  const spoken = `${p.label}. You scored ${p.you}. Judges ${JUDGES.map((j, i) => `${j} ${p.judges[i]}`).join(", ")}. Everyone ${one(p.everyone)}. Panel average ${panelText}. ${gapLine(p.you, panel)}`;

  return (
    <figure className="relative rounded-3xl border border-line bg-night-2/80 p-4 shadow-2xl shadow-violet/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text uppercase">
          <span className="size-2 rounded-full bg-magenta motion-safe:animate-pulse" aria-hidden="true" />
          Live
        </span>
        <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">Illustration · invented scores</span>
      </div>

      <div key={index} className="demo">
        <p className="mt-4 text-sm font-semibold text-text sm:text-base">{p.label}</p>

        <div role="img" aria-label={spoken} className="mt-2">
          <div className="grid grid-cols-5 gap-1 sm:gap-3">
            <Seat name="You" value={p.you} tone="you" delay={200} />
            {JUDGES.map((name, i) => (
              <Seat key={name} name={name} value={p.judges[i]} tone="judge" delay={1500 + i * 180} />
            ))}
            <Seat name="Everyone" value={p.everyone} tone="crowd" delay={2100} />
          </div>
          <div className="-mt-7 h-2 rounded-full bg-linear-to-r from-blue via-magenta to-orange opacity-80" />
        </div>

        <div className="relative mt-8 h-12 text-sm leading-snug" aria-hidden="true">
          <p className="demo-before absolute inset-0 text-muted">
            Your <span className="font-semibold text-text">{p.you}</span> is up. Everyone else&rsquo;s stays hidden
            until you score.
          </p>
          <p className="demo-after absolute inset-0 text-muted">
            Panel average <span className="font-semibold text-text">{panelText}</span>. {gapLine(p.you, panel)}
          </p>
        </div>
      </div>

      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full text-muted hover:bg-line/60 hover:text-text focus-visible:outline-2 focus-visible:outline-gold active:scale-95"
          aria-label={paused ? "Play the demo" : "Pause the demo"}
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
            {paused ? <path d="M5 3.5v9l7-4.5z" /> : <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" />}
          </svg>
        </button>
      )}
    </figure>
  );
}
