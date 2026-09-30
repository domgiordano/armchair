"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { LoadError } from "@/components/load-error";
import { SignedIn } from "@/components/signed-in";
import { ALL_TIME, getLeaderboard, type Leaderboard, type Ranked, type Scope } from "@/lib/api/leaderboard";
import type { Judge } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { seasonLabel as shellSeasonLabel, useSeasonId } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";

type BoardLoad = { kind: "loading" } | { kind: "ready"; board: Leaderboard } | { kind: "error"; message: string };

const TAB_NAMES: Record<Scope, string> = { global: "Global", friends: "Friends", group: "Groups" };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const SELECT = `min-h-11 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 ${FOCUS}`;

export const off = (mae: number) => `${mae.toFixed(2)} off`;

export const seasonLabel = (season: string) => (season === ALL_TIME ? "All-time" : shellSeasonLabel(season));

/** Past seasons' guest judges aren't in this season's catalog; their id is their name, slugged. */
export function judgeName(id: string, judges: Judge[]): string {
  const known = judges.find((j) => j.id === id)?.name;
  return known ?? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function LeaderboardScreen() {
  return (
    <SignedIn title="Leaderboard">
      <Controls />
    </SignedIn>
  );
}

function Controls() {
  const params = useSearchParams();
  const router = useRouter();
  const seasonLoad = useSeason();
  const filter = useGroupFilter();

  // The shell's picker sets a season; All-time is this page's own option on top.
  const picked = useSeasonId();
  const season = params.get("season") === ALL_TIME ? ALL_TIME : picked;
  const asScope = params.get("scope");
  const scope: Scope = asScope === "group" || asScope === "friends" ? asScope : "global";
  const groups = filter.groups ?? [];
  const asked = params.get("group") ?? filter.group;
  const group = groups.find((g) => g.id === asked)?.id ?? groups[0]?.id ?? null;

  const go = (next: { season?: string; scope?: Scope; group?: string | null }) => {
    const q = new URLSearchParams({ season: next.season ?? season, scope: next.scope ?? scope });
    const g = next.group === undefined ? group : next.group;
    if ((next.scope ?? scope) === "group" && g) q.set("group", g);
    router.replace(`/leaderboard/?${q}`);
  };

  const scoped = scope === "group" ? group : null;
  const judges = seasonLoad.kind === "ready" ? seasonLoad.season.judges : [];
  const waiting = scope === "group" && filter.groups === null && !filter.failed;
  const noGroups = scope === "group" && (filter.failed || (filter.groups !== null && group === null));

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Leaderboard</h1>
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="sr-only">Standings for</span>
            <select value={season} onChange={(e) => go({ season: e.target.value })} className={SELECT}>
              <option value={picked}>{seasonLabel(picked)}</option>
              <option value={ALL_TIME}>{seasonLabel(ALL_TIME)}</option>
            </select>
          </label>
        </div>
        <div role="tablist" aria-label="Who to rank" className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-900 p-1">
          {(["global", "friends", "group"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => go({ scope: s })}
              className={`min-h-10 rounded-md text-sm font-medium ${FOCUS} ${
                scope === s ? "bg-neutral-100 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {TAB_NAMES[s]}
            </button>
          ))}
        </div>
        {scope === "group" && groups.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-neutral-400">
            Group
            <select value={group ?? ""} onChange={(e) => go({ group: e.target.value })} className={SELECT}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members.length})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {waiting && <p className="text-neutral-400">Loading your groups...</p>}
      {noGroups && (
        <p className="text-neutral-400">
          {filter.failed ? "Couldn't load your groups. " : "You're not in a group yet. "}
          <Link href="/groups/" className={`rounded-md underline underline-offset-4 ${FOCUS}`}>
            Start or join one
          </Link>
          .
        </p>
      )}
      {!waiting && !noGroups && (
        <BoardFetcher
          key={`${season}|${scope}|${scoped}`}
          season={season}
          scope={scope}
          group={scoped}
          judges={judges}
        />
      )}
    </>
  );
}

function BoardFetcher({
  season,
  scope,
  group,
  judges,
}: {
  season: string;
  scope: Scope;
  group: string | null;
  judges: Judge[];
}) {
  const [load, setLoad] = useState<BoardLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(season, scope, group).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
      (e: unknown) =>
        !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, scope, group, attempt]);

  if (load.kind === "loading") return <p className="text-neutral-400">Loading the leaderboard...</p>;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <LoadError what="the leaderboard" message={load.message} retry={retry} />;
  }
  return <LeaderboardView board={load.board} judges={judges} />;
}

export function LeaderboardView({ board, judges }: { board: Leaderboard; judges: Judge[] }) {
  const { ranked, unranked, me, minDances } = board;
  const mine = (sub: string) => sub === me.sub;

  return (
    <>
      {ranked.length === 0 ? (
        <p className="text-neutral-400">
          Nobody has {minDances} scored dances yet. A dance counts once every judge&apos;s score is confirmed.
        </p>
      ) : (
        <Podium top={ranked.slice(0, 3)} mine={mine} />
      )}

      {ranked.length > 3 && (
        <ol aria-label="Rankings" className="flex flex-col divide-y divide-neutral-800">
          {ranked.slice(3).map((r) => (
            <li
              key={r.sub}
              aria-current={mine(r.sub) ? "true" : undefined}
              className={`flex items-center gap-3 py-2.5 ${mine(r.sub) ? "-mx-2 rounded-md bg-gold/10 px-2 ring-1 ring-gold/40" : ""}`}
            >
              <span className="w-7 text-right text-sm font-semibold tabular-nums text-neutral-400">{r.rank}</span>
              <Avatar name={r.name ?? "Player"} email="" picture={r.picture} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{r.name ?? "Player"}</span>
                <span className="truncate text-xs text-neutral-400">
                  {r.count} dances
                  {r.closestJudge && ` · closest to ${judgeName(r.closestJudge.id, judges)}`}
                </span>
              </span>
              <span className="text-sm tabular-nums">{off(r.mae)}</span>
            </li>
          ))}
        </ol>
      )}

      {unranked.length > 0 && (
        <section aria-labelledby="unranked" className="flex flex-col gap-2">
          <h2 id="unranked" className="text-sm font-semibold text-neutral-400">
            Not ranked yet · {minDances} dances to qualify
          </h2>
          <ul className="flex flex-wrap gap-2">
            {unranked.map((u) => (
              <li
                key={u.sub}
                className="flex items-center gap-2 rounded-full border border-neutral-800 py-1 pr-3 pl-1 text-sm"
              >
                <Avatar name={u.name ?? "Player"} email="" picture={u.picture} size={24} />
                <span>{u.name ?? "Player"}</span>
                <span className="tabular-nums text-neutral-400">
                  {u.count}/{minDances}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <YouBar me={me} minDances={minDances} judges={judges} />
    </>
  );
}

const PLACES = {
  1: { height: "h-24", ring: "ring-gold", text: "text-gold", edge: "border-gold", avatar: 64 },
  2: { height: "h-16", ring: "ring-silver", text: "text-silver", edge: "border-silver", avatar: 52 },
  3: { height: "h-12", ring: "ring-gold-deep", text: "text-gold-deep", edge: "border-gold-deep", avatar: 52 },
} as const;

/** Second, first, third, left to right. A tied rank keeps its number, so two can share a step. */
function Podium({ top, mine }: { top: Ranked[]; mine: (sub: string) => boolean }) {
  const order = [top[1], top[0], top[2]].filter((r): r is Ranked => r !== undefined);
  return (
    <ol aria-label="Top three" className="grid grid-cols-3 items-end gap-2 pt-2">
      {order.map((r) => {
        const place = PLACES[Math.min(r.rank, 3) as 1 | 2 | 3];
        return (
          <li
            key={r.sub}
            aria-current={mine(r.sub) ? "true" : undefined}
            className="flex flex-col items-center gap-2"
            style={{ gridColumnStart: order.length === 1 ? 2 : undefined }}
          >
            <span className={`rounded-full ring-2 ring-offset-2 ring-offset-ink ${place.ring}`}>
              <Avatar name={r.name ?? "Player"} email="" picture={r.picture} size={place.avatar} />
            </span>
            <span className="flex w-full flex-col items-center text-center">
              <span className="w-full truncate text-sm font-medium">
                {r.name ?? "Player"}
                {mine(r.sub) && <span className="text-neutral-400"> (you)</span>}
              </span>
              <span className="text-xs tabular-nums text-neutral-400">{off(r.mae)}</span>
            </span>
            <span
              className={`flex w-full items-start justify-center rounded-t-md border-t-2 bg-gradient-to-b from-ballroom to-ink pt-2 ${place.edge} ${place.height}`}
            >
              <span className={`text-2xl font-bold tabular-nums ${place.text}`}>{r.rank}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function YouBar({ me, minDances, judges }: { me: Leaderboard["me"]; minDances: number; judges: Judge[] }) {
  return (
    <aside
      aria-label="Your standing"
      className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-3 border-t border-gold/30 bg-ballroom/95 px-4 py-3 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Avatar name={me.name ?? "You"} email="" picture={me.picture} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">You</span>
        <span className="truncate text-xs text-neutral-400">
          {me.rank === null
            ? `${me.count} of ${minDances} dances to rank`
            : `${me.count} dances${me.closestJudge ? ` · closest to ${judgeName(me.closestJudge.id, judges)}` : ""}`}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-lg font-semibold tabular-nums text-gold">{me.rank === null ? "Unranked" : `#${me.rank}`}</span>
        {me.mae !== null && <span className="text-xs tabular-nums text-neutral-400">{off(me.mae)}</span>}
      </span>
    </aside>
  );
}
