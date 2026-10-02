"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { PersonLink } from "@/components/couple-names";
import { CoupleDances } from "@/components/couple/couple-dances";
import { Portrait } from "@/components/couple/portrait";
import { ScoreChart } from "@/components/couple/score-chart";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE } from "@/components/eliminated";
import { avg, episodeHref } from "@/components/people/person-dances";
import { gapText, Tile } from "@/components/people/person-stats";
import { SignedIn } from "@/components/signed-in";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { getPerson, type OpenRow, type PersonPage, type SeasonResult } from "@/lib/api/people";
import { getSeason, type Contestant, type Season } from "@/lib/api/show";
import { coupleResult, coupleTotals, paddle, type CoupleTotals } from "@/lib/show/couple";
import { personSlug } from "@/lib/show/people";
import { seasonLabel, useSeasonId, withSeason } from "@/lib/show/seasons";
import { button, cn, EYEBROW, SECONDARY } from "@/lib/ui";

export function CoupleScreen() {
  return (
    <SignedIn title="Couple" wide>
      {/* ?id= is only readable on the client in a static export. */}
      <Suspense fallback={<CoupleSkeleton />}>
        <CoupleRoute />
      </Suspense>
    </SignedIn>
  );
}

type Load =
  | { kind: "loading" }
  | { kind: "ready"; season: Season; person: PersonPage }
  | { kind: "error"; message: string; status: number | null };

