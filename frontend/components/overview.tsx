"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { AccuracyChart } from "@/components/accuracy-chart";
import { Avatar } from "@/components/avatar";
import { Headshot } from "@/components/headshot";
import { LoadError } from "@/components/load-error";
import { MiniDesk } from "@/components/mini-desk";
import { formatScore } from "@/components/performance-card";
import {
  getLeaderboard,
  getOverview,
  type CoupleStanding,
  type Leaderboard,
  type Overview as OverviewData,
  type OverviewEpisode,
} from "@/lib/api/overview";
import { countdown, hero, showTime } from "@/lib/show/overview";
import { formatAirDate } from "@/lib/show/schedule";
import { seasonLabel, useSeasonId, withSeason } from "@/lib/show/seasons";
import { useNow } from "@/lib/show/use-now";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light";
const BUTTON = `flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-medium ${FOCUS}`;
const GOLD = `${BUTTON} bg-gold text-ink hover:bg-gold-light active:bg-gold-deep`;
const OUTLINE = `${BUTTON} border border-silver/35 text-silver hover:bg-silver/10 active:bg-silver/15`;
// Archivo Black ships one weight; font-bold would synthesize a smeared bold.
const DISPLAY = "font-display font-normal tracking-[-0.045em] text-pearl";
const EYEBROW = "text-xs font-semibold tracking-[0.2em] text-gold uppercase";
const PANEL = "rounded-xl border border-silver/10 bg-ballroom/40 p-4 sm:p-5";
const TEXT_LINK = `rounded-sm text-sm text-silver underline underline-offset-4 hover:text-pearl ${FOCUS}`;

type Load<T> = { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error"; message: string; retry: () => void };

function useLoad<T>(fetch: (season: string) => Promise<T>, season: string): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(season).then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) =>
        !cancelled &&
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : "Request failed",
          retry: () => {
            setLoad({ kind: "loading" });
            setAttempt((n) => n + 1);
          },
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [fetch, season, attempt]);

  return load;
}

/** The signed-in home for one season: where you are, how you're doing, what's next. */
export function Overview() {
  const season = useSeasonId();
  const load = useLoad(getOverview, season);

  if (load.kind === "loading") return <OverviewSkeleton />;
  if (load.kind === "error") return <LoadError what="your overview" message={load.message} retry={load.retry} />;
  return <OverviewView o={load.data} season={season} />;
}

function weekName(e: Pick<OverviewEpisode, "week" | "ep">, episodes: OverviewEpisode[]): string {
  const nights = episodes.filter((o) => o.week === e.week);
  if (nights.length < 2) return `Week ${e.week}`;
  return `Week ${e.week}, night ${nights.findIndex((o) => o.ep === e.ep) + 1}`;
}

interface ViewProps {
  o: OverviewData;
  season: string;
}

