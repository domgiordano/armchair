"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useBet } from "@/components/bet";
import { CastTable } from "@/components/cast-wall";
import { Outcome } from "@/components/outcome";
import { PlayerChip } from "@/components/player-chip";
import { PlayerLink, seasonPlayerHref } from "@/components/player-link";
import { SealedScroll } from "@/components/recap";
import { YourPicks } from "@/components/your-picks";
import { Credit } from "@/components/writeup";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getRanks, type CastMember, type EpisodeEvent, type SeasonEpisode, type SeasonView, type Standing } from "@/lib/api/traitors";
import { finishText } from "@/lib/history";
import { playerOf, roman } from "@/lib/players";
import { multiplier, placeWorth } from "@/lib/points";
import { excerpt } from "@/lib/recap";
import { countdown, episodeLabel, formatRelease, latestUnlocked, nextRelease, released, toCall, unlocked } from "@/lib/schedule";
import { showOf, withSeason } from "@/lib/seasons";
import { useEpisode } from "@/lib/use-episode";
import { button, cn, EYEBROW, FOCUS, HEADING } from "@/lib/ui";
import { useNow } from "@armchair/app-core/show/use-now";

/** Still in first, then whoever lasted longest. */
const byStanding = (cast: CastMember[]) =>
  [...cast].sort((a, b) => (b.exit?.ep ?? 1000) - (a.exit?.ep ?? 1000) || a.name.localeCompare(b.name));

// Each unlocked one costs an episode read, so the list stops here; the rest are a tab away.
const PREVIOUSLY = 4;

/** The live season at a glance: how far in, where you stand, who's left and which Traitors are out. */
export function Overview() {
  const { view } = useSeasonView();
  const { needed } = useBet();
  const name = useSeasonName(view.season, view.title);
  const now = useNow();
  const due = needed ? [] : toCall(view.episodes, now);
  const latest = latestUnlocked(view.episodes, now);
  const earlier = view.episodes
    .filter((e) => released(e, now) && e.ep !== latest?.ep)
    .reverse()
    .slice(0, PREVIOUSLY);
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
      <WinnerPicks view={view} />
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

      <section aria-labelledby="latest" className="flex flex-col gap-3">
        <h2 id="latest" className={EYEBROW}>
          Latest in the castle
        </h2>
        {latest ? (
          <LatestResults key={latest.ep} season={view.season} episode={latest} cast={view.cast} />
        ) : (
          <EmptyState title="Nothing unsealed yet">
            What happened in an episode shows here once you&apos;ve made every call in it.
          </EmptyState>
        )}
      </section>
      {earlier.length > 0 && (
        <section aria-labelledby="previously" className="flex flex-col gap-3">
          <h2 id="previously" className={EYEBROW}>
            Previously on
          </h2>
          <ol className="flex flex-col">
            {earlier.map((e) => (
              <Previously key={e.ep} season={view.season} episode={e} cast={view.cast} />
            ))}
          </ol>
        </section>
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
          <CastTable players={byStanding(view.cast)} hrefOf={hrefOf} season={view.season} />
        )}
      </section>
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
    </Card>
  );
}

const PLACES = ["1st", "2nd", "3rd"];

const upTo = (rank: number, share: number) => {
  const w = placeWorth(rank, share);
  return w.winner + w.faction;
};