function CoupleRoute() {
  const id = useSearchParams().get("id") ?? "";
  const season = useSeasonId();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSeason(season), getPerson(id, season)]).then(
      ([s, person]) => !cancelled && setLoad({ kind: "ready", season: s, person }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
          status: e instanceof ApiError ? e.status : null,
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, season, attempt]);

  const couple = load.kind === "ready" ? load.season.contestants.find((c) => c.id === id) : undefined;
  if (load.kind === "loading") return <CoupleSkeleton />;
  // An id that names no one is a 404 or a 400 from people_get: there's no couple to show, not a failure.
  if (load.kind === "error" && load.status !== 404 && load.status !== 400) {
    return (
      <ErrorState
        what="this couple"
        message={load.message}
        retry={() => {
          setLoad({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (load.kind === "error" || !couple) {
    return (
      <>
        <h1 className="sr-only">No couple here</h1>
        <EmptyState
          title="No couple here"
          action={
            <Link href={withSeason("/couples/", season)} className={SECONDARY}>
              Every couple
            </Link>
          }
        >
          That link doesn&apos;t match a couple in {seasonLabel(season)}.
        </EmptyState>
      </>
    );
  }
  return <Couple key={id} couple={couple} season={load.season} person={load.person} />;
}

function Couple({ couple, season, person }: { couple: Contestant; season: Season; person: PersonPage }) {
  const rows = person.performances.filter((r) => r.season === season.season);
  const totals = coupleTotals(rows);
  const result = coupleResult(person, season.season);
  const open = rows.filter((r): r is OpenRow => !r.locked && (r.panelMean !== null || paddle(r) !== null));
  const self = couple.members.map((m) => (m.role === "celebrity" ? couple.id : personSlug(m.name)));

  return (
    <div className="flex flex-col gap-8">
      <Hero couple={couple} season={season} result={result} />

      <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Dances"
          value={totals.locked ? `${totals.dances - totals.locked}/${totals.dances}` : totals.dances}
          note={totals.locked ? `${totals.locked} still to score` : totals.dances ? "All revealed" : "None aired yet"}
        />
        <Tile label="Judges' avg" value={avg(totals.judges)} note={totals.judged ? `over ${plural(totals.judged, "dance")}` : "Score to see their marks"} />
        <Tile
          label="Your avg"
          value={avg(totals.you)}
          note={totals.gap === null ? plural(totals.paddles, "paddle") : gapText(totals.gap, "above the judges", "below the judges")}
        />
        <Tile label="Friends' avg" value={totals.friends.count ? avg(totals.friends.mean) : "–"} note={plural(totals.friends.count, "paddle")} />
        <Tile label="Everyone" value={totals.everyone.count ? avg(totals.everyone.mean) : "–"} note={plural(totals.everyone.count, "paddle")} />
      </div>

      {/* The chart's viewBox scales its type with its width, so on desktop it shares the row with the notes. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        {open.length > 1 && (
          <Card id="couple-chart" title="You and the judges, week by week" note="Gold is your paddle, silver the judges' average.">
            <ScoreChart rows={open} />
          </Card>
        )}
        <Notes totals={totals} />
      </div>

      <section aria-labelledby="dances" className="flex flex-col gap-4">
        <h2 id="dances" className="text-lg font-semibold text-pearl">
          Every dance
        </h2>
        {rows.length === 0 ? (
          <EmptyState compact title="Nothing danced yet">
            Their dances land here as each night airs.
          </EmptyState>
        ) : (
          <CoupleDances rows={rows} self={self} judges={season.judges} episodes={season.episodes} />
        )}
      </section>
    </div>
  );
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

interface HeroProps {
  couple: Contestant;
  season: Season;
  result: SeasonResult | null;
}

function Hero({ couple, season, result }: HeroProps) {
  const members = [...couple.members].sort((a, b) => (a.role === b.role ? 0 : a.role === "celebrity" ? -1 : 1));
  const out = result && "status" in result && result.status === "out" ? result : null;
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative grid w-full max-w-xs grid-cols-2 gap-3 self-center sm:w-72 sm:self-auto">
        {members.map((m, i) => (
          <figure key={m.name} className={cn("flex flex-col gap-2 animate-pop-in", i ? "rotate-2" : "-rotate-2")} style={{ animationDelay: `${i * 90}ms` }}>
            <Portrait person={m} size={288} className={cn(out && OUT_FADE)} />
            <figcaption className={cn(EYEBROW, "text-center")}>{m.role === "celebrity" ? "Star" : "Pro"}</figcaption>
          </figure>
        ))}
        {out && <EliminatedStamp out={out} className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 [--d:350ms]" />}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{seasonLabel(season.season)}</p>
        <h1 className={cn("text-3xl leading-tight font-semibold tracking-tight sm:text-4xl", out ? cn("text-silver", OUT_STRIKE) : "text-pearl")}>
          {members.map((m, i) => (
            <span key={m.name}>
              {i > 0 && <span className="text-silver-dim"> &amp; </span>}
              <PersonLink id={m.role === "celebrity" ? couple.id : personSlug(m.name)} name={m.name} />
            </span>
          ))}
        </h1>
        <Status result={result} season={season} />
      </div>
    </header>
  );
}

function Status({ result, season }: { result: SeasonResult | null; season: Season }) {
  if (!result) return null;
  if ("locked" in result) {
    const week = season.episodes.find((e) => e.ep === result.ep)?.week;
    return (
      <p className="flex flex-wrap items-center gap-3 text-sm text-silver">
        <Chip tone="muted">Result hidden</Chip>
        <span>Finish week {week ?? result.ep} to see how their season went.</span>
        <Link href={episodeHref(season.season, result.ep)} prefetch={false} className={button("secondary", "sm")}>
          Score week {week ?? result.ep}
        </Link>
      </p>
    );
  }
  if (result.status === "out") return <p className="text-sm text-silver">Went home in {result.week === null ? `episode ${result.ep}` : `week ${result.week}`}.</p>;
  if (result.status === "dancing")
    return (
      <Chip tone="live">
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/60" />
          <span className="relative size-2 rounded-full bg-emerald-300" />
        </span>
        Still dancing
      </Chip>
    );
  return <Chip tone="gold">Made the finale</Chip>;
}

const CHIP = { live: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200", gold: "border-gold/40 bg-gold/10 text-gold-light", muted: "border-silver/20 text-silver-dim" };

function Chip({ tone, children }: { tone: keyof typeof CHIP; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-semibold tracking-wide", CHIP[tone])}>{children}</span>;
}

function Notes({ totals }: { totals: CoupleTotals }) {
  const notes = [
    totals.best && { title: "Judges' best", row: totals.best, value: avg(totals.best.panelMean), what: "from the panel" },
    totals.worst && { title: "Judges' lowest", row: totals.worst, value: avg(totals.worst.panelMean), what: "from the panel" },
    totals.favorite && { title: "Your favorite", row: totals.favorite, value: String(paddle(totals.favorite)), what: "your paddle" },
    totals.split && {
      title: "Where you split",
      row: totals.split,
      value: `${paddle(totals.split)} v ${avg(totals.split.panelMean)}`,
      what: "you against the judges",
    },
  ].filter((n) => !!n);
  if (notes.length === 0) return null;
  return (
    <section aria-labelledby="notes" className="flex flex-col gap-3">
      <h2 id="notes" className={EYEBROW}>
        Notes
      </h2>
      <ul className="stagger grid grid-cols-2 gap-2">
        {notes.map((n) => (
          <li key={n.title} className="flex flex-col gap-1 rounded-xl border border-silver/10 bg-gradient-to-br from-ballroom/70 to-ink/40 p-3.5">
            <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">{n.title}</p>
            <p className="text-sm text-pearl">
              {n.row.style ?? "Dance"}
              <span className="text-silver-dim"> · {n.row.week === null ? `Episode ${n.row.ep}` : `Week ${n.row.week}`}</span>
            </p>
            <p className="text-xl font-semibold text-pearl tabular-nums">
              {n.value}
              <span className="sr-only">, {n.what}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoupleSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-8">
      <span className="sr-only">Loading the couple...</span>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid w-full max-w-xs grid-cols-2 gap-3 self-center sm:w-72">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="aspect-square rounded-2xl" />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-9 w-3/4 rounded" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