function OverviewView({ o, season }: ViewProps) {
  const couples = new Map(o.couples.map((c) => [c.id, c]));
  const judgeName = (id: string) => o.judges.find((j) => j.id === id)?.name ?? id;
  const fresh = o.me.scored === 0;
  const firstOpen = o.episodes.find((e) => e.aired && !e.complete);

  return (
    <div className="flex flex-col gap-8 pb-8">
      <Hero o={o} season={season} />

      <section aria-labelledby="your-season" className="flex flex-col gap-3">
        <h2 id="your-season" className="text-lg font-semibold text-pearl">
          Your season
        </h2>
        {fresh ? (
          <div className={`${PANEL} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-pearl">Your numbers start with your first paddle.</p>
              <p className="text-sm text-silver-dim">
                Score a dance before you see the judges and we&apos;ll track how close you land, week by week.
              </p>
            </div>
            {firstOpen && (
              <Link href={withSeason(`/episode/?ep=${firstOpen.ep}`, season)} className={`${GOLD} shrink-0`}>
                Score {weekName(firstOpen, o.episodes)}
              </Link>
            )}
          </div>
        ) : (
          <StatTiles o={o} />
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section aria-labelledby="accuracy" className={`${PANEL} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <h2 id="accuracy" className="text-lg font-semibold text-pearl">
                Accuracy by week
              </h2>
              <p className="text-sm text-silver-dim">
                Counts dances once every judge&apos;s score is confirmed.
              </p>
            </div>
            {o.me.count > 0 ? (
              <AccuracyChart episodes={o.episodes} />
            ) : (
              <p className="rounded-lg border border-dashed border-silver/15 px-4 py-10 text-center text-sm text-silver-dim">
                Score a dance and your gap to the judges draws here, one bar a week.
              </p>
            )}
          </section>

          <section aria-labelledby="reveals" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="reveals" className="text-lg font-semibold text-pearl">
                Latest reveals
              </h2>
              {o.reveals.length > 0 && (
                <Link href={withSeason("/stats/", season)} className={TEXT_LINK}>
                  All your stats
                </Link>
              )}
            </div>
            {o.reveals.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {o.reveals.map((r) => (
                  <li key={`${r.ep}-${r.key}`}>
                    <MiniDesk
                      reveal={r}
                      couple={couples.get(r.contestants[0])}
                      judgeName={judgeName}
                      weekLabel={weekName(o.episodes.find((e) => e.ep === r.ep) ?? { ep: r.ep, week: r.ep }, o.episodes)}
                      season={season}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-silver/15 px-4 py-8 text-center text-sm text-silver-dim">
                Each dance you score turns over here: the judges&apos; paddles next to yours.
              </p>
            )}
          </section>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-2 lg:flex lg:flex-col lg:items-stretch">
          <LeaderboardTop season={season} />
          <Standings couples={o.couples} />
        </div>
      </div>
    </div>
  );
}

function Hero({ o, season }: ViewProps) {
  const now = useNow(1000);
  const h = hero(o, now);
  const title = seasonLabel(o.season);

  let eyebrow = `Dancing with the Stars · ${title}`;
  let headline: string;
  let body: ReactNode;
  let cta: ReactNode = null;
  if (h.kind === "live") {
    const e = h.episode;
    eyebrow = `Live now · ${weekName(e, o.episodes)}`;
    headline = "you're on air.";
    body = (
      <>
        {e.theme ? `${e.theme} night is on.` : "The show is on."} Score each couple before the judges&apos; paddles
        turn over.
      </>
    );
    cta = (
      <Link href={withSeason(`/episode/?ep=${e.ep}`, season)} className={GOLD}>
        Score now
      </Link>
    );
  } else if (h.kind === "catchUp") {
    const e = h.episode;
    const where = `${weekName(e, o.episodes)}${e.theme ? `, ${e.theme}` : ""}`;
    headline = h.fresh ? "grab your paddle." : "catch up.";
    body = h.fresh
      ? `${o.progress.aired} ${o.progress.aired === 1 ? "episode has" : "episodes have"} aired. Start with ${where}: score every dance blind, then see how the judges did.`
      : `${h.waiting} ${h.waiting === 1 ? "episode" : "episodes"} left to finish, starting with ${where}.`;
    cta = (
      <Link href={withSeason(`/episode/?ep=${e.ep}`, season)} className={GOLD}>
        {h.fresh ? `Start with ${weekName(e, o.episodes)}` : "Catch up"}
      </Link>
    );
  } else if (h.kind === "upNext") {
    headline = "all caught up.";
    body = "Every dance so far has your paddle on it. The next episode opens for scoring at showtime.";
  } else {
    headline = "that's a wrap.";
    body = `${title} is over. You scored ${o.me.scored} ${o.me.scored === 1 ? "dance" : "dances"}.`;
    cta = (
      <Link href={withSeason("/leaderboard/", season)} className={OUTLINE}>
        See the leaderboard
      </Link>
    );
  }

  return (
    <section
      aria-labelledby="hero"
      className="relative isolate -mx-4 -mt-6 grid gap-6 overflow-hidden px-4 pt-10 pb-2 sm:-mx-6 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-12 lg:pt-14"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] bg-[radial-gradient(ellipse_45%_60%_at_80%_10%,rgb(232_194_104/0.12),transparent_70%),radial-gradient(ellipse_50%_70%_at_20%_0%,rgb(59_91_255/0.18),transparent_70%)]"
      />
      <div className="flex flex-col gap-4">
        <p className={`${EYEBROW} flex items-center gap-2`}>
          {h.kind === "live" && (
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-magenta motion-safe:animate-pulse" />
          )}
          {eyebrow}
        </p>
        <h1 id="hero" className={`${DISPLAY} text-[2.5rem] leading-[0.95] sm:text-6xl`}>
          <span className="text-chrome">{headline}</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-silver-dim">{body}</p>
        {cta && <div className="flex">{cta}</div>}
      </div>
      <NextEpisode o={o} now={now} />
    </section>
  );
}

function NextEpisode({ o, now }: { o: OverviewData; now: number }) {
  const { aired, total, couples, couplesLeft } = o.progress;
  const next = o.next;
  const left = next ? countdown(Date.parse(next.startsAt) - now) : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gold/25 bg-ink/70 p-4 backdrop-blur sm:p-5">
      {next && left ? (
        <>
          <div className="flex flex-col gap-1">
            <p className={EYEBROW}>Next episode</p>
            <p className="text-lg font-semibold text-pearl">
              {weekName(next, o.episodes)}
              {next.theme && <span className="text-silver"> · {next.theme}</span>}
            </p>
            <p className="text-sm text-silver-dim">
              {formatAirDate(next.airDate)} · {showTime(next.startsAt, o.timezone)}
            </p>
          </div>
          <div
            role="timer"
            aria-label={`Starts in ${left.days} days, ${left.hours} hours, ${left.minutes} minutes`}
            className="grid grid-cols-4 gap-2"
          >
            {(
              [
                ["days", left.days],
                ["hrs", left.hours],
                ["min", left.minutes],
                ["sec", left.seconds],
              ] as const
            ).map(([unit, n]) => (
              <div key={unit} aria-hidden="true" className="flex flex-col items-center rounded-lg bg-ballroom py-2">
                <span className="text-2xl font-semibold text-pearl tabular-nums sm:text-3xl">
                  {String(n).padStart(2, "0")}
                </span>
                <span className="text-[10px] tracking-[0.15em] text-silver-dim uppercase">{unit}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className={EYEBROW}>Season complete</p>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-silver">
            <span className="font-semibold text-pearl tabular-nums">{aired}</span> of {total} episodes aired
          </span>
          <span className="text-silver">
            <span className="font-semibold text-pearl tabular-nums">{couplesLeft}</span> of {couples} couples left
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Episodes aired"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={aired}
          className="h-1.5 overflow-hidden rounded-full bg-silver/10"
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${total ? (aired / total) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-silver-dim">Eliminations count once you finish that episode.</p>
      </div>
    </div>
  );
}

function StatTiles({ o }: { o: OverviewData }) {
  const { me } = o;
  const scoredEps = o.episodes.filter((e) => (e.scored ?? 0) > 0).length;
  const judge = me.closestJudge;

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label="Dances scored" value={String(me.scored)} note={`across ${scoredEps} ${scoredEps === 1 ? "episode" : "episodes"}`} />
      <Tile
        label="Average gap"
        value={me.mae === null ? "-" : formatScore(me.mae)}
        unit={me.mae === null ? undefined : "off"}
        note={me.mae === null ? "once a judge's score confirms" : `vs the judges, over ${me.count}`}
      />
      <Tile
        label="Closest judge"
        value={judge?.name?.split(" ")[0] ?? "-"}
        note={judge ? `${formatScore(judge.mae)} off on average` : "needs a confirmed dance"}
      />
      <Tile
        label="Streak"
        value={String(me.streak)}
        unit={me.streak === 1 ? "episode" : "episodes"}
        note="finished in a row"
      />
    </dl>
  );
}

function Tile({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-silver/10 bg-ballroom/40 p-4">
      <dt className="text-xs font-medium tracking-[0.12em] text-silver-dim uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-3xl font-semibold text-pearl tabular-nums">
          {value}
          {unit && <span className="ml-1.5 text-sm font-medium text-silver">{unit}</span>}
        </span>
        <span className="truncate text-xs text-silver-dim">{note}</span>
      </dd>
    </div>
  );
}

function LeaderboardTop({ season }: { season: string }) {
  const load = useLoad(getLeaderboard, season);

  return (
    <section aria-labelledby="top-five" className={`${PANEL} flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="top-five" className="text-lg font-semibold text-pearl">
          Leaderboard
        </h2>
        <Link href={withSeason("/leaderboard/", season)} className={TEXT_LINK}>
          Full board
        </Link>
      </div>
      {load.kind === "loading" && <SkeletonRows n={5} />}
      {load.kind === "error" && <LoadError what="the leaderboard" message={load.message} retry={load.retry} />}
      {load.kind === "ready" && <TopFive board={load.data} />}
    </section>
  );
}

function TopFive({ board }: { board: Leaderboard }) {
  const top = board.ranked.slice(0, 5);
  if (top.length === 0) {
    return (
      <p className="text-sm text-silver-dim">
        Nobody has {board.minDances} confirmed dances yet. Rankings open at {board.minDances}.
      </p>
    );
  }
  return (
    <>
      <ol className="flex flex-col">
        {top.map((s) => {
          const you = s.sub === board.me.sub;
          return (
            <li
              key={s.sub}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 ${you ? "bg-gold/10" : ""}`}
            >
              <span className={`w-5 text-center text-sm font-semibold tabular-nums ${s.rank === 1 ? "text-gold" : "text-silver-dim"}`}>
                {s.rank}
              </span>
              <Avatar name={s.name ?? "Player"} email="" picture={s.picture} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-pearl">
                  {s.name ?? "Player"}
                  {you && <span className="text-gold-light"> (you)</span>}
                </span>
                <span className="block text-xs text-silver-dim tabular-nums">
                  {s.count} {s.count === 1 ? "dance" : "dances"}
                </span>
              </span>
              <span className="text-sm font-semibold text-pearl tabular-nums">
                {formatScore(s.mae)}
                <span className="ml-1 text-xs font-normal text-silver-dim">off</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-silver-dim">
        Ranked by average gap to the judges, {board.minDances} dances minimum.
        {board.me.rank !== null && !top.some((s) => s.sub === board.me.sub) && ` You're #${board.me.rank}.`}
      </p>
    </>
  );
}

const STANDINGS_SHOWN = 6;

function Standings({ couples }: { couples: CoupleStanding[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? couples : couples.slice(0, STANDINGS_SHOWN);
  const top = Math.max(...couples.map((c) => c.average ?? 0));

  return (
    <section aria-labelledby="standings" className={`${PANEL} flex flex-col gap-3`}>
      <div className="flex flex-col gap-1">
        <h2 id="standings" className="text-lg font-semibold text-pearl">
          Couples
        </h2>
        <p className="text-sm text-silver-dim">Judges&apos; average over the dances you&apos;ve scored.</p>
      </div>
      <ol id="standings-list" className="flex flex-col">
        {shown.map((c) => {
          const celebrity = c.members.find((m) => m.role === "celebrity") ?? c.members[0];
          const pro = c.members.find((m) => m.role === "pro");
          return (
            <li key={c.id} className={`flex items-center gap-3 py-2 ${c.out ? "opacity-60" : ""}`}>
              <Headshot person={celebrity} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-pearl">{celebrity.name}</span>
                  {c.out && (
                    <span className="shrink-0 rounded-sm border border-silver/25 px-1 text-[10px] tracking-[0.1em] text-silver-dim uppercase">
                      Out
                    </span>
                  )}
                </span>
                {pro && <span className="block truncate text-xs text-silver-dim">with {pro.name}</span>}
                {c.average !== null && (
                  <span aria-hidden="true" className="mt-1 block h-1 rounded-full bg-silver/10">
                    <span
                      className={`block h-full rounded-full ${c.average === top ? "bg-gold-light" : "bg-gold/70"}`}
                      style={{ width: `${(c.average / 10) * 100}%` }}
                    />
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                {c.average === null ? (
                  <span className="text-silver-dim">
                    -<span className="sr-only">no scored dances yet</span>
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-pearl">{formatScore(c.average)}</span>
                    <span className="block text-[11px] text-silver-dim">
                      {c.dances} {c.dances === 1 ? "dance" : "dances"}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {couples.length > STANDINGS_SHOWN && (
        <button
          type="button"
          aria-expanded={all}
          aria-controls="standings-list"
          onClick={() => setAll((a) => !a)}
          className={`${BUTTON} min-h-11 border border-silver/20 text-sm text-silver hover:bg-silver/10 active:bg-silver/15`}
        >
          {all ? "Show fewer" : `Show all ${couples.length} couples`}
        </button>
      )}
    </section>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-10 rounded-lg bg-silver/5 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <p className="sr-only">Loading your overview...</p>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4 pt-4">
          <div className="h-3 w-48 rounded bg-silver/10 motion-safe:animate-pulse" />
          <div className="h-14 w-3/4 rounded bg-silver/10 motion-safe:animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-silver/5 motion-safe:animate-pulse" />
        </div>
        <div className="h-48 rounded-xl bg-silver/5 motion-safe:animate-pulse" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl bg-silver/5 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
