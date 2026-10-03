"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { FactionWord } from "@/components/faction-word";
import { RecapFold } from "@/components/recap";
import { RoundTable } from "@/components/round-table";
import { errorText } from "@/components/season-data";
import { CastTable } from "@/components/cast-wall";
import { Writeup } from "@/components/writeup";
import { CloakToken, EmptyChair } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getHistory, type History, type HistoryEpisode, type HistoryPlayer } from "@/lib/api/history";
import type { Writeup as WriteupText } from "@/lib/api/traitors";
import { byFinish, playerHref, seatedAt } from "@/lib/history";
import { roman } from "@/lib/players";
import { seasonName, seasonNumber, showOf } from "@/lib/seasons";
import { cn, EYEBROW, FOCUS, HEADING, TEXT_LINK } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; history: History } | { kind: "error"; message: string };

/** A finished season, open to all: who won, the cast and how each left, and every night in turn. */
interface HistoryScreenProps {
  season: string;
  /** The season's write-up from Wikipedia, when the season load has one. */
  summary?: WriteupText | null;
}

export function HistoryScreen({ season, summary = null }: HistoryScreenProps) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHistory(season).then(
      (history) => !cancelled && setLoad({ kind: "ready", history }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  const heading = (title: string | null) => {
    const name = seasonName({ id: season, number: seasonNumber(season), title });
    return (
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{name.eyebrow} · Finished</p>
        <h1 className={cn(HEADING, "text-2xl leading-tight")}>{name.title}</h1>
      </div>
    );
  };

  if (load.kind === "loading") {
    return (
      <>
        {heading(null)}
        <SkeletonList label="Unrolling the season" rows={4} row="h-24" />
      </>
    );
  }
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return (
      <>
        {heading(null)}
        <ErrorState what="this season" message={load.message} retry={retry} />
      </>
    );
  }

  const h = load.history;
  const byId = new Map(h.players.map((p) => [p.id, p]));
  const link = (id: string) => playerHref(showOf(season), id, season);
  const names = (ids: string[]) =>
    ids.map((id, i) => (
      <span key={id}>
        {i > 0 && ", "}
        <Link href={link(id)} className={TEXT_LINK}>
          {byId.get(id)?.name ?? id}
        </Link>
      </span>
    ));

  return (
    <>
      {heading(h.title)}
      {h.winners.length > 0 && <Winners history={h} link={link} />}
      {summary && <Writeup title="The season" writeup={summary} />}

      <section aria-labelledby="cast" className="flex flex-col gap-3">
        <h2 id="cast" className={EYEBROW}>
          Final standings
        </h2>
        {h.players.length === 0 ? (
          <EmptyState>No cast on record for this season.</EmptyState>
        ) : (
          <CastTable players={byFinish(h.players)} hrefOf={link} />
        )}
      </section>

      <section aria-labelledby="timeline" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="timeline" className={EYEBROW}>
            Episode by episode
          </h2>
          <p className="text-sm text-ash">Chalk marks by each seat count the first votes cast at the round table.</p>
        </div>
        {h.episodes.length === 0 ? (
          <EmptyState>No episodes on record for this season.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-4">
            {h.episodes.map((e) => (
              <Night key={e.ep} episode={e} players={h.players} names={names} link={link} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Winners({ history, link }: { history: History; link: (id: string) => string }) {
  // The pot goes to the Traitors if any of them makes the end: the rare red cloak.
  const traitors = history.winners.some((w) => w.faction === "Traitor");
  return (
    <Card
      as="section"
      aria-labelledby="winners"
      tone={traitors ? "blood" : "stone"}
      tartan
      className={cn(
        "flex flex-col gap-3",
        !traitors && "bg-gradient-to-br from-candle/20 via-stone to-stone [border-color:var(--candle)]",
      )}
    >
      <h2 id="winners" className={cn(EYEBROW, traitors ? "text-bone" : "text-candle")}>
        {traitors ? "The Traitors take the pot" : "The Faithful take the pot"}
      </h2>
      <ul className="flex flex-wrap gap-x-5 gap-y-3">
        {history.winners.map((w) => {
          const p = history.players.find((x) => x.id === w.id);
          return (
            <li key={w.id}>
              <Link
                href={link(w.id)}
                aria-label={[p?.name ?? w.id, w.faction].filter(Boolean).join(", ")}
                className={`${FOCUS} group flex items-center gap-3 rounded-sm transition-colors active:opacity-80`}
              >
                <span aria-hidden="true">
                  <Headshot
                    name={p?.name ?? w.id}
                    image={p?.headshot ?? null}
                    size={72}
                    className="ring-candle transition-shadow group-hover:shadow-[0_0_14px_rgb(233_185_73/0.6)]"
                  />
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-lg leading-tight font-semibold text-bone group-hover:text-candle">
                    {p?.name ?? w.id}
                  </span>
                  {w.faction && <FactionWord faction={w.faction} className="text-base" />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

interface NightProps {
  episode: HistoryEpisode;
  players: HistoryPlayer[];
  names: (ids: string[]) => ReactNode;
  link: (id: string) => string;
}

function Night({ episode: e, players, names, link }: NightProps) {
  const rt = e.roundTable;
  return (
    <Card as="li" aria-labelledby={`ep-${e.ep}`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className={EYEBROW}>
          Episode {roman(e.ep)}
          {e.airDate && ` · ${airDate(e.airDate)}`}
        </p>
        <h3 id={`ep-${e.ep}`} className={cn(HEADING, "text-lg leading-tight")}>
          {e.title ?? `Episode ${e.ep}`}
        </h3>
      </div>

      {e.murdered && (
        <p className="flex items-center gap-2 text-parchment">
          <EmptyChair className="size-7 shrink-0" />
          {e.murdered.length > 0 ? (
            <span>Murdered: {names(e.murdered)}</span>
          ) : (
            <span className="text-ash">No one murdered</span>
          )}
        </p>
      )}

      {rt ? (
        <>
          <RoundTable
            label={`Episode ${e.ep} round table`}
            roster={seatedAt(players, e)}
            kind="RT"
            chosen={[]}
            result={{ banished: rt.banished, faction: rt.faction ?? undefined }}
            tallies={rt.firstVote}
            tallyLabel={(n) => `${n} ${n === 1 ? "vote" : "votes"}`}
            hrefOf={link}
          />
          <p className="text-parchment">
            Banished: {names([rt.banished])}
            {rt.faction && <FactionWord faction={rt.faction} className="ml-2 text-base" />}
          </p>
        </>
      ) : (
        <p className="text-ash">No round table this episode.</p>
      )}

      {e.recruited && e.recruited.length > 0 && (
        <p className="flex items-center gap-2 text-parchment">
          <CloakToken className="size-7 shrink-0" />
          <span>Recruited: {names(e.recruited)}</span>
        </p>
      )}

      {e.recap && (
        <div className="flex flex-col gap-2 border-t border-gilt/20 pt-3">
          <p className={EYEBROW}>What happened</p>
          <RecapFold recap={e.recap} />
        </div>
      )}
    </Card>
  );
}

/** "Jan 12, 2024". A calendar date, so read in UTC: no zone may move it a day. */
const airDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
