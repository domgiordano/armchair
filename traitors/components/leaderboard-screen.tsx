"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Avatar } from "@/components/ui/avatar";
import { SkeletonList } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TartanBand } from "@/components/ui/tartan-band";
import { tabId, Tabs } from "@/components/ui/tabs";
import { getRanks, type Ranks, type Scope, type Standing } from "@/lib/api/traitors";
import { useGroupFilter } from "@/lib/group-filter";
import { showOf } from "@/lib/seasons";
import { cn, HEADING, TEXT_LINK } from "@/lib/ui";

const SCOPES = [
  { id: "global", label: "Everyone" },
  { id: "friends", label: "Friends" },
  { id: "group", label: "Group" },
] as const;
const PANEL = "board-panel";
const ALL = "all";

export function LeaderboardScreen() {
  const { view } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const filter = useGroupFilter();
  const [range, setRange] = useState<string>(view.season);
  // A group's "Group board" link opens on that group.
  const asked = useSearchParams().get("group");
  const [scope, setScope] = useState<Scope>(asked ? "group" : "global");
  const [picked, setPicked] = useState<string | null>(asked);
  const groups = filter.groups ?? [];
  const group = groups.find((g) => g.id === (picked ?? filter.group))?.id ?? groups[0]?.id ?? null;
  const waiting = scope === "group" && filter.groups === null && !filter.failed;
  const noGroup = scope === "group" && !waiting && group === null;

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className={cn(HEADING, "text-2xl")}>Leaderboard</h1>
        <Select
          label="Standings for"
          hideLabel
          className="w-40"
          value={range}
          options={[
            { value: view.season, label: name.title },
            { value: ALL, label: "All-time" },
          ]}
          onChange={setRange}
        />
      </div>
      <Tabs label="Who to rank" tabs={SCOPES} value={scope} onChange={setScope} panelId={PANEL} />
      {scope === "group" && groups.length > 1 && (
        <Select
          label="Group"
          value={group ?? ""}
          options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` }))}
          onChange={setPicked}
        />
      )}
      <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, scope)} className="flex flex-col gap-4">
        {waiting && <SkeletonList label="Loading your groups" />}
        {noGroup && (
          <EmptyState title={filter.failed ? "Couldn't load your groups" : "You're not in a group yet"}>
            A group ranks just the people in it.{" "}
            <Link href="/groups/" className={TEXT_LINK}>
              Start one or join one
            </Link>
            ; the same groups work in every Armchair Judge show.
          </EmptyState>
        )}
        {!waiting && !noGroup && (
          <Board
            key={`${range}|${scope}|${group}`}
            season={range}
            show={showOf(view.season)}
            scope={scope}
            group={scope === "group" ? group : null}
          />
        )}
      </div>
    </>
  );
}

type Load = { kind: "loading" } | { kind: "ready"; ranks: Ranks } | { kind: "error"; message: string };

function Board({ season, show, scope, group }: { season: string; show: string; scope: Scope; group: string | null }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getRanks(season, show, scope, group).then(
      (ranks) => !cancelled && setLoad({ kind: "ready", ranks }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, show, scope, group, attempt]);

  if (load.kind === "loading") return <SkeletonList label="Counting the pot" rows={5} />;
  if (load.kind === "error") {
    return (
      <ErrorState
        what="the leaderboard"
        message={load.message}
        retry={() => {
          setLoad({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const { ranked, me } = load.ranks;
  if (ranked.every((r) => r.points === 0)) {
    return <EmptyState title="The pot is empty">Points arrive once results are confirmed for calls people have made.</EmptyState>;
  }
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  // In a short list you're already in view; pin a copy only when you might not be.
  const pin = !ranked.some((r) => r.sub === me.sub) || rest.length > 6;

  return (
    <>
      <ol aria-label="Top three" className="grid grid-cols-3 items-end gap-2">
        {[top[1], top[0], top[2]].map((r) => r && <Pot key={r.sub} standing={r} best={top[0].points} mine={r.sub === me.sub} />)}
      </ol>
      {rest.length > 0 && (
        <div className="relative pl-4">
          <TartanBand vertical className="absolute inset-y-0 left-0 w-2" />
          <ol aria-label="Everyone else" className="flex flex-col gap-1.5">
            {rest.map((r) => (
              <Row key={r.sub} standing={r} mine={r.sub === me.sub} />
            ))}
          </ol>
        </div>
      )}
      {pin && (
        <ol aria-label="Your place" className="sticky bottom-3 z-10">
          <Row standing={me} mine />
        </ol>
      )}
    </>
  );
}

const PLACE = ["I", "II", "III"];

/** The top three as stacks of gold, the tallest for first. */
function Pot({ standing: s, best, mine }: { standing: Standing; best: number; mine: boolean }) {
  const bars = Math.max(1, Math.round((s.points / Math.max(1, best)) * 5));
  return (
    <li aria-current={mine ? "true" : undefined} className={cn("flex flex-col items-center gap-1.5 text-center", s.rank === 1 && "-mt-4")}>
      <span className="font-display text-sm text-gilt">{PLACE[s.rank - 1] ?? s.rank}</span>
      <Avatar name={s.name} picture={s.picture} size={s.rank === 1 ? 56 : 44} className={cn("ring-2", s.rank === 1 ? "ring-candle" : "ring-gilt")} />
      <span className={cn("w-full truncate", mine ? "text-candle" : "text-bone")}>{s.name ?? "Player"}</span>
      <span aria-hidden="true" className="flex flex-col-reverse items-center gap-0.5">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} className="h-2.5 w-12 rounded-[2px] border border-flame/40 bg-gradient-to-b from-flame to-gilt shadow-[0_2px_4px_rgb(0_0_0/0.5)]" />
        ))}
      </span>
      <span className="font-display text-2xl font-semibold text-candle nums">{s.points}</span>
    </li>
  );
}

function Row({ standing: s, mine }: { standing: Standing; mine: boolean }) {
  return (
    <li
      aria-current={mine ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-sm border px-3 py-2",
        mine ? "border-candle bg-cloak-500 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.9)]" : "border-gilt/20 bg-stone/90",
      )}
    >
      <span className="w-7 text-right font-display text-sm text-ash nums">{s.rank}</span>
      <Avatar name={s.name} picture={s.picture} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-bone">{mine ? `You${s.name ? ` · ${s.name}` : ""}` : (s.name ?? "Player")}</span>
        <span className="truncate text-sm text-ash">
          <span className="nums">{s.events}</span> calls · <span className="nums">{s.banishHits}</span> banishments
          {s.average !== null && (
            <>
              {" "}
              · <span className="nums">{s.average.toFixed(1)}</span> a call
            </>
          )}
        </span>
      </span>
      <span className="font-display text-lg font-semibold text-candle nums">{s.points}</span>
    </li>
  );
}
