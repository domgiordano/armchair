"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CrowdStats } from "@/components/crowd-stats";
import { FaceDownNotice } from "@/components/face-down";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { getStats, type EventType, type Stats } from "@/lib/api/traitors";
import { useGroupFilter } from "@/lib/group-filter";
import { roman } from "@/lib/players";
import { useFaceDown } from "@/lib/sealed";
import { cn, EYEBROW, HEADING, TEXT_LINK } from "@/lib/ui";

const EVENTS: { type: EventType; label: string }[] = [
  { type: "RT", label: "Round table" },
  { type: "MURDER", label: "Murders" },
  { type: "RECRUIT", label: "Recruits" },
];

const VIEWS = [
  { id: "me", label: "You" },
  { id: "groups", label: "Groups" },
  { id: "global", label: "Everyone" },
] as const;
type View = (typeof VIEWS)[number]["id"];
const PANEL = "stats-panel";

/** The query string holds the tab, so a link opens the same one: ?view=groups. */
function useView(): [View, (v: View) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("view");
  const view = VIEWS.find((v) => v.id === asked)?.id ?? "me";
  const set = (v: View) => {
    const next = new URLSearchParams(params.toString());
    if (v === "me") next.delete("view");
    else next.set("view", v);
    const q = next.toString();
    router.replace(q ? `/stats/?${q}` : "/stats/", { scroll: false });
  };
  return [view, set];
}

export function StatsScreen() {
  const { view } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const [tab, setTab] = useView();
  const faceDown = useFaceDown(view.season);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{name.title}</p>
        <h1 className={cn(HEADING, "text-2xl")}>{tab === "me" ? "Your ledger" : "The crowd's ledger"}</h1>
      </div>
      <Tabs label="Whose stats" tabs={VIEWS} value={tab} onChange={setTab} panelId={PANEL} />
      <div key={tab} id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, tab)} className="flex flex-col gap-4">
        {faceDown.eps.length > 0 ? (
          <FaceDownNotice season={view.season} ep={faceDown.eps[0]} what={tab === "me" ? "Your ledger" : "The crowd"} />
        ) : (
          <>
            {tab === "me" && <Ledger season={view.season} />}
            {tab === "groups" && <GroupStats />}
            {tab === "global" && <CrowdStats group={null} name="Everyone" />}
          </>
        )}
      </div>
    </>
  );
}

function GroupStats() {
  const filter = useGroupFilter();
  const [picked, setPicked] = useState<string | null>(null);
  if (filter.groups === null && !filter.failed) return <SkeletonList label="Loading your groups" />;
  const groups = filter.groups ?? [];
  const group = groups.find((g) => g.id === (picked ?? filter.group)) ?? groups[0];
  if (!group) {
    return (
      <EmptyState title={filter.failed ? "Couldn't load your groups" : "You're not in a group yet"}>
        A group sets your calls beside just the people in it.{" "}
        <Link href="/groups/" className={TEXT_LINK}>
          Start one or join one
        </Link>
        .
      </EmptyState>
    );
  }
  return (
    <>
      {groups.length > 1 && (
        <Select
          label="Group"
          value={group.id}
          options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` }))}
          onChange={setPicked}
        />
      )}
      <CrowdStats key={group.id} group={group.id} name={group.name} />
    </>
  );
}

type Load = { kind: "loading" } | { kind: "ready"; stats: Stats } | { kind: "error"; message: string };

function Ledger({ season }: { season: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStats(season).then(
      (stats) => !cancelled && setLoad({ kind: "ready", stats }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  if (load.kind === "loading") {
    return <SkeletonList label="Reading the ledger" rows={4} row="h-20" />;
  }
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="your stats" message={load.message} retry={retry} />;
  }

  const s = load.stats;
  if (s.events === 0 && s.winnerPoints === null) {
    return <EmptyState title="Nothing scored yet">Your numbers fill in once results confirm for calls you&apos;ve sealed.</EmptyState>;
  }
  const best = Math.max(1, ...s.byEpisode.map((e) => e.points));

  return (
    <>
      <Card tartan className="grid grid-cols-3 gap-2 text-center">
        <Figure label="Points" value={s.points} gold />
        <Figure label="Calls scored" value={s.events} />
        <Figure label="Banishments" value={s.banishHits} />
      </Card>

      <section aria-labelledby="by-event" className="flex flex-col gap-3">
        <h2 id="by-event" className={EYEBROW}>
          By call
        </h2>
        <ul className="flex flex-col gap-3">
          {EVENTS.map(({ type, label }) => {
            const e = s.byEvent[type];
            const rate = e.scored ? e.hits / e.scored : 0;
            return (
              <li key={type} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-bone">{label}</span>
                  <span className="text-ash">
                    <span className="nums text-bone">{e.hits}</span> of <span className="nums">{e.scored}</span> right ·{" "}
                    <span className="nums text-candle">{e.points}</span> pts
                  </span>
                </span>
                <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-night">
                  <span
                    className="block h-full origin-left animate-grow-x rounded-full bg-candle"
                    style={{ width: `${Math.max(2, rate * 100)}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        {s.winnerPoints !== null && (
          <p className="text-parchment">
            Winner bet: <span className="nums text-candle">{s.winnerPoints}</span> points
          </p>
        )}
      </section>

      <section aria-labelledby="by-episode" className="flex flex-col gap-3">
        <h2 id="by-episode" className={EYEBROW}>
          Points by episode
        </h2>
        <ol
          aria-label={`Points by episode: ${s.byEpisode.map((e) => `episode ${e.ep} ${e.points}`).join(", ")}`}
          className="flex h-40 items-end gap-1 border-b border-gilt/40"
        >
          {s.byEpisode.map((e, i) => (
            <li key={e.ep} aria-hidden="true" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {e.points > 0 && <span className="text-xs text-parchment nums">{e.points}</span>}
              <span
                className="w-full max-w-8 origin-bottom animate-grow-y rounded-t-[2px] bg-gradient-to-t from-gilt to-flame"
                style={{ height: `${(e.points / best) * 100}%`, animationDelay: `${i * 40}ms` }}
              />
            </li>
          ))}
        </ol>
        <ol aria-hidden="true" className="-mt-2 flex gap-1">
          {s.byEpisode.map((e) => (
            <li key={e.ep} className="min-w-0 flex-1 text-center font-display text-[10px] text-ash">
              {roman(e.ep)}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Figure({ label, value, gold = false }: { label: string; value: number; gold?: boolean }) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className={cn("font-display text-3xl font-semibold nums", gold ? "text-candle" : "text-bone")}>{value}</span>
      <span className="text-sm text-ash">{label}</span>
    </p>
  );
}
