"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useBet } from "@/components/bet";
import { CastWall } from "@/components/cast-wall";
import { Outcome } from "@/components/outcome";
import { PlayerLink, seasonPlayerHref } from "@/components/player-link";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getRanks, type CastMember, type EpisodeEvent, type SeasonEpisode, type SeasonView, type Standing } from "@/lib/api/traitors";
import { finishText } from "@/lib/history";
import { nameOf } from "@/lib/players";
import { multiplier } from "@/lib/points";
import { countdown, episodeLabel, formatRelease, latestUnlocked, nextRelease, released, toCall } from "@/lib/schedule";
import { showOf, withSeason } from "@/lib/seasons";
import { useEpisode } from "@/lib/use-episode";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";
import { useNow } from "@armchair/app-core/show/use-now";

/** Still in first, then whoever lasted longest. */
const byStanding = (cast: CastMember[]) =>
  [...cast].sort((a, b) => (b.exit?.ep ?? 1000) - (a.exit?.ep ?? 1000) || a.name.localeCompare(b.name));

/** The live season at a glance: how far in, where you stand, who's left and which Traitors are out. */
export function Overview() {
  const { view } = useSeasonView();
  const { needed } = useBet();
  const name = useSeasonName(view.season, view.title);
  const now = useNow();
  const due = needed ? [] : toCall(view.episodes, now);
  const latest = latestUnlocked(view.episodes, now);
  const unmasked = view.cast.filter((p) => p.faction === "Traitor" && p.exit);
  const hrefOf = seasonPlayerHref(view.season);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{name.eyebrow}</p>
        <h1 className={cn(HEADING, "text-3xl leading-tight sm:text-4xl")}>{name.title}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProgressCard episodes={view.episodes} now={now} />
        <StandingCard view={view} />
      </div>
      {due.length > 0 && (
        <Card tone="cloak" tartan className="flex flex-col items-start gap-3">
          <p className={cn(EYEBROW, "text-ember")}>Your calls</p>
          <p className="text-lg text-bone">
            {due.length === 1
              ? `Episode ${due[0].ep} is waiting for your calls.`
              : `${due.length} episodes are waiting for your calls, starting with episode ${due[0].ep}.`}
          </p>
          <Link href={withSeason(`/episode/?ep=${due[0].ep}`, view.season)} className={button("gold")}>
            Make your calls
          </Link>
        </Card>
      )}

      <section aria-labelledby="unmasked" className="flex flex-col gap-3">
        <h2 id="unmasked" className={EYEBROW}>
          Traitors unmasked
        </h2>
        {unmasked.length === 0 ? (
          <p className="text-ash">No Traitor has been caught yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {unmasked.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link href={hrefOf(p.id)} aria-hidden="true" tabIndex={-1}>
                  <Headshot name={p.name} image={p.headshot} exit={p.exit} size={52} />
                </Link>
                <span className="flex flex-col">
                  <PlayerLink season={view.season} id={p.id} className="text-bone">
                    {p.name}
                  </PlayerLink>
                  <span className="text-sm text-blood-hi">{finishText(p.exit)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cast" className="flex flex-col gap-3">
        <h2 id="cast" className={EYEBROW}>
          The castle
        </h2>
        {view.cast.length === 0 ? (
          <EmptyState title="No cast yet">The players appear once the season is announced.</EmptyState>
        ) : (
          <CastWall players={byStanding(view.cast)} hrefOf={hrefOf} />
        )}
      </section>

      {latest ? (
        <LatestResults key={latest.ep} season={view.season} episode={latest} />
      ) : (
        <EmptyState title="No results yet">Results show here once you&apos;ve made every call in an episode.</EmptyState>
      )}
    </>
  );
}

function ProgressCard({ episodes, now }: { episodes: SeasonEpisode[]; now: number }) {
  const out = episodes.filter((e) => released(e, now)).length;
  const next = nextRelease(episodes, now);
  return (
    <Card className="flex flex-col gap-2">
      <p className={EYEBROW}>The season so far</p>
      <p className="font-display text-2xl font-semibold text-bone">
        Episode <span className="nums">{out}</span> <span className="text-ash">of</span>{" "}
        <span className="nums">{episodes.length}</span>
      </p>
      <span
        role="progressbar"
        aria-label="Episodes out"
        aria-valuemin={0}
        aria-valuemax={episodes.length}
        aria-valuenow={out}
        className="flex h-2 gap-0.5"
      >
        {episodes.map((e) => (
          <span key={e.ep} className={cn("flex-1 rounded-[1px]", e.ep <= out ? "bg-candle" : "bg-night ring-1 ring-gilt/30")} />
        ))}
      </span>
      {next ? (
        <p className="pt-1 text-parchment">
          <span className="font-display text-xl font-semibold text-candle nums">{countdown(Date.parse(next.releaseAt) - now)}</span> to{" "}
          {episodeLabel(next)} · {formatRelease(next.releaseAt)}
        </p>
      ) : (
        <p className="pt-1 text-parchment">Every episode is out. The winner bet settles at the finale.</p>
      )}
    </Card>
  );
}

function StandingCard({ view }: { view: SeasonView }) {
  const [load, setLoad] = useState<{ me: Standing } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRanks(view.season, showOf(view.season), "global", null).then(
      (ranks) => !cancelled && setLoad({ me: ranks.me }),
      (e: unknown) => !cancelled && setLoad({ error: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [view.season]);

  return (
    <Card className="flex flex-col gap-2">
      <p className={EYEBROW}>Your standing</p>
      {load === null && <Skeleton className="h-12 w-32" />}
      {load !== null && "error" in load && <p className="text-ash">Points couldn&apos;t load: {load.error}</p>}
      {load !== null && "me" in load && (
        <>
          <p className="flex items-baseline gap-3">
            <span className="font-display text-5xl font-semibold text-candle nums">{load.me.points}</span>
            <span className="text-ash">points</span>
            {load.me.points > 0 && (
              <span className="ml-auto font-display text-xl text-bone">
                Rank <span className="nums">{load.me.rank}</span>
              </span>
            )}
          </p>
          <p className="text-ash">
            <span className="nums">{load.me.events}</span> calls scored · <span className="nums">{load.me.banishHits}</span>{" "}
            banishments called
          </p>
        </>
      )}
      <BetLine view={view} />
    </Card>
  );
}

function BetLine({ view }: { view: SeasonView }) {
  const { needed, open } = useBet();
  if (needed) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gilt/20 pt-2 text-parchment">
        No winner bet yet.
        <button type="button" onClick={() => open()} className={button("outline", "sm")}>
          Lock in your winners
        </button>
      </p>
    );
  }
  if (!view.bet) return null;
  const { picks } = view.bet;
  return (
    <p className="border-t border-gilt/20 pt-2 text-parchment">
      Your winner bet:{" "}
      {picks.map((p, i) => (
        <span key={p.player}>
          {i > 0 && (i === picks.length - 1 ? " and " : ", ")}
          <PlayerLink season={view.season} id={p.player} className="text-bone">
            {nameOf(p.player, view.cast)}
          </PlayerLink>{" "}
          as {p.faction === "Traitor" ? "a Traitor" : "a Faithful"}
        </span>
      ))}
      , worth <span className="nums">{Math.round(multiplier(view.episodes.length, view.bet.released) * 100)}%</span>.
    </p>
  );
}

const EVENT_NAMES: Record<EpisodeEvent["type"], string> = { MURDER: "Murdered", RT: "Banished", RECRUIT: "Recruited" };

function LatestResults({ season, episode }: { season: string; episode: SeasonEpisode }) {
  const { load, retry } = useEpisode(season, episode.ep);
  const href = withSeason(`/episode/?ep=${episode.ep}`, season);

  return (
    <Card as="section" aria-labelledby="latest-title" tartan className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="latest-title" className={cn(HEADING, "text-xl")}>
          {episodeLabel(episode)}
        </h2>
        <Link href={href} className="shrink-0 text-sm text-parchment underline decoration-gilt/50 underline-offset-4 hover:text-candle">
          Open
        </Link>
      </div>
      {load.kind === "loading" && <Skeleton className="h-16" />}
      {load.kind === "error" && <ErrorState what="the results" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <dl className="flex flex-col gap-2">
          {load.episode.events.map((e) => (
            <div key={e.type} className="flex flex-wrap items-baseline gap-x-3">
              <dt className="w-24 shrink-0 font-display text-xs tracking-[0.14em] text-ash uppercase">{EVENT_NAMES[e.type]}</dt>
              <dd className="text-bone">
                <Outcome event={e} roster={load.episode.roster} season={season} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
