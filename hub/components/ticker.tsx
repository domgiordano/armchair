"use client";

import { useState, type CSSProperties } from "react";

export interface TickerItem {
  key: string;
  label: string;
  text: string;
}

interface TickerProps {
  /** Names the band for screen readers: "What's on". */
  label: string;
  items: TickerItem[];
}

// Each half of the track repeats the items until it is at least this many long,
// so a short list still overfills a 1920px band and the loop has no gap.
const MIN_PER_HALF = 10;
const SECONDS_PER_ITEM = 5;

/**
 * A band of facts sliding right to left (app/motion.css, .ticker). Screen readers get one
 * static list; the moving track is a decorative copy. Reduced motion shows the list, still.
 */
export function Ticker({ label, items }: TickerProps) {
  const [paused, setPaused] = useState(false);
  if (items.length === 0) return null;

  const repeats = Math.ceil(MIN_PER_HALF / items.length);
  const half = Array.from({ length: repeats }, (_, r) => items.map((item) => ({ item, echo: r > 0 }))).flat();
  const speed = { "--ticker-duration": `${half.length * SECONDS_PER_ITEM}s` } as CSSProperties;

  return (
    <section aria-label={label} className="ticker relative border-y border-line/70 bg-night-2/70" data-paused={paused || undefined}>
      <ul className="sr-only">
        {items.map((i) => (
          <li key={i.key}>
            {i.label}: {i.text}
          </li>
        ))}
      </ul>
      <div className="ticker-window overflow-hidden" aria-hidden="true">
        <div className="ticker-track flex w-max" style={speed}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="ticker-half flex shrink-0 items-center" data-copy={copy}>
              {half.map(({ item, echo }, n) => (
                <li key={`${item.key}-${n}`} data-echo={echo || undefined} className="flex min-h-11 items-center gap-2.5 px-5 text-sm whitespace-nowrap">
                  <span className="size-1.5 shrink-0 rotate-45 bg-linear-to-br from-blue to-magenta" />
                  <span className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase">{item.label}</span>
                  <span className="text-text/85">{item.text}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label="Pause the ticker"
        onClick={() => setPaused((p) => !p)}
        className="ticker-toggle absolute inset-y-0 right-0 flex w-12 items-center justify-center bg-linear-to-l from-night-2 from-60% to-transparent pl-2 text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
          {paused ? <path d="M5 3.5v9l7.5-4.5z" /> : <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" />}
        </svg>
      </button>
    </section>
  );
}
