"use client";

import Link from "next/link";
import { useCallback, useState, type CSSProperties } from "react";

import { ALL_TIME, currentSeason, getBoard, listSeasons, type Board, type Scope } from "@/lib/api/dwts";
import {
  currentSeasons,
  EDITION_NAMES,
  getRanks,
  type Edition,
  type Ranking,
  type Ranks,
  type TraitorsSeason,
} from "@/lib/api/traitors";
import { profileLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { SignedInPage } from "./hub-shell";
import { EDITIONS, ShowSwitch, type HubShow } from "./show-switch";
import { Avatar, displayName, Empty, ErrorNote, FOCUS, Segmented, SkeletonRows, step } from "./ui";

export function LeaderboardsScreen() {
  const [show, setShow] = useState<HubShow>("dwts");
  return (
    <SignedInPage eyebrow="Leaderboards" pitch="Sign in to see where you stand against everyone watching.">
      <header className="rise" style={step(0)}>
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Leaderboards</p>
        {show === "dwts" ? (
          <>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Closest to <span className="text-brand-gradient">the panel.</span>
            </h1>
            <p className="mt-3 max-w-xl text-muted">Ranked by average points off the judges&rsquo; average. Lowest wins.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Sharpest at <span className="text-brand-gradient">the table.</span>
            </h1>
            <p className="mt-3 max-w-xl text-muted">Ranked by Traitors points. Ties go to whoever called more banishments.</p>
          </>
        )}
      </header>
      <ShowSwitch value={show} onChange={setShow} />
      {show === "dwts" ? <Boards /> : <TraitorsBoards key={show} editions={EDITIONS[show]} />}
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
        <WhoSwitch value={scope} onChange={setScope} />
      </div>
      <div aria-live="polite" className="rounded-3xl border border-line bg-night-2/70 p-3 sm:p-4">
        {load.kind === "loading" && <SkeletonRows label="Loading the leaderboard" rows={5} />}
        {load.kind === "error" && <ErrorNote what="the leaderboard" message={load.message} retry={retry} />}
        {load.kind === "ready" && <Table board={load.value} scope={scope} />}
      </div>
    </section>
  );
}

function WhoSwitch({ value, onChange }: { value: Scope; onChange: (scope: Scope) => void }) {
  return (
    <Segmented
      label="Who"
      value={value}
      onChange={onChange}
      options={[
        { value: "global", label: "Everyone" },
        { value: "friends", label: "Friends" },
      ]}
    />
  );
}

function NoFriends() {
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

const dwtsRow = (s: Board["me"]) => ({
  person: s,
  detail: `${s.count} ${s.count === 1 ? "dance" : "dances"}`,
  value: s.mae?.toFixed(2) ?? "--",
  unit: "off",
});

function Table({ board, scope }: { board: Board & { total: number }; scope: Scope }) {
  const { ranked, unranked, me, minDances } = board;
  const others = ranked.filter((r) => r.sub !== me.sub).length + unranked.filter((u) => u.sub !== me.sub).length;

  if (scope === "friends" && others === 0) return <NoFriends />;
  if (ranked.length === 0) {
    return <Empty>Nobody has scored {minDances} dances yet. The board fills in as people do.</Empty>;
  }

  const meShown = ranked.some((r) => r.sub === me.sub);
  const waiting = unranked.length;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {ranked.map((r, i) => (
          <Row key={r.sub} {...dwtsRow(r)} rank={r.rank} mine={r.sub === me.sub} index={i} />
        ))}
        {!meShown && me.rank !== null && (
          <>
            <li aria-hidden="true" className="py-1 text-center text-muted">
              &middot;&middot;&middot;
            </li>
            <Row {...dwtsRow(me)} rank={me.rank} mine index={ranked.length} />
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

function TraitorsBoards({ editions }: { editions: Edition[] }) {
  const fetcher = useCallback(() => currentSeasons(editions), [editions]);
  const [seasons, retry] = useLoad(fetcher);

  if (seasons.kind === "loading") return <BoardSkeleton />;
  if (seasons.kind === "error") {
    return (
      <div className="mt-8 max-w-md">
        <ErrorNote what="the seasons" message={seasons.message} retry={retry} />
      </div>
    );
  }
  if (seasons.value.length === 0) {
    return (
      <div className="mt-8">
        <Empty>No season is on right now.</Empty>
      </div>
    );
  }
  return <TraitorsPicker seasons={seasons.value} />;
}

/** One current season per edition; UK can have two editions on at once. */
function TraitorsPicker({ seasons }: { seasons: TraitorsSeason[] }) {
  const [edition, setEdition] = useState<Edition>(seasons[0].show);
  const [allTime, setAllTime] = useState(false);
  const [scope, setScope] = useState<Scope>("global");
  const season = seasons.find((s) => s.show === edition) ?? seasons[0];
  const fetcher = useCallback(
    () => getRanks(allTime ? ALL_TIME : season.id, season.show, scope),
    [allTime, season, scope],
  );
  const [load, retry] = useLoad(fetcher);
  const name = EDITION_NAMES[season.show];

  return (
    <section aria-labelledby="board-title" className="rise mt-8 flex flex-col gap-5" style={step(1)}>
      <h2 id="board-title" className="sr-only">
        The Traitors {name}, {allTime ? "all-time" : `Season ${season.number}`}, {scope === "global" ? "everyone" : "friends"}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {seasons.length > 1 && (
          <Segmented
            label="Edition"
            value={edition}
            onChange={setEdition}
            options={seasons.map((s) => ({ value: s.show, label: EDITION_NAMES[s.show] }))}
          />
        )}
        <Segmented
          label="Season"
          value={allTime ? ALL_TIME : season.id}
          onChange={(v) => setAllTime(v === ALL_TIME)}
          options={[
            { value: season.id, label: `${name} · Season ${season.number}` },
            { value: ALL_TIME, label: "All-time" },
          ]}
        />
        <WhoSwitch value={scope} onChange={setScope} />
      </div>
      <div aria-live="polite" className="rounded-3xl border border-line bg-night-2/70 p-3 sm:p-4">
        {load.kind === "loading" && <SkeletonRows label="Loading the leaderboard" rows={5} />}
        {load.kind === "error" && <ErrorNote what="the leaderboard" message={load.message} retry={retry} />}
        {load.kind === "ready" && <TraitorsTable ranks={load.value} scope={scope} />}
      </div>
    </section>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const traitorsRow = (r: Ranking) => ({
  person: r,
  detail: `${plural(r.events, "call")} · ${plural(r.banishHits, "banishment")}`,
  value: String(r.points),
  unit: "pts",
});

function TraitorsTable({ ranks, scope }: { ranks: Ranks & { total: number }; scope: Scope }) {
  const { ranked, me, total } = ranks;
  if (scope === "friends" && ranked.every((r) => r.sub === me.sub)) return <NoFriends />;
  // The caller always has a row, so an empty board is one where nobody has scored.
  if (ranked.every((r) => r.events === 0 && r.points === 0)) {
    return <Empty>No calls are scored yet. The board fills in after the first round table.</Empty>;
  }

  const meShown = ranked.some((r) => r.sub === me.sub);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {ranked.map((r, i) => (
          <Row key={r.sub} {...traitorsRow(r)} rank={r.rank} mine={r.sub === me.sub} index={i} />
        ))}
        {!meShown && (
          <>
            <li aria-hidden="true" className="py-1 text-center text-muted">
              &middot;&middot;&middot;
            </li>
            <Row {...traitorsRow(me)} rank={me.rank} mine index={ranked.length} />
          </>
        )}
      </ol>
      {total > ranked.length && (
        <p className="px-2 text-xs leading-relaxed text-muted">
          Showing the top {ranked.length} of {total}.
        </p>
      )}
    </div>
  );
}

interface RowProps {
  person: { sub: string; name: string | null; picture: string | null };
  rank: number;
  mine: boolean;
  index: number;
  detail: string;
  value: string;
  unit: string;
}

const MEDAL = ["from-gold to-orange", "from-text to-muted", "from-orange to-violet"];

function Row({ person, rank, mine, index, detail, value, unit }: RowProps) {
  const name = displayName(person);
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
        href={profileLink(person.sub)}
        className={`group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl ${FOCUS}`}
      >
        <Avatar name={name} picture={person.picture} size={36} decorative />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text decoration-gold underline-offset-4 group-hover:underline">
            {name}
            {mine && <span className="ml-2 text-[10px] font-bold tracking-[0.2em] text-magenta uppercase">You</span>}
          </span>
          <span className="block text-xs text-muted">{detail}</span>
        </span>
      </a>
      <span className="shrink-0 text-right">
        <span className="block text-base font-bold text-text tabular-nums">{value}</span>
        <span className="block text-[10px] tracking-wide text-muted">{unit}</span>
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
