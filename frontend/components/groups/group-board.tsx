"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LeaderboardView, off, seasonLabel } from "@/components/leaderboard-screen";
import { Tile } from "@/components/profile/parts";
import { displayName } from "@/components/social/parts";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import type { GroupDetail } from "@armchair/app-core/api/groups";
import { ALL_TIME, getLeaderboard, type Leaderboard } from "@/lib/api/leaderboard";
import { saveGroup } from "@/lib/show/group-filter";
import { useSeasonId } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { TEXT_LINK } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; board: Leaderboard } | { kind: "error"; message: string };

/** The group's standings for a season or all-time, with a few numbers over them. */
export function GroupBoard({ group }: { group: GroupDetail }) {
  const current = useSeasonId();
  const [season, setSeason] = useState(current);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const catalog = useSeason();
  const judges = catalog.kind === "ready" ? catalog.season.judges : [];

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(season, "group", group.id).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, group.id, attempt]);

  const pick = (s: string) => {
    setLoad({ kind: "loading" });
    setSeason(s);
  };
  const retry = () => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          label="Standings for"
          hideLabel
          className="w-40"
          value={season}
          options={[
            { value: current, label: seasonLabel(current) },
            { value: ALL_TIME, label: seasonLabel(ALL_TIME) },
          ]}
          onChange={pick}
        />
        <Link href="/stats/" onClick={() => saveGroup(group.id)} className={TEXT_LINK}>
          Your accuracy against this group
        </Link>
      </div>
      {load.kind === "loading" && <BoardSkeleton />}
      {load.kind === "error" && <ErrorState what="the group's leaderboard" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <>
          <GroupNumbers board={load.board} members={group.members.length} />
          <LeaderboardView board={load.board} judges={judges} you={false} />
        </>
      )}
    </>
  );
}

function GroupNumbers({ board, members }: { board: Leaderboard; members: number }) {
  const { ranked, me, minDances } = board;
  const leader = ranked[0];
  const average = ranked.length > 0 ? ranked.reduce((sum, r) => sum + r.mae, 0) / ranked.length : null;
  const dances = ranked.reduce((sum, r) => sum + r.count, 0) + board.unranked.reduce((sum, u) => sum + u.count, 0);
  return (
    <dl aria-label="Group numbers" className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        accent
        label="Leader"
        value={<span className="block truncate text-xl sm:text-2xl">{leader ? displayName(leader) : "No one yet"}</span>}
        note={leader ? off(leader.mae) : `${minDances} dances to rank`}
      />
      <Tile label="Your place" value={me.rank === null ? "-" : `#${me.rank}`} note={me.rank === null ? `${me.count} of ${minDances} dances` : off(me.mae ?? 0)} />
      <Tile label="Group average" value={average === null ? "-" : average.toFixed(2)} note="points off the judges" />
      <Tile label="Ranked" value={`${ranked.length}/${members}`} note={`${dances} dances scored`} />
    </dl>
  );
}

function BoardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading the group&apos;s leaderboard...</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}
