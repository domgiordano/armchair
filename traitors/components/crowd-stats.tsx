"use client";

import { useEffect, useState } from "react";

import { errorText, useSeasonView } from "@/components/season-data";
import { Avatar } from "@/components/ui/avatar";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getCrowdStats, type CrowdStats as Crowd, type EventType } from "@/lib/api/traitors";
import { extremes, rate, type RatedCall } from "@/lib/crowd";
import { roman } from "@/lib/players";
import { cn, EYEBROW } from "@/lib/ui";

const LABEL: Record<EventType, string> = { RT: "Round table", MURDER: "Murders", RECRUIT: "Recruits" };
const ORDER: EventType[] = ["RT", "MURDER", "RECRUIT"];

const percent = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);

type Load = { kind: "loading" } | { kind: "ready"; crowd: Crowd } | { kind: "error"; message: string };

/** Everyone's calls, or one group's, set against yours. `name` says who: "Everyone" or the group. */
export function CrowdStats({ group, name }: { group: string | null; name: string }) {
  const { view } = useSeasonView();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCrowdStats(view.season, group).then(
      (crowd) => !cancelled && setLoad({ kind: "ready", crowd }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: errorText(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [view.season, group, attempt]);

  if (load.kind === "loading") return <SkeletonList label="Reading the crowd" rows={4} row="h-20" />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="the crowd's stats" message={load.message} retry={retry} />;
  }

  const c = load.crowd;
  if (c.episodes.length === 0) {
    return <EmptyState title="Nothing to compare yet">The crowd&apos;s calls show for each episode once you&apos;ve answered all of it, or it has closed.</EmptyState>;
  }
  const who = new Map(view.cast.map((p) => [p.id, p.name]));
  const player = (id: string | undefined) => (id ? (who.get(id) ?? id) : "–");
  const { hardest, easiest } = extremes(c.episodes);

  return (
    <>
      <section aria-labelledby="vs" className="flex flex-col gap-3">
        <h2 id="vs" className={EYEBROW}>
          You vs {name}
        </h2>
        <ul className="flex flex-col gap-3">
          {ORDER.map((type) => {
            const you = rate(c.mine[type].hits, c.mine[type].scored);
            const them = rate(c.byEvent[type].hits, c.byEvent[type].scored);
            return (
              <li key={type} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-bone">{LABEL[type]}</span>
                  <span className="text-ash">
                    You <span className="nums text-candle">{percent(you)}</span> · {name} <span className="nums text-bone">{percent(them)}</span>
                  </span>
                </span>
                <Bar value={you} gold />
                <Bar value={them} />
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="leaders" className="flex flex-col gap-3">
        <h2 id="leaders" className={EYEBROW}>
          Leaders
        </h2>
        <ol aria-label="Leaders" className="flex flex-col gap-1.5">
          {c.leaders.map((l) => (
            <li key={l.sub} className="flex items-center gap-3 rounded-sm border border-gilt/20 bg-stone/90 px-3 py-2">
              <span className="w-6 text-right font-display text-sm text-ash nums">{l.rank}</span>
              <Avatar name={l.name} picture={l.picture} size={32} />
              <span className="min-w-0 flex-1 truncate text-bone">{l.name ?? "Player"}</span>
              <span className="font-display font-semibold text-candle nums">{l.points}</span>
            </li>
          ))}
        </ol>
        <p className="text-parchment">
          You&apos;re <span className="nums text-candle">#{c.me.rank}</span> of <span className="nums">{c.ranked}</span> with{" "}
          <span className="nums">{c.me.points}</span> points, over the episodes you&apos;ve seen.
        </p>
      </section>

      <section aria-labelledby="by-ep" className="flex flex-col gap-3">
        <h2 id="by-ep" className={EYEBROW}>
          Episode by episode
        </h2>
        <ol className="flex flex-col gap-2">
          {[...c.episodes].reverse().map((e) => (
            <li key={e.ep} className="flex flex-col gap-1 rounded-sm border border-gilt/20 bg-night/60 px-3 py-2">
              <span className="font-display text-sm text-gilt">
                Episode {roman(e.ep)}
                {e.title && <span className="text-ash"> · {e.title}</span>}
              </span>
              {e.calls.RT && (
                <span className="text-parchment">
                  <span className="nums text-bone">{percent(rate(e.calls.RT.hits, e.calls.RT.voters))}</span> had {player(e.calls.RT.banished)} first. Most picked{" "}
                  {player(e.calls.RT.top)} (<span className="nums">{e.calls.RT.topVotes}</span>).
                </span>
              )}
              {(["MURDER", "RECRUIT"] as const).map((t) => {
                const call = e.calls[t];
                return (
                  call && (
                    <span key={t} className="text-ash">
                      {LABEL[t]}: <span className="nums text-bone">{percent(rate(call.hits, call.voters))}</span> right
                    </span>
                  )
                );
              })}
            </li>
          ))}
        </ol>
      </section>

      <Calls id="hardest" title="Hardest calls" calls={hardest} />
      <Calls id="easiest" title="Easiest calls" calls={easiest} />
    </>
  );
}

function Bar({ value, gold = false }: { value: number | null; gold?: boolean }) {
  return (
    <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-night">
      <span
        className={cn("block h-full origin-left animate-grow-x rounded-full", gold ? "bg-candle" : "bg-parchment/60")}
        style={{ width: `${Math.max(2, (value ?? 0) * 100)}%` }}
      />
    </span>
  );
}

function Calls({ id, title, calls }: { id: string; title: string; calls: RatedCall[] }) {
  if (calls.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className={EYEBROW}>
        {title}
      </h2>
      <ol aria-label={title} className="flex flex-col gap-1">
        {calls.map((c) => (
          <li key={`${c.ep}-${c.type}`} className="flex items-baseline justify-between gap-3">
            <span className="text-bone">
              Episode {roman(c.ep)} · {LABEL[c.type]}
            </span>
            <span className="text-ash">
              <span className="nums text-bone">{c.hits}</span> of <span className="nums">{c.voters}</span> right
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
