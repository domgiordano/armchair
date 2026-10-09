"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { CatchUp } from "@/components/catch-up";
import { PageLoader } from "@/components/disco-loader";
import { GroupPicker, scopeName } from "@/components/group-picker";
import { PerformanceCard } from "@/components/performance-card";
import { danceId, FindCouple } from "@/components/find-couple";
import { OrderNote } from "@/components/order-note";
import { RevealAll } from "@/components/reveal-all";
import { RevealSheet } from "@/components/reveal-sheet";
import { ResultsReveal } from "@/components/results-reveal";
import { SignedIn } from "@/components/signed-in";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { VotePanel } from "@/components/vote-panel";
import type { Group } from "@armchair/app-core/api/groups";
import { CLOSED, revealAll, submitScore, type Answer, type Episode, type LockedCard, type Season } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { cues as cuesOf, findCards, type Cue } from "@/lib/show/running";
import { episodeLabel, formatAirDate, hasAired, isLive, latestAired } from "@/lib/show/schedule";
import { holdResults, RESULTS, revealResults, seal, unseal, useSealed } from "@/lib/show/sealed";
import { useEpisodeState } from "@/lib/show/use-episode-state";
import { useNow } from "@armchair/app-core/show/use-now";
import { ApiError } from "@armchair/app-core/api/client";
import { closesIn, closesOn, isClosed } from "@/lib/show/window";
import { withSeason } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { TEXT_LINK } from "@/lib/ui";

