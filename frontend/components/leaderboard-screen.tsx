"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { SignedIn } from "@/components/signed-in";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { ALL_TIME, getLeaderboard, type Leaderboard, type Ranked, type Scope } from "@/lib/api/leaderboard";
import type { Judge } from "@/lib/api/show";
import { useGroupFilter } from "@/lib/show/group-filter";
import { seasonLabel as shellSeasonLabel, useSeasonId } from "@/lib/show/seasons";
import { useSeason } from "@/lib/show/use-season";
import { button, cn } from "@/lib/ui";

type BoardLoad = { kind: "loading" } | { kind: "ready"; board: Leaderboard } | { kind: "error"; message: string };

const SCOPES = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
  { id: "group", label: "Groups" },
] as const;
const PANEL = "leaderboard-panel";

export const off = (mae: number) => `${mae.toFixed(2)} off`;

export const seasonLabel = (season: string) => (season === ALL_TIME ? "All-time" : shellSeasonLabel(season));

/** Past seasons' guest judges aren't in this season's catalog; their id is their name, slugged. */
export function judgeName(id: string, judges: Judge[]): string {
  const known = judges.find((j) => j.id === id)?.name;
  return known ?? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function LeaderboardScreen() {
  return (
    <SignedIn title="Leaderboard" wide>
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
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Leaderboard"
          action={
            <Select
              label="Standings for"
              hideLabel
              className="w-36"
              value={season}
              options={[
                { value: picked, label: seasonLabel(picked) },
                { value: ALL_TIME, label: seasonLabel(ALL_TIME) },
              ]}
              onChange={(s) => go({ season: s })}
            />
          }
        />
        <div className="md:max-w-md">
          <Tabs label="Who to rank" tabs={SCOPES} value={scope} onChange={(s) => go({ scope: s })} panelId={PANEL} />
        </div>
        {scope === "group" && groups.length > 0 && (
          <div className="md:max-w-md">
            <Select
              label="Group"
              value={group ?? ""}
              options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` }))}
              onChange={(g) => go({ group: g })}
            />
          </div>
        )}
      </div>

      <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, scope)} className="flex flex-1 flex-col gap-4">
        {waiting && <BoardSkeleton label="Loading your groups" />}
        {noGroups && (
          <EmptyState
            title={filter.failed ? "Couldn't load your groups" : "You're not in a group yet"}
            action={
              <Link href="/groups/" className={button("primary", "sm")}>
                Start or join one
              </Link>
            }
          >
            A group ranks just the people in it.
          </EmptyState>
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
      </div>
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

  if (load.kind === "loading") return <BoardSkeleton label="Loading the leaderboard" />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="the leaderboard" message={load.message} retry={retry} />;
  }
  return <LeaderboardView board={load.board} judges={judges} />;
}

export function LeaderboardView({ board, judges }: { board: Leaderboard; judges: Judge[] }) {
  const { ranked, unranked, me, minDances } = board;
  const mine = (sub: string) => sub === me.sub;
  // Side by side only when there's a table to sit beside the podium.
  const split = ranked.length > 3;
  const waiting = unranked.length > 0 && (
    <section aria-labelledby="unranked" className="flex flex-col gap-2">
      <h2 id="unranked" className="text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">
        Not ranked yet · {minDances} dances to qualify
      </h2>
      <ul className="flex flex-wrap gap-2">
        {unranked.map((u) => (
          <li
            key={u.sub}
            className="flex items-center gap-2 rounded-full border border-silver/15 bg-ballroom/40 py-1 pr-3 pl-1 text-sm"
          >
            <Avatar name={u.name ?? "Player"} email="" picture={u.picture} size={24} />
            <span className="text-pearl">{u.name ?? "Player"}</span>
            <span className="text-silver-dim tabular-nums">
              {u.count}/{minDances}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <div className={split ? "grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10" : "contents"}>
        {ranked.length === 0 ? (
          <EmptyState title="No rankings yet">
            Nobody has {minDances} scored dances yet. A dance counts once every judge&apos;s score is confirmed.
          </EmptyState>
        ) : (
          <div className={split ? "lg:sticky lg:top-32 lg:rounded-xl lg:border lg:border-silver/10 lg:bg-ballroom/45 lg:p-6" : ""}>
            <Podium top={ranked.slice(0, 3)} mine={mine} />
          </div>
        )}

        {split && (
          <div className="flex flex-col gap-6">
            <ol aria-label="Rankings" className="flex flex-col gap-1.5">
              {ranked.slice(3).map((r) => (
                <li
                  key={r.sub}
                  aria-current={mine(r.sub) ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    mine(r.sub) ? "border-gold/40 bg-gold/10" : "border-silver/10 bg-ballroom/40 hover:border-silver/20",
                  )}
                >
                  <span className="w-6 text-right text-sm font-semibold text-silver-dim tabular-nums">{r.rank}</span>
                  <Avatar name={r.name ?? "Player"} email="" picture={r.picture} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-pearl">{r.name ?? "Player"}</span>
                    <span className="truncate text-xs text-silver-dim">
                      {r.count} dances
                      {r.closestJudge && ` · closest to ${judgeName(r.closestJudge.id, judges)}`}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-pearl tabular-nums">{off(r.mae)}</span>
                </li>
              ))}
            </ol>
            {waiting}
          </div>
        )}
      </div>

      {!split && waiting}

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
                {mine(r.sub) && <span className="text-gold-light"> (you)</span>}
              </span>
              <span className="text-xs text-silver-dim tabular-nums">{off(r.mae)}</span>
            </span>
            <span
              className={`relative flex w-full items-start justify-center overflow-hidden rounded-t-lg border-t-2 bg-gradient-to-b from-ballroom to-ink pt-2 shadow-[inset_0_1px_12px_rgb(232_194_104/0.12)] ${place.edge} ${place.height}`}
            >
              <span className={`font-display text-3xl tabular-nums ${place.text}`}>{r.rank}</span>
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
      className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-3 border-t border-gold/40 bg-ballroom/90 px-4 py-3 shadow-[0_-12px_30px_-12px_rgb(2_8_30/0.9)] backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-t-xl lg:border-x"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Avatar name={me.name ?? "You"} email="" picture={me.picture} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-pearl">You</span>
        <span className="truncate text-xs text-silver-dim">
          {me.rank === null
            ? `${me.count} of ${minDances} dances to rank`
            : `${me.count} dances${me.closestJudge ? ` · closest to ${judgeName(me.closestJudge.id, judges)}` : ""}`}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-lg font-semibold tabular-nums text-gold">{me.rank === null ? "Unranked" : `#${me.rank}`}</span>
        {me.mae !== null && <span className="text-xs text-silver-dim tabular-nums">{off(me.mae)}</span>}
      </span>
    </aside>
  );
}

function BoardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}...</span>
      <div className="grid grid-cols-3 items-end gap-2 pt-2">
        {["h-16", "h-24", "h-12"].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className={`rounded-full ${i === 1 ? "size-16" : "size-13"}`} />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className={`w-full rounded-b-none ${h}`} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}
