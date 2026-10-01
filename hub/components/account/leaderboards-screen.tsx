"use client";

import Link from "next/link";
import { useCallback, useState, type CSSProperties } from "react";

import { ALL_TIME, currentSeason, getBoard, listSeasons, type Board, type Scope, type Standing } from "@/lib/api/dwts";
import { profileLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { SignedInPage } from "./hub-shell";
import { Avatar, displayName, Empty, ErrorNote, FOCUS, SkeletonRows, step } from "./ui";

export function LeaderboardsScreen() {
  return (
    <SignedInPage eyebrow="Leaderboards" pitch="Sign in to see where you stand against everyone watching.">
      <header className="rise" style={step(0)}>
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Leaderboards</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Closest to <span className="text-brand-gradient">the panel.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Ranked by average points off the judges&rsquo; average. Lowest wins.
        </p>
      </header>
      <Boards />
    </SignedInPage>
  );
}

function Boards() {
  const [seasons, retrySeasons] = useLoad(listSeasons);

  if (seasons.kind === "loading") return <BoardSkeleton />;
  if (seasons.kind === "error") {
    return (
      <div className="mt-8 max-w-md">
        <ErrorNote what="the seasons" message={seasons.message} retry={retrySeasons} />
      </div>
    );
  }
  const season = currentSeason(seasons.value);
  if (!season) {
    return (
      <div className="mt-8">
        <Empty>No season is open yet.</Empty>
      </div>
    );
  }
  return <Picker seasonId={season.id} seasonLabel={`Season ${season.number}`} />;
}

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-line bg-night-2/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
            o.value === value ? "bg-text text-night" : "text-muted hover:text-text active:bg-line/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Picker({ seasonId, seasonLabel }: { seasonId: string; seasonLabel: string }) {
  const [season, setSeason] = useState(seasonId);
  const [scope, setScope] = useState<Scope>("global");
  const fetcher = useCallback(() => getBoard(season, scope), [season, scope]);
  const [load, retry] = useLoad(fetcher);

  return (
    <section aria-labelledby="board-title" className="rise mt-8 flex flex-col gap-5" style={step(1)}>
      <h2 id="board-title" className="sr-only">
        Dancing with the Stars, {season === ALL_TIME ? "all-time" : seasonLabel}, {scope === "global" ? "everyone" : "friends"}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Season"
          value={season}
          onChange={setSeason}
          options={[
            { value: seasonId, label: seasonLabel },
            { value: ALL_TIME, label: "All-time" },
          ]}
        />
        <Segmented
          label="Who"
          value={scope}
          onChange={setScope}
          options={[
            { value: "global", label: "Everyone" },
            { value: "friends", label: "Friends" },
          ]}
        />
      </div>
      <div aria-live="polite" className="rounded-3xl border border-line bg-night-2/70 p-3 sm:p-4">
        {load.kind === "loading" && <SkeletonRows label="Loading the leaderboard" rows={5} />}
        {load.kind === "error" && <ErrorNote what="the leaderboard" message={load.message} retry={retry} />}
        {load.kind === "ready" && <Table board={load.value} scope={scope} />}
      </div>
    </section>
  );
}

function Table({ board, scope }: { board: Board & { total: number }; scope: Scope }) {
  const { ranked, unranked, me, minDances } = board;
  const others = ranked.filter((r) => r.sub !== me.sub).length + unranked.filter((u) => u.sub !== me.sub).length;

  if (scope === "friends" && others === 0) {
    return (
      <Empty>
        No friends to rank against yet.{" "}
        <Link href="/social/" className={`rounded font-semibold text-text underline underline-offset-4 ${FOCUS}`}>
          Add some
        </Link>
        .
      </Empty>
    );
  }
  if (ranked.length === 0) {
    return <Empty>Nobody has scored {minDances} dances yet. The board fills in as people do.</Empty>;
  }

  const meShown = ranked.some((r) => r.sub === me.sub);
  const waiting = unranked.length;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {ranked.map((r, i) => (
          <Row key={r.sub} standing={r} rank={r.rank} mine={r.sub === me.sub} index={i} />
        ))}
        {!meShown && me.rank !== null && (
          <>
            <li aria-hidden="true" className="py-1 text-center text-muted">
              &middot;&middot;&middot;
            </li>
            <Row standing={me} rank={me.rank} mine index={ranked.length} />
          </>
        )}
      </ol>
      <p className="px-2 text-xs leading-relaxed text-muted">
        {me.rank === null &&
          `You rank after ${minDances} dances; ${Math.max(0, minDances - me.count)} to go. `}
        {waiting > 0 && `${waiting} more ${waiting === 1 ? "player is" : "players are"} under ${minDances} dances.`}
        {board.total > ranked.length && ` Showing the top ${ranked.length} of ${board.total}.`}
      </p>
    </div>
  );
}

interface RowProps {
  standing: Standing;
  rank: number;
  mine: boolean;
  index: number;
}

const MEDAL = ["from-gold to-orange", "from-text to-muted", "from-orange to-violet"];

function Row({ standing, rank, mine, index }: RowProps) {
  const name = displayName(standing);
  return (
    <li
      className={`board-row flex items-center gap-3 rounded-2xl px-2 py-2 ${mine ? "bg-violet/15 ring-1 ring-violet/50" : ""}`}
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
          rank <= 3 ? `bg-linear-to-br text-night ${MEDAL[rank - 1]}` : "text-muted"
        }`}
      >
        {rank}
      </span>
      <a
        href={profileLink(standing.sub)}
        className={`group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl ${FOCUS}`}
      >
        <Avatar name={name} picture={standing.picture} size={36} decorative />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text decoration-gold underline-offset-4 group-hover:underline">
            {name}
            {mine && <span className="ml-2 text-[10px] font-bold tracking-[0.2em] text-magenta uppercase">You</span>}
          </span>
          <span className="block text-xs text-muted">
            {standing.count} {standing.count === 1 ? "dance" : "dances"}
          </span>
        </span>
      </a>
      <span className="shrink-0 text-right">
        <span className="block text-base font-bold text-text tabular-nums">{standing.mae?.toFixed(2) ?? "--"}</span>
        <span className="block text-[10px] tracking-wide text-muted">off</span>
      </span>
    </li>
  );
}

function BoardSkeleton() {
  return (
    <div className="mt-8 rounded-3xl border border-line bg-night-2/70 p-4">
      <SkeletonRows label="Loading the leaderboard" rows={5} />
    </div>
  );
}
