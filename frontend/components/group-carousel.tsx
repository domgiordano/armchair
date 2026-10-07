"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { Paddle } from "@/components/paddle";
import { formatScore } from "@/components/performance-card";
import { UserLink } from "@/components/user-link";
import { cn, FOCUS } from "@/lib/ui";

export interface GroupScore {
  sub: string;
  name: string;
  picture: string | null;
  value: number;
}

interface GroupCarouselProps {
  /** Names the carousel: "Couch Judges". */
  group: string;
  scores: GroupScore[];
  /** The judges' average; null keeps the gaps hidden (not revealed yet, or a judge pending). */
  panelMean: number | null;
}

const EVERY_MS = 3000;
// A swipe or tap holds the carousel still this long before it moves on its own again.
const HOLD_MS = 8000;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Each group member who scored the dance, one at a time, turning every few seconds until touched. */
export function GroupCarousel({ group, scores, panelMean }: GroupCarouselProps) {
  const track = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  // The interval reads the slide from here, not from a stale render.
  const atRef = useRef(0);
  const [paused, setPaused] = useState(false);
  // Hover and focus pause while they last; a touch holds for HOLD_MS.
  const [held, setHeld] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const many = scores.length > 1;
  const rotating = many && !paused && !held;

  const show = (i: number) => {
    atRef.current = i;
    setAt(i);
  };

  const go = (i: number) => {
    const next = (i + scores.length) % scores.length;
    const el = track.current;
    el?.scrollTo?.({ left: next * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
    show(next);
  };

  useEffect(() => {
    if (!rotating || reducedMotion()) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const next = (atRef.current + 1) % scores.length;
      const el = track.current;
      el?.scrollTo?.({ left: next * el.clientWidth, behavior: "smooth" });
      show(next);
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [rotating, scores.length]);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const hold = () => {
    setHeld(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHeld(false), HOLD_MS);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step || !many) return;
    e.preventDefault();
    go(at + step);
  };

  if (scores.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`${group} scores`}
      onKeyDown={onKey}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onTouchStart={hold}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-silver/10 bg-ink/40 p-2.5"
    >
      <div className="flex min-h-11 items-center justify-between gap-2 px-1">
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-silver-dim">
          <span className="truncate font-semibold tracking-[0.08em] uppercase">{group}</span>
          <span className="shrink-0 tabular-nums">{scores.length} scored</span>
        </p>
        {many && (
          <IconButton label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
            {paused ? <path d="M7 5l8 5-8 5Z" fill="currentColor" stroke="none" /> : <path d="M7.5 5v10M12.5 5v10" />}
          </IconButton>
        )}
      </div>
      <ul
        ref={track}
        aria-live={rotating ? "off" : "polite"}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth === 0) return;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== atRef.current && i < scores.length) show(i);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {scores.map((s, i) => {
          const gap = panelMean === null ? null : s.value - panelMean;
          return (
            <li
              key={s.sub}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${scores.length}`}
              // Relative, so the sr-only text is clipped by the track instead of widening the page.
              className="relative flex w-full shrink-0 snap-start items-center gap-3 px-1 py-1"
            >
              <Avatar name={s.name} email="" picture={s.picture} size={40} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-pearl">
                  <UserLink sub={s.sub}>{s.name}</UserLink>
                </span>
                <span className="text-xs text-silver-dim tabular-nums">
                  {gap === null
                    ? "Gave it a " + formatScore(s.value)
                    : gap === 0
                      ? "Right on the judges"
                      : `${formatScore(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the judges`}
                </span>
              </div>
              <span className="sr-only">scored {formatScore(s.value)}</span>
              <Paddle face={formatScore(s.value)} size="sm" className="w-10 shrink-0" />
            </li>
          );
        })}
      </ul>
      {many && (
        <div className="flex items-center justify-center gap-0.5">
          <IconButton label="Previous" onClick={() => go(at - 1)}>
            <path d="M12 5l-5 5 5 5" />
          </IconButton>
          {scores.map((s, i) => (
            <button
              key={s.sub}
              type="button"
              aria-label={`Show ${s.name}`}
              aria-current={i === at ? "true" : undefined}
              onClick={() => go(i)}
              className={cn("group flex size-6 items-center justify-center rounded-full", FOCUS)}
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  i === at ? "w-4 bg-gold" : "w-1.5 bg-silver/30 group-hover:bg-silver/60",
                )}
              />
            </button>
          ))}
          <IconButton label="Next" onClick={() => go(at + 1)}>
            <path d="M8 5l5 5-5 5" />
          </IconButton>
        </div>
      )}
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15",
        FOCUS,
      )}
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
