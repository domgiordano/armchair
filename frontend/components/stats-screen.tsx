"use client";

import { useEffect, useState } from "react";

import { LoadError } from "@/components/load-error";
import { formatScore } from "@/components/performance-card";
import { SignedIn } from "@/components/signed-in";
import type { Season } from "@/lib/api/show";
import { getStats, type Dance, type Stats } from "@/lib/api/stats";
import { episodeLabel } from "@/lib/show/schedule";
import { useSeason } from "@/lib/show/use-season";

type StatsLoad = { kind: "loading" } | { kind: "ready"; stats: Stats } | { kind: "error"; message: string };

export function StatsScreen() {
  return (
    <SignedIn title="Accuracy">
      <SeasonLoader />
    </SignedIn>
  );
}

function SeasonLoader() {
  const load = useSeason();
  if (load.kind === "loading") return <p className="text-neutral-400">Loading the season...</p>;
  if (load.kind === "error") return <LoadError what="the season" message={load.message} retry={load.retry} />;
  return <StatsLoader season={load.season} />;
}

function StatsLoader({ season }: { season: Season }) {
  const [load, setLoad] = useState<StatsLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStats(season.season).then(
      (stats) => !cancelled && setLoad({ kind: "ready", stats }),
      (e: unknown) =>
        !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season.season, attempt]);

  if (load.kind === "loading") return <p className="text-neutral-400">Loading your stats...</p>;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <LoadError what="your stats" message={load.message} retry={retry} />;
  }
  return <StatsView season={season} stats={load.stats} />;
}

const off = (mae: number) => `${formatScore(mae)} off`;

function StatsView({ season, stats }: { season: Season; stats: Stats }) {
  const { mine } = stats;
  const judgeName = (id: string) => season.judges.find((j) => j.id === id)?.name ?? id;
  const label = (ep: number) => {
    const e = season.episodes.find((x) => x.ep === ep);
    return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
  };

  if (mine.mae === null) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight">Your accuracy</h1>
        <p className="text-neutral-400">
          Nothing to compare yet. Stats count dances you scored once every judge&apos;s score is confirmed.
        </p>
      </>
    );
  }

  const judges = Object.entries(mine.judges).sort(([, a], [, b]) => a.mae - b.mae);
  const rank = stats.others.filter((o) => o.mae < (mine.mae ?? 0)).length + 1;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Your accuracy</h1>
      <section aria-labelledby="overall" className="flex flex-col gap-1">
        <h2 id="overall" className="text-sm text-neutral-400">
          Against the judges&apos; average
        </h2>
        <p className="text-3xl font-semibold tabular-nums">{off(mine.mae)}</p>
        <p className="text-sm text-neutral-400">
          Average gap per dance, over {mine.count} {mine.count === 1 ? "dance" : "dances"}.
          {stats.others.length > 0 && ` You rank ${rank} of ${stats.others.length + 1} on the dances you've scored.`}
        </p>
      </section>

      {judges.length > 0 && (
        <section aria-labelledby="per-judge" className="flex flex-col gap-2">
          <h2 id="per-judge" className="font-semibold">
            Closest to {judgeName(judges[0][0])}
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {judges.map(([id, j]) => (
              <div key={id} className="contents">
                <dt>{judgeName(id)}</dt>
                <dd className="text-right tabular-nums">{off(j.mae)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="progression" className="flex flex-col gap-2">
        <h2 id="progression" className="font-semibold">
          You vs the judges, dance by dance
        </h2>
        <Progression dances={stats.dances} label={label} />
        <p className="flex gap-4 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-amber-300" />
            You
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-current" />
            Judges&apos; average
          </span>
        </p>
      </section>

      <section aria-labelledby="by-episode" className="flex flex-col gap-2">
        <h2 id="by-episode" className="font-semibold">
          By episode
        </h2>
        <ul className="flex flex-col divide-y divide-neutral-800 text-sm">
          {stats.episodes.map((e) => (
            <li key={e.ep} className="flex items-baseline justify-between gap-3 py-2">
              <span>{label(e.ep)}</span>
              <span className="tabular-nums text-neutral-400">
                {e.count} {e.count === 1 ? "dance" : "dances"} · <span className="text-neutral-100">{off(e.mae ?? 0)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

const W = 320;
const H = 170;
const PAD = { left: 22, right: 8, top: 8, bottom: 20 };

/** Two lines on a fixed 1-10 scale. Colours come from currentColor, so it follows the text theme. */
export function Progression({ dances, label }: { dances: Dance[]; label: (ep: number) => string }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (dances.length === 1 ? plotW / 2 : (i * plotW) / (dances.length - 1));
  const y = (v: number) => PAD.top + ((10 - v) * plotH) / 9;
  const line = (pick: (d: Dance) => number) => dances.map((d, i) => `${x(i)},${y(pick(d))}`).join(" ");
  const starts = dances.flatMap((d, i) => (i === 0 || dances[i - 1].ep !== d.ep ? [{ ep: d.ep, i }] : []));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Your paddle and the judges' average across ${dances.length} dances`}
      className="w-full text-neutral-400"
    >
      {[2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.2} />
          <text x={PAD.left - 4} y={y(v)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
            {v}
          </text>
        </g>
      ))}
      {starts.map(({ ep, i }) => (
        <text key={ep} x={x(i)} y={H - 6} fontSize={9} fill="currentColor" textAnchor={i === 0 ? "start" : "middle"}>
          {label(ep).replace("Week ", "W").replace(", night ", "/")}
        </text>
      ))}
      <polyline points={line((d) => d.panelMean)} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <g className="text-amber-300">
        <polyline points={line((d) => d.paddle)} fill="none" stroke="currentColor" strokeWidth={2} />
        {dances.map((d, i) => (
          <circle key={`${d.ep}-${d.key}`} cx={x(i)} cy={y(d.paddle)} r={2.5} fill="currentColor">
            <title>{`${label(d.ep)}: you ${d.paddle}, judges ${formatScore(d.panelMean)}`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}