const PANEL = "scorecard";

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
  const view = (
    <EpisodeView
      key={episode.ep}
      season={season}
      episode={episode}
      now={now}
      group={filter.group}
      picked={filter.groups?.find((g) => g.id === filter.group) ?? null}
      scope={scopeName(filter)}
    />
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
        <Select
          label="Episode"
          value={String(episode.ep)}
          options={season.episodes.map((e) => ({
            value: String(e.ep),
            label: [episodeLabel(e, season.episodes), e.theme].filter(Boolean).join(" · "),
            detail:
              [
                formatAirDate(e.airDate),
                e.window?.open ? "Open now" : isClosed(e.window, now) ? "Closed" : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
          }))}
          onChange={(ep) => router.replace(withSeason(`/episode/?ep=${ep}`, season.season))}
        />
        <GroupPicker {...filter} panelId={PANEL} />
      </div>
      <div id={PANEL} className="contents">
        {season.open ? (
          view
        ) : (
          <CatchUp
            key={episode.ep}
            season={season.season}
            episodes={season.episodes}
            episode={episode}
            onCatchUp={(ep) => router.replace(withSeason(`/episode/?ep=${ep}`, season.season))}
          >
            {view}
          </CatchUp>
        )}
      </div>
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
  picked: Group | null;
  scope: string;
}

function EpisodeView({ season, episode, now, group, picked, scope }: EpisodeViewProps) {
  const { data, error, reload } = useEpisodeState(season.season, season.timezone, episode, group);
  const contestants = useMemo(() => new Map(season.contestants.map((c) => [c.id, c])), [season]);
  const judges = useMemo(() => new Map(season.judges.map((j) => [j.id, j])), [season]);
  const isSealed = useSealed();
  const [query, setQuery] = useState("");
  const names = (ids: string[]) =>
    ids.map((id) => contestants.get(id)?.members.find((m) => m.role === "celebrity")?.name ?? id).join(", ");
  const [locked, setLocked] = useState<{ key: string; title: string; value: number } | null>(null);
  // Set by the answer that finished the episode, and by "Reveal results" so the reveal plays out after the hold lifts.
  const [finished, setFinished] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const onRevealed = useCallback(() => revealResults(season.season, episode.ep), [season.season, episode.ep]);

  if (data === null) {
    if (error !== null) return <ErrorState what="this episode" message={error} retry={reload} />;
    return <EpisodeSkeleton label="Loading the episode" />;
  }

  const airsOn = hasAired(episode, season.timezone, now) ? null : formatAirDate(episode.airDate);
  // The last answer opens the episode's results; they wait behind "Reveal results" instead.
  // Held before the request, like a dance's seal, so no poll in between shows who went home.
  const holds = (left: number) => !data.open && !isClosed(data.window ?? episode.window, now) && data.rateable - data.answered === left;
  const revealRest = async () => {
    const last = holds(data.rateable - data.answered);
    if (last) holdResults(season.season, episode.ep);
    try {
      await revealAll(season.season, episode.ep);
      if (last) setFinished(true);
    } catch (e) {
      if (last) void revealResults(season.season, episode.ep);
      throw e;
    } finally {
      reload();
    }
  };
  const submit = async (card: LockedCard, answer: Answer) => {
    // Sealed before the request, so no poll landing in between can turn the judges over.
    const value = "value" in answer ? answer.value : null;
    const last = holds(1);
    if (value !== null) seal(season.season, episode.ep, card.key);
    if (last) holdResults(season.season, episode.ep);
    try {
      await submitScore(season.season, episode.ep, card, answer);
      if (value !== null) setLocked({ key: card.key, title: names(card.contestants), value });
      if (last) setFinished(true);
    } catch (e) {
      if (value !== null) void unseal(season.season, episode.ep, card.key);
      if (last) void revealResults(season.season, episode.ep);
      // The reload below turns the page read-only; this says why the paddle didn't stick.
      if (e instanceof ApiError && e.detail?.code === CLOSED) throw new Error("scoring for this episode has closed");
      throw e;
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
  const sealed = (key: string) => isSealed(season.season, episode.ep, key);
  // From the episode state when the API sends windows; the season catalog may be cached.
  const win = data.window ?? episode.window;
  const closed = isClosed(win, now);
  const closesAt = !closed && win?.open ? win.closesAt : null;
  // The server holds back the result while a dance is sealed; this covers a seal it hasn't had yet.
  const anySealed = data.performances.some((c) => (c.locked ? c.sealed === true : sealed(c.key)));
  // Who went home waits for "Reveal results", held here or on another device.
  const held = isSealed(season.season, episode.ep, RESULTS) || data.resultsHeld === true;
  const eliminated = anySealed || held ? [] : (data.eliminated ?? []);
  const curtain = (data.complete && held && !anySealed) || revealing;
  const gone = new Set(eliminated);
  const shown = findCards(data.performances, query, contestants);
  // Who's dancing now comes from the judges' scores the poller has seen, so only once the order is real.
  const cues =
    data.runningOrder && isLive(episode, season.timezone, now)
      ? cuesOf(data.performances, data.danced ?? 0)
      : new Map<string, Cue>();
  const out = eliminated.map(
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
            <p className="text-sm text-silver-dim">
              Comparing with <span className="font-medium text-pearl">{scope}</span>
            </p>
          </div>
          <p className="shrink-0 pb-0.5 text-right text-sm text-silver-dim tabular-nums">
            {data.open ? "Past season · view only" : `${data.answered} of ${data.rateable} answered`}
            {closesAt && (
              <span className="block text-xs font-medium text-gold-light">Closes in {closesIn(closesAt, now)}</span>
            )}
          </p>
        </div>
        {!data.open && (
          <div
            role="progressbar"
            aria-label="Dances answered"
            aria-valuemin={0}
            aria-valuemax={data.rateable}
            aria-valuenow={data.answered}
            className="h-1 overflow-hidden rounded-full bg-silver/10"
          >
            <div
              className="grow-x h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-light transition-[width] duration-700"
              style={{ width: `${data.rateable ? (data.answered / data.rateable) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
      {closed && (
        <p role="status" className="rounded-lg border border-silver/15 bg-ink/40 px-3 py-2.5 text-sm text-silver">
          <span className="font-semibold text-pearl">Scoring closed</span>
          {win?.closesAt && ` ${closesOn(win.closesAt, season.timezone)}`}.{" "}
          {data.answered < data.rateable
            ? `You scored ${data.answered} of ${data.rateable}; the rest are marked missed. Every score is open to see.`
            : "Every score is open to see."}
        </p>
      )}
      {!data.open && !closed && airsOn === null && data.answered < data.rateable && (
        <RevealAll open={data.rateable - data.answered} onConfirm={revealRest} />
      )}
      {error !== null && (
        <p role="status" className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">
          Couldn&apos;t refresh: {error}. Showing the last scores loaded.
        </p>
      )}
      {curtain && (
        <ResultsReveal
          label={episodeLabel(episode, season.episodes)}
          results={data.results ?? null}
          contestants={contestants}
          out={{ ep: episode.ep, week: episode.week }}
          announce={finished && locked === null}
          onStart={() => setRevealing(true)}
          onRevealed={onRevealed}
        />
      )}
      {out.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-silver/15 bg-ink/40 px-3 py-2 text-sm text-silver">
          <span className="text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">Eliminated</span>
          {out.join(", ")}
        </p>
      )}
      {!data.open && data.performances.length > 0 && <OrderNote state={data} tz={season.timezone} />}
      {data.performances.length > 1 && (
        <FindCouple cards={shown} contestants={contestants} cues={cues} query={query} onQuery={setQuery} />
      )}
      {data.performances.length === 0 ? (
        <EmptyState title="No dances yet">Performances appear here once the running order is in.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="No one by that name tonight">
          Nobody dancing in this episode matches &ldquo;{query.trim()}&rdquo;.{" "}
          <button type="button" onClick={() => setQuery("")} className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
            Show every dance
          </button>
        </EmptyState>
      ) : (
        <ul className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((card) => (
            <li key={card.key} id={danceId(card.key)} tabIndex={-1} className="rounded-xl outline-none focus:ring-2 focus:ring-gold/60">
              <PerformanceCard
                card={card}
                season={season.season}
                out={card.contestants.length === 1 && gone.has(card.contestants[0]) ? { ep: episode.ep, week: episode.week } : undefined}
                contestants={contestants}
                judges={judges}
                airsOn={airsOn}
                group={picked}
                onSubmit={submit}
                sealed={!card.locked && sealed(card.key)}
                seats={data.panel.length}
                missed={closed && !card.locked && card.mine === null}
                onReveal={() => void unseal(season.season, episode.ep, card.key)}
                cue={cues.get(card.key)}
              />
            </li>
          ))}
        </ul>
      )}
      <VotePanel episode={episode} tz={season.timezone} couples={couples} now={now} />
      <RevealSheet
        locked={locked}
        onReveal={() => {
          if (locked) void unseal(season.season, episode.ep, locked.key);
          setLocked(null);
        }}
        onClose={() => setLocked(null)}
      />
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
