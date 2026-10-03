"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { FactionBadge } from "@/components/faction-badge";
import { errorText } from "@/components/season-data";
import { ShieldMark, Tally } from "@/components/table-art";
import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Writeup } from "@/components/writeup";
import { getPlayer, type Career, type PlayerProfile, type StoryEpisode } from "@/lib/api/history";
import { finishText, playerHref } from "@/lib/history";
import { nameOf, roman } from "@/lib/players";
import { isShow, seasonLabel, seasonNumber, withSeason, type Show } from "@/lib/seasons";
import { cn, EYEBROW, FOCUS, HEADING, TEXT_LINK } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; player: PlayerProfile } | { kind: "error"; message: string };

const EDITION_NAMES: Record<Show, string> = { tus: "US", tuk: "UK", tukc: "Celebrity UK" };

/** `/players/player/?show=tus&id=...`: one player across an edition's seasons. */
export function PlayerScreen() {
  const params = useSearchParams();
  const show = params.get("show");
  const id = params.get("id");
  if (!isShow(show) || !id) {
    return <EmptyState title="No such player">That link doesn&apos;t name a player. Search for one instead.</EmptyState>;
  }
  return <Player key={`${show}#${id}`} show={show} id={id} />;
}

function Player({ show, id }: { show: Show; id: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPlayer(show, id).then(
      (player) => !cancelled && setLoad({ kind: "ready", player }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [show, id, attempt]);

  if (load.kind === "loading") return <SkeletonList label="Finding the player" rows={3} row="h-28" />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="this player" message={load.message} retry={retry} />;
  }

  const p = load.player;
  const seasons = [...p.seasons].sort((a, b) => b.number - a.number);
  const titles = seasons.filter((s) => s.championship);
  return (
    <>
      <Card as="section" aria-labelledby="player-name" tartan className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <Headshot
          name={p.name}
          image={p.headshot}
          size={144}
          // Their latest season's finish, only as far as the API lets this caller see it.
          exit={seasons[0]?.finish}
          paint
          className={cn("shadow-[0_14px_30px_-12px_rgb(0_0_0/0.95)]", titles.length > 0 && "ring-2 ring-candle")}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className={EYEBROW}>The Traitors {EDITION_NAMES[show]}</p>
          <h1 id="player-name" className={cn(HEADING, "text-3xl leading-tight")}>
            {p.name}
          </h1>
          <p className="text-parchment">
            {seasons.length === 1 ? "One season" : `${seasons.length} seasons`} in the castle
          </p>
          {titles.length > 0 && (
            <p className="flex flex-wrap gap-2 pt-1">
              {titles.map((s) => (
                <ChampionBadge key={s.season} label={`Won ${seasonLabel({ id: s.season, number: s.number })}`} />
              ))}
            </p>
          )}
        </div>
      </Card>
      {p.bio ? (
        <Writeup title={`About ${p.name}`} writeup={p.bio} />
      ) : (
        <section aria-labelledby="bio-title" className="flex flex-col gap-2">
          <h2 id="bio-title" className={EYEBROW}>
            About {p.name}
          </h2>
          <p className="text-ash">No biography yet.</p>
        </section>
      )}
      <Story show={show} story={p.story ?? []} seasons={seasons} />
      <h2 className={EYEBROW}>Seasons played</h2>
      <ol aria-label="Seasons played" className="-mt-2 flex flex-col gap-4">
        {seasons.map((s) => (
          <SeasonCard key={s.season} career={s} />
        ))}
      </ol>
    </>
  );
}

function SeasonCard({ career: s }: { career: Career }) {
  const label = seasonLabel({ id: s.season, number: s.number });
  const finish = finishText(s.finish);
  return (
    <Card as="li" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link href={withSeason("/", s.season)} className={cn(TEXT_LINK, "font-display text-lg font-semibold")}>
          {label}
        </Link>
        {s.current && <span className="text-sm text-candle">Live now</span>}
      </div>
      <p className="flex flex-wrap items-center gap-2">
        {s.championship && <ChampionBadge label="Champion" />}
        {s.faction && <FactionBadge faction={s.faction} />}
        <span className={s.finish?.how === "winner" ? "text-candle" : "text-parchment"}>
          {finish ?? (s.current ? "Still in the castle" : "Finish not on record")}
        </span>
      </p>
      {s.votes && <VotesChart votes={s.votes} banishedAt={s.finish?.how === "banished" ? s.finish.ep : null} />}
    </Card>
  );
}

interface StoryProps {
  show: Show;
  story: StoryEpisode[];
  /** Newest first: the story's seasons go in the same order. */
  seasons: Career[];
}

/** What the player did each episode you may see: their vote, the votes against them, a shield, how they left. */
function Story({ show, story, seasons }: StoryProps) {
  const order = seasons.map((s) => s.season);
  const groups = [...new Set(story.map((s) => s.season))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((season) => ({
      season,
      label: seasonLabel({ id: season, number: seasons.find((s) => s.season === season)?.number ?? seasonNumber(season) }),
      episodes: story.filter((s) => s.season === season).sort((a, b) => a.ep - b.ep),
    }));

  return (
    <section aria-labelledby="story-title" className="flex flex-col gap-3">
      <h2 id="story-title" className={EYEBROW}>
        Episode by episode
      </h2>
      {groups.length === 0 ? (
        <EmptyState>Each episode fills in here once its results are yours to see.</EmptyState>
      ) : (
        groups.map((g) => (
          <Card as="section" key={g.season} aria-label={`${g.label}, episode by episode`} className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold text-bone">{g.label}</h3>
            <ol className="flex flex-col">
              {g.episodes.map((s) => (
                <StoryRow key={s.ep} show={show} entry={s} />
              ))}
            </ol>
          </Card>
        ))
      )}
    </section>
  );
}

function StoryRow({ show, entry: s }: { show: Show; entry: StoryEpisode }) {
  const voted = s.voted && nameOf(s.voted, null);
  return (
    <li
      aria-label={`Episode ${s.ep}`}
      className="flex gap-3 border-t border-bone/10 py-3 first:border-t-0 first:pt-1 last:pb-0"
    >
      <span aria-hidden="true" className="w-9 shrink-0 pt-0.5 font-display text-lg text-gilt">
        {roman(s.ep)}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-bone">{s.title ?? `Episode ${s.ep}`}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-parchment">
          {s.voted && voted ? (
            <span className="flex items-center gap-2">
              Voted for
              <Link
                href={playerHref(show, s.voted, s.season)}
                className={cn(FOCUS, "group flex min-h-11 items-center gap-2 rounded-sm pr-1 hover:text-candle")}
              >
                <span aria-hidden="true">
                  <Headshot name={voted} image={null} size={28} round />
                </span>
                <span className="font-hand text-xl leading-none text-bone group-hover:text-candle">{voted}</span>
              </Link>
            </span>
          ) : (
            s.votesReceived !== null && <span className="text-ash">No vote on record</span>
          )}
          {s.votesReceived !== null && (
            <span className="flex items-center gap-2">
              {s.votesReceived > 0 ? (
                <>
                  <Tally count={s.votesReceived} />
                  <span>
                    <span className="nums">{s.votesReceived}</span> {s.votesReceived === 1 ? "vote" : "votes"} against
                  </span>
                </>
              ) : (
                <span className="text-ash">No votes against</span>
              )}
            </span>
          )}
          {s.shield && (
            <span className="flex items-center gap-1.5 text-candle">
              <ShieldMark className="h-5 w-4" />
              Shield
            </span>
          )}
          {s.out && (
            <span className={cn("font-display text-sm font-semibold tracking-[0.12em] uppercase", s.out.how === "winner" ? "text-candle" : "text-blood-hi")}>
              {s.out.how === "winner" ? "Won" : s.out.how}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function ChampionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-candle/70 bg-candle/10 px-2 py-0.5 font-display text-xs font-semibold tracking-[0.12em] text-candle uppercase">
      <svg viewBox="0 0 16 12" aria-hidden="true" className="h-2.5 w-3.5">
        <path d="M1 11h14L13.5 3 10.5 6.5 8 1 5.5 6.5 2.5 3Z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

const BAR = 26;
const PLOT = 64;

/** First votes drawn at each round table, one bar per table. Drawn at its own pixel size so the text never scales. */
function VotesChart({ votes, banishedAt }: { votes: { ep: number; received: number }[]; banishedAt: number | null }) {
  if (votes.length === 0) return <p className="text-sm text-ash">Never sat at a round table.</p>;
  const top = Math.max(1, ...votes.map((v) => v.received));
  const width = votes.length * BAR;
  const height = PLOT + 32;
  const summary = votes.map((v) => `episode ${v.ep}, ${v.received}`).join("; ");
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm text-ash">Votes received at each round table, by episode</figcaption>
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Votes received: ${summary}`}
          className="block"
        >
          <line x1={0} x2={width} y1={PLOT + 14} y2={PLOT + 14} stroke="var(--gilt)" strokeOpacity={0.5} />
          {votes.map((v, i) => {
            const h = (v.received / top) * PLOT;
            const x = i * BAR + 5;
            const fill = v.ep === banishedAt ? "var(--blood-hi)" : v.received === top && v.received > 0 ? "var(--candle)" : "var(--ash)";
            return (
              <g key={v.ep}>
                {v.received > 0 && (
                  <rect x={x} y={PLOT + 14 - h} width={BAR - 10} height={h} rx={1.5} fill={fill} />
                )}
                <text
                  x={x + (BAR - 10) / 2}
                  y={PLOT + 10 - h}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--parchment)"
                  className="nums"
                >
                  {v.received}
                </text>
                <text x={x + (BAR - 10) / 2} y={PLOT + 28} textAnchor="middle" fontSize={10} fill="var(--ash)" className="font-display">
                  {v.ep}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
