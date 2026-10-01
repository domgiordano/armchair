"use client";

import { useEffect, useState, type ReactNode } from "react";

import { LoadError } from "@/components/load-error";
import { BarList, Histogram, Legend, TrendChart } from "@/components/stats-charts";
import { GroupPicker } from "@/components/group-picker";
import { formatScore } from "@/components/performance-card";
import { SignedIn } from "@/components/signed-in";
import type { Season } from "@/lib/api/show";
import { getStats, type Dance, type Stats } from "@/lib/api/stats";
import { useGroupFilter } from "@/lib/show/group-filter";
import { episodeLabel } from "@/lib/show/schedule";
import { useSeason } from "@/lib/show/use-season";
import { byStyle, distribution, extremes, type Bar } from "@/lib/show/stats-summary";

type StatsLoad = { kind: "loading" } | { kind: "ready"; stats: Stats } | { kind: "error"; message: string };

export function StatsScreen() {
  return (
    <SignedIn title="Accuracy" wide>
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
  const filter = useGroupFilter();
  return (
    <>
      <div className="md:max-w-md">
        <GroupPicker {...filter} />
      </div>
      <StatsFetcher season={season} group={filter.group} />
    </>
  );
}

function StatsFetcher({ season, group }: { season: Season; group: string | null }) {
  const [load, setLoad] = useState<StatsLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStats(season.season, group).then(
      (stats) => !cancelled && setLoad({ kind: "ready", stats }),
      (e: unknown) =>
        !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season.season, group, attempt]);

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

  const judges: Bar[] = Object.entries(mine.judges)
    .map(([id, j]) => ({ label: judgeName(id), value: j.mae, count: j.count }))
    .sort((a, b) => a.value - b.value);
  const rank = stats.others.filter((o) => o.mae < (mine.mae ?? 0)).length + 1;
  const short = (ep: number) => label(ep).replace("Week ", "W").replace(", night ", "/");
  // A team dance's key names every member couple: "a+b+c#1".
  const celebrity = (key: string) =>
    key
      .slice(0, key.lastIndexOf("#"))
      .split("+")
      .map((id) => season.contestants.find((x) => x.id === id)?.members.find((m) => m.role === "celebrity")?.name ?? id)
      .join(", ");
  const { closest, furthest } = extremes(stats.dances);

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

      {/* Columns, not a grid: the cards differ in height and a grid row would pad the short ones. */}
      <div className="gap-4 lg:columns-2 xl:columns-3 [&>section]:mb-4 [&>section]:break-inside-avoid">
        <Card id="trend" title="Your season" note="Points off per episode. Lower is closer.">
          <TrendChart points={stats.episodes.map((e) => ({ label: short(e.ep), mae: e.mae ?? 0 }))} />
        </Card>

        {judges.length > 0 && (
          <Card id="per-judge" title={`Closest to ${judges[0].label}`} note="Points off each judge, and dances counted.">
            <BarList bars={judges} label="By judge" />
          </Card>
        )}

        <Card id="by-style" title="By dance style" note="Points off the judges' average, and dances counted.">
          <BarList bars={byStyle(stats.dances)} label="By dance style" />
        </Card>

        <Card id="distribution" title="How you score" note="Share of your paddles and the judges' scores at each value.">
          <Histogram bins={distribution(stats.dances)} />
          <Legend
            items={[
              { label: "You", swatch: "bg-gold" },
              { label: "Judges", swatch: "bg-silver-dim" },
            ]}
          />
        </Card>

        <Card id="progression" title="You vs the judges, dance by dance">
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
        </Card>

        <Card id="calls" title="Best calls and biggest misses">
          <Calls title="Best calls" dances={closest} celebrity={celebrity} short={short} />
          {furthest.length > 0 && <Calls title="Biggest misses" dances={furthest} celebrity={celebrity} short={short} />}
        </Card>
      </div>
    </>
  );
}

function Card({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-ballroom/40 p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {note && <p className="text-xs text-neutral-400">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Calls({
  title,
  dances,
  celebrity,
  short,
}: {
  title: string;
  dances: Dance[];
  celebrity: (key: string) => string;
  short: (ep: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{title}</h3>
      <ul aria-label={title} className="flex flex-col divide-y divide-neutral-800 text-sm">
        {dances.map((d) => (
          <li key={`${d.ep}-${d.key}`} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{celebrity(d.key)}</span>
              <span className="truncate text-xs text-neutral-400">
                {short(d.ep)}
                {d.style && ` · ${d.style}`}
              </span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block">
                You {d.paddle} · judges {formatScore(d.panelMean)}
              </span>
              <span className="block text-xs text-neutral-400">{off(d.error)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
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