/** Your ranked winners: each sealed place with what it's worth, and a way to fill the empty ones. */
function WinnerPicks({ view }: { view: SeasonView }) {
  const { needed, incomplete, open } = useBet();
  if (needed) {
    return (
      <Card tone="blood" className="flex flex-col items-start gap-3">
        <p className={cn(EYEBROW, "text-flame")}>Your winner picks</p>
        <p className="text-lg text-bone">You haven&apos;t picked your winners yet. Your calls open once your 1st is sealed.</p>
        <button type="button" onClick={() => open()} className={button("gold", "sm")}>
          Lock in your winners
        </button>
      </Card>
    );
  }
  if (!view.bet) return null;
  const { picks } = view.bet;
  const won = new Set((view.winners ?? []).map((w) => w.id));
  const hrefOf = seasonPlayerHref(view.season);
  return (
    <Card as="section" aria-labelledby="winner-picks" className="flex flex-col gap-3">
      <h2 id="winner-picks" className={EYEBROW}>
        Your winner picks
      </h2>
      <ol className="flex flex-col gap-2">
        {PLACES.map((place, i) => {
          const p = picks[i];
          return (
            <li key={place} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bone/10 pb-2 last:border-b-0 last:pb-0">
              <span className="w-8 font-display text-lg text-gilt">{roman(i + 1)}</span>
              {p ? (
                <>
                  <PlayerChip player={playerOf(p.player, view.cast)} href={hrefOf(p.player)} size={32} />
                  <span className="text-parchment">as {p.faction === "Traitor" ? "a Traitor" : "a Faithful"}</span>
                  <span className="ml-auto text-sm text-ash">
                    {won.has(p.player) ? (
                      <span className="text-candle">Won</span>
                    ) : (
                      <>
                        up to <span className="nums">{upTo(i, multiplier(view.episodes.length, p.released))}</span> pts
                      </>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-ash">Your {place} choice is empty</span>
                  {incomplete && i === picks.length && (
                    <button type="button" onClick={() => open()} className={cn(button("outline", "sm"), "ml-auto")}>
                      Add your {place} choice
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const EVENT_NAMES: Record<EpisodeEvent["type"], string> = { MURDER: "Murdered", RT: "Banished", RECRUIT: "Recruited" };

function LatestResults({ season, episode, cast }: { season: string; episode: SeasonEpisode; cast: CastMember[] }) {
  const { load, retry } = useEpisode(season, episode.ep);
  const href = withSeason(`/episode/?ep=${episode.ep}`, season);

  return (
    <Card as="article" aria-labelledby="latest-title" tartan className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className={EYEBROW}>Episode {roman(episode.ep)}</p>
        <h3 id="latest-title" className={cn(HEADING, "text-xl leading-tight")}>
          {episodeLabel(episode)}
        </h3>
        <YourPicks mine={episode.mine} players={cast} className="pt-1" />
      </div>
      {load.kind === "loading" && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Loading the episode...</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      )}
      {load.kind === "error" && <ErrorState what="the results" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <>
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
          <div className="flex flex-col gap-2 border-t border-gilt/20 pt-3">
            {load.episode.recap ? (
              <>
                <p className="text-lg leading-relaxed text-parchment">{excerpt(load.episode.recap.text, 420)}</p>
                <Credit writeup={load.episode.recap} />
              </>
            ) : (
              <p className="text-ash">The recap isn&apos;t written yet.</p>
            )}
          </div>
        </>
      )}
      <Link href={href} className={cn(button("outline", "sm"), "self-start")}>
        Open the episode
      </Link>
    </Card>
  );
}

/** One earlier episode: the opening of its recap, or the sealed scroll until your calls are in. */
function Previously({ season, episode, cast }: { season: string; episode: SeasonEpisode; cast: CastMember[] }) {
  const open = unlocked(episode);
  // A finished season's schedule carries its recaps; a live one's need the episode read.
  const known = episode.recap !== undefined;
  const { load, retry } = useEpisode(season, open && !known ? episode.ep : null);
  const recap = known ? episode.recap : load.kind === "ready" ? (load.episode.recap ?? null) : undefined;
  const href = withSeason(`/episode/?ep=${episode.ep}`, season);
  const id = `previously-${episode.ep}`;

  return (
    <li aria-labelledby={id} className="flex flex-col gap-2 border-t border-gilt/20 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <p className={EYEBROW}>Episode {roman(episode.ep)}</p>
        <h3 id={id} className="font-display text-lg leading-tight font-semibold">
          <Link
            href={href}
            className={cn(FOCUS, "rounded-sm text-bone decoration-candle underline-offset-4 transition-colors hover:text-candle hover:underline")}
          >
            {episodeLabel(episode)}
          </Link>
        </h3>
        <YourPicks mine={episode.mine} players={cast} className="pt-1" />
      </div>
      {!open ? (
        <SealedScroll bare href={href} />
      ) : recap === undefined ? (
        load.kind === "error" ? (
          <ErrorState what="the recap" message={load.message} retry={retry} />
        ) : (
          <Skeleton className="h-12" />
        )
      ) : recap ? (
        <>
          <p className="leading-relaxed text-parchment">{excerpt(recap.text, 220)}</p>
          <Credit writeup={recap} />
        </>
      ) : (
        <p className="text-ash">No recap on record yet.</p>
      )}
    </li>
  );
}
