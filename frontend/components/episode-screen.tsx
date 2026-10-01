"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { CatchUp } from "@/components/catch-up";
import { PageLoader } from "@/components/disco-loader";
import { GroupPicker } from "@/components/group-picker";
import { PerformanceCard } from "@/components/performance-card";
import { RevealAll } from "@/components/reveal-all";
import { SignedIn } from "@/components/signed-in";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { VotePanel } from "@/components/vote-panel";
import type { GroupMember } from "@/lib/api/groups";
import { revealAll, submitScore, type Answer, type Episode, type LockedCard, type Season } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { episodeLabel, formatAirDate, hasAired, latestAired } from "@/lib/show/schedule";
import { useEpisodeState } from "@/lib/show/use-episode-state";
import { useNow } from "@/lib/show/use-now";
import { withSeason } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { TEXT_LINK } from "@/lib/ui";

export function EpisodeScreen() {
  return (
    <SignedIn title="Scorecard" wide>
      <SeasonLoader />
    </SignedIn>
  );
}

function SeasonLoader() {
  const load = useSeason();
  if (load.kind === "loading") return <PageLoader label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <EpisodePicker season={load.season} />;
}

interface EpisodePickerProps {
  season: Season;
}

function EpisodePicker({ season }: EpisodePickerProps) {
  const router = useRouter();
  const now = useNow();
  const asked = Number(useSearchParams().get("ep"));
  const filter = useGroupFilter();
  const episode =
    season.episodes.find((e) => e.ep === asked) ??
    latestAired(season.episodes, season.timezone, now);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 md:items-end">
        <Select
          label="Episode"
          value={String(episode.ep)}
          options={season.episodes.map((e) => ({
            value: String(e.ep),
            label: [episodeLabel(e, season.episodes), e.theme].filter(Boolean).join(" · "),
            detail: formatAirDate(e.airDate),
          }))}
          onChange={(ep) => router.replace(withSeason(`/episode/?ep=${ep}`, season.season))}
        />
        <GroupPicker {...filter} />
      </div>
      <CatchUp
        key={episode.ep}
        season={season.season}
        tz={season.timezone}
        episodes={season.episodes}
        episode={episode}
        now={now}
        onFinishPrevious={(previous) => router.replace(withSeason(`/episode/?ep=${previous.ep}`, season.season))}
      >
        <EpisodeView
          season={season}
          episode={episode}
          now={now}
          group={filter.group}
          members={filter.groups?.find((g) => g.id === filter.group)?.members ?? null}
        />
      </CatchUp>
      <div className="flex flex-wrap gap-x-6 border-t border-silver/10 pt-2">
        <Link href="/stats/" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
          Your accuracy
        </Link>
        <Link href="/credits/" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
          Photo credits
        </Link>
      </div>
    </>
  );
}

interface EpisodeViewProps {
  season: Season;
  episode: Episode;
  now: number;
  group: string | null;
  members: GroupMember[] | null;
}

function EpisodeView({ season, episode, now, group, members }: EpisodeViewProps) {
  const { data, error, reload } = useEpisodeState(season.season, season.timezone, episode, group);
  const contestants = useMemo(() => new Map(season.contestants.map((c) => [c.id, c])), [season]);
  const judges = useMemo(() => new Map(season.judges.map((j) => [j.id, j])), [season]);

  if (data === null) {
    if (error !== null) return <ErrorState what="this episode" message={error} retry={reload} />;
    return <EpisodeSkeleton label="Loading the episode" />;
  }

  const airsOn = hasAired(episode, season.timezone, now) ? null : formatAirDate(episode.airDate);
  const revealRest = async () => {
    try {
      await revealAll(season.season, episode.ep);
    } finally {
      reload();
    }
  };
  const submit = async (card: LockedCard, answer: Answer) => {
    try {
      await submitScore(season.season, episode.ep, card, answer);
    } finally {
      // Also after a 409: the answer from another device is what the card should show.
      reload();
    }
  };
  // The cards cover exactly the couples still in that night, so the vote list
  // leaks nothing the scorecard doesn't already show.
  const couples = [...new Set(data.performances.flatMap((card) => card.contestants))].flatMap(
    (id) => contestants.get(id) ?? [],
  );
  const out = (data.eliminated ?? []).map(
    (id) => contestants.get(id)?.members.find((m) => m.role === "celebrity")?.name ?? id,
  );

  return (
    <section aria-labelledby="episode-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              {episodeLabel(episode, season.episodes)}
            </p>
            <h1 id="episode-title" className="text-2xl leading-tight font-semibold tracking-tight text-pearl">
              {episode.theme ?? episodeLabel(episode, season.episodes)}
            </h1>
          </div>
          <p className="shrink-0 pb-0.5 text-sm text-silver-dim tabular-nums">
            {data.answered} of {data.rateable} answered
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Dances answered"
          aria-valuemin={0}
          aria-valuemax={data.rateable}
          aria-valuenow={data.answered}
          className="h-1 overflow-hidden rounded-full bg-silver/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-light transition-[width] duration-700"
            style={{ width: `${data.rateable ? (data.answered / data.rateable) * 100 : 0}%` }}
          />
        </div>
      </div>
      {airsOn === null && data.answered < data.rateable && (
        <RevealAll open={data.rateable - data.answered} onConfirm={revealRest} />
      )}
      {error !== null && (
        <p role="status" className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">
          Couldn&apos;t refresh: {error}. Showing the last scores loaded.
        </p>
      )}
      {out.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-silver/15 bg-ink/40 px-3 py-2 text-sm text-silver">
          <span className="text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">Eliminated</span>
          {out.join(", ")}
        </p>
      )}
      {data.performances.length === 0 ? (
        <EmptyState title="No dances yet">Performances appear here once the running order is in.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.performances.map((card) => (
            <li key={card.key}>
              <PerformanceCard
                card={card}
                contestants={contestants}
                judges={judges}
                airsOn={airsOn}
                members={members}
                onSubmit={submit}
              />
            </li>
          ))}
        </ul>
      )}
      <VotePanel episode={episode} tz={season.timezone} couples={couples} now={now} />
    </section>
  );
}

function EpisodeSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}...</span>
      <div className="flex flex-col gap-2 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-silver/10 bg-ballroom/30 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, k) => (
              <Skeleton key={k} className="h-14" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
