"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Portrait } from "@/components/couple/portrait";
import { CoupleNames } from "@/components/couple-names";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE } from "@/components/eliminated";
import { coupleName } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPerson, type PersonPage } from "@/lib/api/people";
import type { Season } from "@/lib/api/show";
import { gapTone, signed } from "@/lib/show/couples";
import { coupleTotals } from "@/lib/show/couple";
import { useReducedMotion } from "@/lib/motion";
import { coupleHref } from "@/lib/show/people";
import { celebrity, placeLabel, scoreLine, type RosterCouple } from "@/lib/show/roster";
import { button, cn, FOCUS } from "@/lib/ui";

interface RosterCardsProps {
  couples: RosterCouple[];
  season: Season;
  aired: boolean;
}

/**
 * One couple a card, swiped sideways. The scroller snaps natively for touch;
 * arrows, dots and the arrow keys move it, and its scroll position says which
 * card is current, so a swipe and a button agree.
 */
export function RosterCards({ couples, season, aired }: RosterCardsProps) {
  const [at, setAt] = useState(0);
  const scroller = useRef<HTMLUListElement>(null);
  const frame = useRef(0);
  const reduced = useReducedMotion();
  const last = couples.length - 1;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    setAt(next);
    const el = scroller.current;
    const card = el?.children[next] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo?.({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  };

  // The card whose centre is nearest the scroller's, read once a frame while it moves.
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (!el) return;
      const middle = el.scrollLeft + el.clientWidth / 2;
      const cards = [...el.children] as HTMLElement[];
      const nearest = cards.reduce(
        (best, card, i) => {
          const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
          return d < best.d ? { i, d } : best;
        },
        { i: 0, d: Infinity },
      );
      setAt(nearest.i);
    });
  };

  const onKey = (e: KeyboardEvent) => {
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    go(next);
  };

  return (
    <section aria-roledescription="carousel" aria-label="Couples" onKeyDown={onKey} className="flex flex-col gap-4">
      <ul
        ref={scroller}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Swipe or use the arrow keys to move between couples"
        className={cn(
          // Spacers rather than padding, so the end cards can scroll to the middle. Relative, so offsetLeft is from the strip.
          "relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none] before:w-[calc(7.5%-0.75rem)] before:shrink-0 before:content-[''] after:w-[calc(7.5%-0.75rem)] after:shrink-0 after:content-[''] sm:-mx-6 sm:before:w-[calc(50%-13.75rem)] sm:after:w-[calc(50%-13.75rem)] [&::-webkit-scrollbar]:hidden",
          FOCUS,
        )}
      >
        {couples.map((c, i) => (
          <li
            key={c.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${couples.length}: ${coupleName(c)}`}
            aria-current={i === at ? "true" : undefined}
            // Only the current card's links take focus, so Tab doesn't wander off-screen.
            inert={i !== at}
            className={cn(
              "w-[85%] shrink-0 snap-center snap-always transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.3,1)] sm:w-[26rem]",
              i === at ? "opacity-100" : "scale-[0.94] opacity-45",
            )}
          >
            <CoupleCard couple={c} season={season} aired={aired} near={Math.abs(i - at) <= 1} />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous couple" className={ARROW}>
          <Chevron flip />
        </button>
        <ol aria-label="Pick a couple" className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
          {couples.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={celebrity(c).name}
                aria-current={i === at ? "true" : undefined}
                className={cn("group flex size-6 items-center justify-center rounded-full", FOCUS)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    i === at ? "w-4 bg-gold shadow-[0_0_8px_rgb(232_194_104/0.7)]" : cn("w-1.5 group-hover:bg-silver", c.eliminated ? "bg-stamp/50" : "bg-silver/35"),
                  )}
                />
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => go(at + 1)} disabled={at === last} aria-label="Next couple" className={ARROW}>
          <Chevron />
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {`Couple ${at + 1} of ${couples.length}: ${coupleName(couples[at])}`}
      </p>
    </section>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={flip ? "rotate-180" : undefined}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const ARROW = cn(
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-silver/30 bg-ballroom/40 text-pearl transition duration-150 hover:border-gold/50 hover:text-gold-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-silver/30 disabled:hover:text-pearl",
  FOCUS,
);

const GAP_TONE = { over: "text-gold-light", under: "text-sky-200", level: "text-pearl" };

function CoupleCard({ couple: c, season, aired, near }: { couple: RosterCouple; season: Season; aired: boolean; near: boolean }) {
  const out = c.eliminated;
  const place = placeLabel(c, season);
  const members = [...c.members].sort((a, b) => (a.role === b.role ? 0 : a.role === "celebrity" ? -1 : 1));
  return (
    <article
      className={cn(
        "relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border p-4 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.8)]",
        out ? "border-dashed border-silver/20 bg-ink/70" : "border-gold/25 bg-gradient-to-b from-ballroom/90 via-ballroom/60 to-ink/80",
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(232_194_104/0.16),transparent_70%)]" />
      <div className="relative grid grid-cols-2 gap-3">
        {members.map((m, i) => (
          <figure key={m.name} className={cn("flex flex-col gap-1.5", i ? "rotate-[1.5deg]" : "-rotate-[1.5deg]")}>
            <Portrait person={m} size={200} className={cn(out && OUT_FADE)} />
            <figcaption className="truncate text-center text-[11px] tracking-[0.14em] text-silver-dim uppercase">{m.role === "celebrity" ? "Star" : "Pro"}</figcaption>
          </figure>
        ))}
        {out && <EliminatedStamp out={out} className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2" />}
      </div>

      <div className="relative flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("text-xl leading-tight font-semibold", out ? cn("text-silver", OUT_STRIKE) : "text-pearl")}>
            <CoupleNames members={c.members} />
          </h3>
          {place && (
            <span className={cn("mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", season.open ? "border-gold/40 text-gold-light" : "border-emerald-300/30 text-emerald-200")}>
              {place}
            </span>
          )}
        </div>
      </div>

      <dl className="relative grid grid-cols-3 gap-2 text-center">
        <Stat label="Judges" value={c.judges === null ? "–" : formatScore(c.judges)} />
        <Stat label="You" value={c.you === null ? "–" : formatScore(c.you)} accent={c.you !== null} />
        <Stat label="Gap" value={c.gap === null ? "–" : signed(c.gap)} className={GAP_TONE[gapTone(c.gap)]} />
      </dl>
      {c.judges === null && <p className="relative -mt-2 text-center text-xs text-silver-dim italic">{scoreLine(c, season, aired)}</p>}

      <Dances couple={c} season={season.season} load={near} />

      <Link href={coupleHref(c.members, season.season)} prefetch={false} className={cn(button(out ? "secondary" : "primary", "sm"), "relative mt-auto")}>
        Their season
      </Link>
    </article>
  );
}

function Stat({ label, value, accent, className }: { label: string; value: string; accent?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse rounded-xl px-1 py-2", accent ? "bg-gold/10" : "bg-ink/50")}>
      <dt className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">{label}</dt>
      <dd className={cn("text-2xl font-semibold tabular-nums", accent ? "text-gold-light" : "text-pearl", className)}>{value}</dd>
    </div>
  );
}

type DancesLoad = { kind: "idle" } | { kind: "ready"; person: PersonPage } | { kind: "error" };

/** Their dances so far and the judges' favorite, from people_get, fetched once the card is near. */
function Dances({ couple, season, load }: { couple: RosterCouple; season: string; load: boolean }) {
  const [state, setState] = useState<DancesLoad>({ kind: "idle" });

  useEffect(() => {
    if (!load || state.kind !== "idle") return;
    let cancelled = false;
    getPerson(couple.id, season).then(
      (person) => !cancelled && setState({ kind: "ready", person }),
      () => !cancelled && setState({ kind: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, state.kind, couple.id, season]);

  if (state.kind === "error") return null;
  if (state.kind === "idle") {
    return (
      <div className="relative flex flex-col gap-2">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-6 w-full rounded-full" />
      </div>
    );
  }
  const rows = state.person.performances.filter((r) => r.season === season);
  const { best } = coupleTotals(rows);
  const styles = rows.map((r) => r.style ?? "Dance");
  return (
    <div className="relative flex flex-col gap-2 animate-fade-in">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-silver-dim uppercase">
        {rows.length === 0 ? "No dances yet" : `${rows.length} ${rows.length === 1 ? "dance" : "dances"}`}
      </p>
      {styles.length > 0 && (
        <ul aria-label="Dances" className="flex flex-wrap gap-1.5">
          {styles.map((s, i) => (
            <li key={i} className="rounded-full border border-silver/15 bg-ink/40 px-2.5 py-0.5 text-xs text-silver">
              {s}
            </li>
          ))}
        </ul>
      )}
      {best && (
        <p className="text-sm text-silver">
          <span className="text-gold-light">Judges&apos; best:</span> {best.style ?? "Dance"}, week {best.week ?? "?"} ·{" "}
          <span className="font-semibold text-pearl tabular-nums">{formatScore(best.panelMean ?? 0)}</span>
        </p>
      )}
    </div>
  );
}
