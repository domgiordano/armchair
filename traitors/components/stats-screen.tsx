"use client";

import { useEffect, useState } from "react";

import { FaceDownNotice } from "@/components/face-down";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getStats, type EventType, type Stats } from "@/lib/api/traitors";
import { roman } from "@/lib/players";
import { useFaceDown } from "@/lib/sealed";
import { cn, EYEBROW, HEADING } from "@/lib/ui";

const EVENTS: { type: EventType; label: string }[] = [
  { type: "RT", label: "Round table" },
  { type: "MURDER", label: "Murders" },
  { type: "RECRUIT", label: "Recruits" },
];

type Load = { kind: "loading" } | { kind: "ready"; stats: Stats } | { kind: "error"; message: string };

export function StatsScreen() {
  const { view } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const faceDown = useFaceDown(view.season);

  useEffect(() => {
    let cancelled = false;
    getStats(view.season).then(
      (stats) => !cancelled && setLoad({ kind: "ready", stats }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [view.season, attempt]);

  const heading = (
    <div className="flex flex-col gap-1">
      <p className={EYEBROW}>{name.title}</p>
      <h1 className={cn(HEADING, "text-2xl")}>Your ledger</h1>
    </div>
  );
  if (faceDown.eps.length > 0) {
    return (
      <>
        {heading}
        <FaceDownNotice season={view.season} ep={faceDown.eps[0]} what="Your ledger" />
      </>
    );
  }
  if (load.kind === "loading") {
    return (
      <>
        {heading}
        <SkeletonList label="Reading the ledger" rows={4} row="h-20" />
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
        {heading}
        <ErrorState what="your stats" message={load.message} retry={retry} />
      </>
    );
  }

  const s = load.stats;
  if (s.events === 0 && s.winnerPoints === null) {
    return (
      <>
        {heading}
        <EmptyState title="Nothing scored yet">Your numbers fill in once results confirm for calls you&apos;ve sealed.</EmptyState>
      </>
    );
  }
  const best = Math.max(1, ...s.byEpisode.map((e) => e.points));

  return (
    <>
      {heading}
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
