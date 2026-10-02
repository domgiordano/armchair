"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Outcome } from "@/components/outcome";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getStats, type EpisodeEvent, type Player, type SeasonEpisode, type SeasonView, type Stats } from "@/lib/api/traitors";
import { nameOf } from "@/lib/players";
import { multiplier } from "@/lib/points";
import { countdown, episodeLabel, formatRelease, latestUnlocked, nextRelease, toCall } from "@/lib/schedule";
import { withSeason } from "@/lib/seasons";
import { useEpisode } from "@/lib/use-episode";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";
import { useNow } from "@armchair/app-core/show/use-now";

export function Overview() {
  const { view } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const now = useNow();
  const due = toCall(view.episodes, now);
  const latest = latestUnlocked(view.episodes, now);
  // Episode 1's roster is the whole cast, and gives nothing away.
  const cast = useEpisode(view.season, view.episodes[0]?.ep ?? null).load;
  const players = cast.kind === "ready" ? cast.episode.roster : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{name.eyebrow}</p>
        <h1 className={cn(HEADING, "text-3xl")}>{name.title}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PointsCard view={view} players={players} />
        <NextCard next={nextRelease(view.episodes, now)} now={now} current={view.current} />
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
      {latest ? (
        <LatestResults key={latest.ep} season={view.season} episode={latest} />
      ) : (
        <EmptyState title="No results yet">Results show here once you&apos;ve made every call in an episode.</EmptyState>
      )}
    </>
  );
}

function PointsCard({ view, players }: { view: SeasonView; players: Player[] | null }) {
  const [load, setLoad] = useState<{ stats: Stats } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats(view.season).then(
      (stats) => !cancelled && setLoad({ stats }),
      (e: unknown) => !cancelled && setLoad({ error: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [view.season]);

  const episodes = view.episodes.length;
  return (
    <Card className="flex flex-col gap-2">
      <p className={EYEBROW}>Your points</p>
      {load === null && <Skeleton className="h-12 w-24" />}
      {load !== null && "error" in load && <p className="text-ash">Points couldn&apos;t load: {load.error}</p>}
      {load !== null && "stats" in load && (
        <>
          <p className="font-display text-5xl font-semibold text-candle nums">{load.stats.points}</p>
          <p className="text-ash">
            <span className="nums">{load.stats.events}</span> calls scored ·{" "}
            <span className="nums">{load.stats.banishHits}</span> banishments called
          </p>
        </>
      )}
      {view.bet && (
        <p className="border-t border-gilt/20 pt-2 text-parchment">
          Your winner bet:{" "}
          {view.bet.picks.map((p, i) => (
            <span key={p.player}>
              {i > 0 && " and "}
              <span className="text-bone">{nameOf(p.player, players)}</span> as {p.faction === "Traitor" ? "a Traitor" : "a Faithful"}
            </span>
          ))}
          , worth <span className="nums">{Math.round(multiplier(episodes, view.bet.released) * 100)}%</span>.
        </p>
      )}
    </Card>
  );
}

function NextCard({ next, now, current }: { next: SeasonEpisode | null; now: number; current: boolean }) {
  return (
    <Card className="flex flex-col gap-2">
      <p className={EYEBROW}>Next episode</p>
      {next ? (
        <>
          <p className="font-display text-3xl font-semibold text-bone nums">{countdown(Date.parse(next.releaseAt) - now)}</p>
          <p className="text-parchment">
            {episodeLabel(next)} · {formatRelease(next.releaseAt)}
          </p>
        </>
      ) : (
        <p className="text-parchment">{current ? "Every episode is out. The winner bet settles at the finale." : "This season is over."}</p>
      )}
    </Card>
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
                <Outcome event={e} roster={load.episode.roster} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
