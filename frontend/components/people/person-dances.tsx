"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PersonLink } from "@/components/couple-names";
import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { Badge } from "@/components/ui/badge";
import { WhatHappened } from "@/components/what-happened";
import type { Average, OpenRow, PerformanceRow } from "@/lib/api/people";
import { getSeason, type Judge } from "@/lib/api/show";
import { seasonLabel } from "@/lib/show/seasons";
import { button, cn, EYEBROW } from "@/lib/ui";

export const avg = (n: number | null) => (n === null ? "–" : n.toFixed(1));

export const episodeHref = (season: string, ep: number) =>
  `/episode/?season=${encodeURIComponent(season)}&ep=${String(ep).padStart(2, "0")}`;

export interface Night {
  season: string;
  ep: number;
  week: number | null;
  /** "Week 3", or "Week 1, night 2" when a week has two scored nights. */
  label: string;
  rows: PerformanceRow[];
}

/** Rows grouped by season, then by night in airing order. */
export function nights(rows: PerformanceRow[]): { season: string; nights: Night[] }[] {
  const seasons = new Map<string, Map<number, PerformanceRow[]>>();
  for (const r of rows) {
    const eps = seasons.get(r.season) ?? new Map<number, PerformanceRow[]>();
    seasons.set(r.season, eps);
    eps.set(r.ep, [...(eps.get(r.ep) ?? []), r]);
  }
  return [...seasons].map(([season, eps]) => {
    const sorted = [...eps].sort(([a], [b]) => a - b);
    const perWeek = new Map<number | null, number>();
    return {
      season,
      nights: sorted.map(([ep, rs]) => {
        const week = rs[0].week;
        const n = (perWeek.get(week) ?? 0) + 1;
        perWeek.set(week, n);
        const shared = sorted.filter(([, x]) => x[0].week === week).length > 1;
        const base = week === null ? `Episode ${ep}` : `Week ${week}`;
        return { season, ep, week, label: shared ? `${base}, night ${n}` : base, rows: rs };
      }),
    };
  });
}

interface DanceListProps {
  rows: PerformanceRow[];
  /** Whose page this is: their name is left out of each row's dancers. */
  self: string;
  /** Judge pages show the judge's own score against the panel. */
  judge?: string;
}

/** Every night as a block: answered dances as cards, the rest folded into one nudge to go score them. */
export function DanceList({ rows, self, judge }: DanceListProps) {
  const judges = useJudges(rows);
  return (
    <div className="flex flex-col gap-8">
      {nights(rows).map(({ season, nights: list }) => (
        <section key={season} aria-label={seasonLabel(season)} className="flex flex-col gap-4">
          <h3 className={EYEBROW}>{seasonLabel(season)}</h3>
          <ol className="stagger grid grid-cols-1 gap-x-3 gap-y-5 min-[30rem]:grid-cols-2 xl:grid-cols-3">
            {list.map((night) => (
              <NightBlock key={night.ep} night={night} self={self} judge={judge} judges={judges} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** The panels of the seasons whose open dances have a write-up, for the judges' names and photos. */
function useJudges(rows: PerformanceRow[]): Judge[] {
  const wanted = [...new Set(rows.flatMap((r) => (!r.locked && r.writeup ? [r.season] : [])))].sort().join(",");
  const [judges, setJudges] = useState<Judge[]>([]);
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    Promise.all(wanted.split(",").map(getSeason)).then(
      (seasons) => !cancelled && setJudges(seasons.flatMap((s) => s.judges)),
      // Without the panel the write-ups still show, with names from ids and initials for photos.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return judges;
}

function NightBlock({ night, self, judge, judges }: { night: Night; self: string; judge?: string; judges: Judge[] }) {
  const open = night.rows.filter((r): r is OpenRow => !r.locked);
  const locked = night.rows.length - open.length;
  return (
    <li className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-pearl">{night.label}</p>
      {open.length > 0 && (
        <ul className="grid grid-cols-1 gap-2">
          {open.map((r) => (
            <li key={r.key}>
              <DanceCard row={r} self={self} judge={judge} judges={judges} />
            </li>
          ))}
        </ul>
      )}
      {locked > 0 && <Nudge night={night} count={locked} partial={open.length > 0} />}
    </li>
  );
}

/** The gate's message, as an invitation: their scores are a few paddles away. */
export function Nudge({ night, count, partial }: { night: Night; count: number; partial: boolean }) {
  const what = night.label.replace(/^Week/, "week");
  const styles = night.rows.flatMap((r) => (r.locked && r.style ? [r.style] : []));
  const told = night.rows.some((r) => r.locked && r.writeup);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gold/30 bg-gold/[0.04] px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <LockIcon />
        <div className="min-w-0">
          <p className="text-sm text-pearl">
            {partial
              ? `${count} more ${count === 1 ? "dance" : "dances"} from ${what} to score`
              : `To see ${what} scores, score ${count === 1 ? "it" : "them"} first`}
          </p>
          {styles.length > 0 && <p className="truncate text-xs text-silver-dim">{styles.join(" · ")}</p>}
          {told && <p className="text-xs text-silver-dim">What happened, and what the judges said, opens with the scores.</p>}
        </div>
      </div>
      <Link href={episodeHref(night.season, night.ep)} prefetch={false} className={button("primary", "sm")}>
        Score {what}
      </Link>
    </div>
  );
}

function DanceCard({ row, self, judge, judges }: { row: OpenRow; self: string; judge?: string; judges: Judge[] }) {
  const others = row.dancers.filter((d) => d.id !== self);
  const theirs = judge ? row.judges.find((j) => j.id === judge) : undefined;
  const mine = row.mine && "value" in row.mine ? row.mine.value : null;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-pearl">{row.style ?? "Dance"}</p>
          {row.song && <p className="truncate text-xs text-silver-dim">{row.song}</p>}
          {others.length > 0 && (
            <p className="mt-0.5 text-xs text-silver">
              {judge ? "" : "with "}
              {others.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && (judge ? " & " : ", ")}
                  <PersonLink id={d.id} name={d.name} />
                </span>
              ))}
            </p>
          )}
        </div>
        {row.dancers.length > 2 && <Badge tone="muted">Team</Badge>}
      </header>
      <dl className="grid grid-cols-4 gap-2 text-center">
        <Figure
          label={theirs ? "Them" : "Judges"}
          value={theirs ? (theirs.value === null ? "–" : formatScore(theirs.value)) : avg(row.panelMean)}
          strong
        />
        {theirs ? <Figure label="Panel" value={avg(row.panelMean)} /> : <Figure label="You" value={mine === null ? (row.mine ? "Skip" : "–") : String(mine)} strong />}
        <Figure label="Friends" value={avgOf(row.friends)} />
        <Figure label="Everyone" value={avgOf(row.everyone)} />
      </dl>
      <p className="text-xs text-silver-dim">
        {row.judges.map((j) => `${judgeName(j.id, []).split(" ")[0]} ${j.value === null ? "–" : formatScore(j.value)}`).join(" · ")}
        {theirs && mine !== null && ` · You ${mine}`}
      </p>
      <WhatHappened writeup={row.writeup} judges={judges} />
    </article>
  );
}

const avgOf = (a: Average) => (a.count ? avg(a.mean) : "–");

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-ink/40 px-1 py-1.5">
      <dt className="text-[11px] tracking-wide text-silver-dim uppercase">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-lg font-semibold text-pearl" : "text-base text-silver")}>{value}</dd>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
