"use client";

import { useEffect, useRef, useState } from "react";

import { EliminatedStamp } from "@/components/eliminated";
import { CoupleAvatars } from "@/components/headshot";
import type { Elimination } from "@/lib/api/couples";
import type { Contestant, EpisodeResults } from "@/lib/api/show";
import { useReducedMotion } from "@/lib/motion";
import { spotlight } from "@/lib/show/reveal";
import { button, cn, DISPLAY } from "@/lib/ui";

interface ResultsRevealProps {
  /** "Week 4", "Week 1, night 2". */
  label: string;
  /** Null until the poller writes the night's results. */
  results: EpisodeResults | null;
  contestants: Map<string, Contestant>;
  out: Elimination;
  /** The last answer just landed here: bring the question into view. */
  announce: boolean;
  /** The reveal has begun; keep this mounted while it plays out. */
  onStart: () => void;
  /** The sequence reached its verdict: turn the results over everywhere. */
  onRevealed: () => void;
}

type Phase = "ask" | "later" | "sweep" | "verdict";

// One spotlight hop, and how long the verdict holds before the page fills in under it.
const STEP_MS = 420;
const HOLD_MS = 1100;

const celebrity = (c: Contestant | undefined) => c?.members.find((m) => m.role === "celebrity")?.name;

/**
 * The end of an episode: every dance scored, and who went home stays face down
 * until you ask. The reveal sweeps a spotlight over the couples in danger, then
 * settles on whoever is going home.
 */
export function ResultsReveal({ label, results, contestants, out, announce, onStart, onRevealed }: ResultsRevealProps) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [lit, setLit] = useState(-1);
  const reduced = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const gone = results?.eliminated ?? [];
  const cast = results ? spotlight(gone, results.totals) : [];

  useEffect(() => {
    if (!announce) return;
    heading.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    heading.current?.focus({ preventScroll: true });
  }, [announce, reduced]);

  const hops = cast.length * 2;
  useEffect(() => {
    if (phase !== "sweep") return;
    if (lit >= hops - 1) {
      const t = setTimeout(() => setPhase("verdict"), STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLit((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, lit, hops]);

  useEffect(() => {
    if (phase !== "verdict") return;
    const t = setTimeout(onRevealed, reduced ? 0 : HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, reduced, onRevealed]);

  const start = () => {
    onStart();
    setLit(0);
    setPhase(reduced || cast.length < 2 ? "verdict" : "sweep");
  };

  if (phase === "later") {
    return (
      <section
        aria-labelledby="results-title"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-ballroom/50 px-4 py-3"
      >
        <div className="flex min-w-0 flex-col">
          <h2 id="results-title" ref={heading} tabIndex={-1} className="font-semibold text-pearl focus:outline-none">
            {label} results are face down
          </h2>
          <p className="text-sm text-silver-dim">Nothing here says who went home until you reveal it.</p>
        </div>
        <button type="button" onClick={start} disabled={results === null} className={button("primary", "sm")}>
          Reveal results
        </button>
      </section>
    );
  }

  const asking = phase === "ask";
  const names = gone.map((id) => {
    const c = contestants.get(id);
    return c ? c.members.map((m) => m.name).join(" & ") : id;
  });
  const verdict = gone.length === 0 ? "Everyone is safe tonight." : `Going home: ${names.join(", ")}.`;

  return (
    <section
      aria-labelledby="results-title"
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-ink via-ballroom to-ink px-4 py-6 text-center shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] animate-pop-in sm:px-8"
    >
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{label} results</p>
      {asking ? (
        <>
          <div className="flex flex-col gap-2">
            <h2 id="results-title" ref={heading} tabIndex={-1} className={cn(DISPLAY, "text-3xl leading-tight focus:outline-none")}>
              <span className="text-chrome">You&apos;ve scored every dance.</span>
            </h2>
            <p className="text-silver">
              {results === null
                ? "The results land here once the night's scores are final. You choose when to look."
                : "Ready to see who's going home?"}
            </p>
          </div>
          {results !== null && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse">
              <button type="button" onClick={start} className={button("primary")}>
                Reveal results
              </button>
              <button type="button" onClick={() => setPhase("later")} className={button("secondary")}>
                Not yet
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <h2 id="results-title" ref={heading} tabIndex={-1} className="sr-only">
            {label} results
          </h2>
          <ul aria-label="Couples in the spotlight" className="flex w-full max-w-xl items-start justify-center gap-2 sm:gap-6">
            {cast.map((id, i) => {
              const home = gone.includes(id);
              const on = phase === "verdict" ? home || gone.length === 0 : lit % cast.length === i;
              const c = contestants.get(id);
              return (
                <li
                  key={id}
                  className={cn(
                    "relative flex min-w-0 flex-1 flex-col items-center gap-2 pt-12 transition duration-500",
                    !on && (phase === "verdict" ? "opacity-45 grayscale" : "opacity-60"),
                    phase === "verdict" && home && "scale-105",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 -top-6 mx-auto h-[calc(100%+1.5rem)] w-[min(100%,9rem)] bg-gradient-to-b from-gold-light/55 via-gold-light/20 to-transparent blur-[3px] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)] transition-opacity duration-300",
                      on ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="relative">{c && <CoupleAvatars members={c.members} size={52} />}</span>
                  <span className="relative w-full truncate text-sm font-semibold text-pearl">{celebrity(c) ?? id}</span>
                  {phase === "verdict" && home && <EliminatedStamp out={out} size="sm" className="[--d:150ms]" />}
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className="min-h-6 font-semibold text-pearl">
            {phase === "sweep" ? "Who's going home?" : verdict}
          </p>
        </>
      )}
    </section>
  );
}
