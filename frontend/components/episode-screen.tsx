"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { LoadError } from "@/components/load-error";
import { PerformanceCard } from "@/components/performance-card";
import { SignedIn } from "@/components/signed-in";
import { submitScore, type Answer, type Episode, type LockedCard, type Season } from "@/lib/api/show";
import { episodeLabel, formatAirDate, hasAired, latestAired } from "@/lib/show/schedule";
import { useEpisodeState } from "@/lib/show/use-episode-state";
import { useNow } from "@/lib/show/use-now";
import { useSeason } from "@/lib/show/use-season";

export function EpisodeScreen() {
  return (
    <SignedIn title="Scorecard">
      <SeasonLoader />
    </SignedIn>
  );
}

function SeasonLoader() {
  const load = useSeason();
  if (load.kind === "loading") return <p className="text-neutral-400">Loading the season...</p>;
  if (load.kind === "error") return <LoadError what="the season" message={load.message} retry={load.retry} />;
  return <EpisodePicker season={load.season} />;
}

interface EpisodePickerProps {
  season: Season;
}

function EpisodePicker({ season }: EpisodePickerProps) {
  const router = useRouter();
  const now = useNow();
  const asked = Number(useSearchParams().get("ep"));
  const episode =
    season.episodes.find((e) => e.ep === asked) ??
    latestAired(season.episodes, season.timezone, now);

  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-400">
        Episode
        <select
          value={episode.ep}
          onChange={(e) => router.replace(`/episode/?ep=${e.target.value}`)}
          className="min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          {season.episodes.map((e) => (
            <option key={e.ep} value={e.ep}>
              {[episodeLabel(e, season.episodes), e.theme, formatAirDate(e.airDate)].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
      </label>
      <EpisodeView key={episode.ep} season={season} episode={episode} now={now} />
      <Link
        href="/credits/"
        className="self-start rounded-md text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        Photo credits
      </Link>
    </>
  );
}

interface EpisodeViewProps {
  season: Season;
  episode: Episode;
  now: number;
}

function EpisodeView({ season, episode, now }: EpisodeViewProps) {
  const { data, error, reload } = useEpisodeState(season.season, season.timezone, episode);
  const contestants = useMemo(() => new Map(season.contestants.map((c) => [c.id, c])), [season]);
  const judges = useMemo(() => new Map(season.judges.map((j) => [j.id, j])), [season]);

  if (data === null) {
    if (error !== null) return <LoadError what="this episode" message={error} retry={reload} />;
    return <p className="text-neutral-400">Loading the episode...</p>;
  }

  const airsOn = hasAired(episode, season.timezone, now) ? null : formatAirDate(episode.airDate);
  const submit = async (card: LockedCard, answer: Answer) => {
    try {
      await submitScore(season.season, episode.ep, card, answer);
    } finally {
      // Also after a 409: the answer from another device is what the card should show.
      reload();
    }
  };
  const out = (data.eliminated ?? []).map(
    (id) => contestants.get(id)?.members.find((m) => m.role === "celebrity")?.name ?? id,
  );

  return (
    <section aria-labelledby="episode-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 id="episode-title" className="text-xl font-semibold tracking-tight">
          {episode.theme ?? episodeLabel(episode, season.episodes)}
        </h1>
        <p className="shrink-0 text-sm tabular-nums text-neutral-400">
          {data.answered} of {data.rateable} answered
        </p>
      </div>
      {error !== null && (
        <p role="status" className="text-sm text-amber-200">
          Couldn&apos;t refresh: {error}. Showing the last scores loaded.
        </p>
      )}
      {out.length > 0 && (
        <p className="rounded-md border border-neutral-700 px-3 py-2 text-sm">
          Eliminated: {out.join(", ")}
        </p>
      )}
      {data.performances.length === 0 ? (
        <p className="text-neutral-400">No performances in this episode yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.performances.map((card) => (
            <li key={card.key}>
              <PerformanceCard
                card={card}
                contestants={contestants}
                judges={judges}
                airsOn={airsOn}
                onSubmit={submit}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
