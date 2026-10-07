"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

import { PageLoader } from "@/components/disco-loader";
import { BarList, Histogram, Legend, TrendChart } from "@/components/stats-charts";
import { GroupPicker } from "@/components/group-picker";
import { CoupleLink, CoupleNames } from "@/components/couple-names";
import { OUT_FADE, OUT_STRIKE, ShowEliminated } from "@/components/eliminated";
import { formatScore } from "@/components/performance-card";
import { SignedIn } from "@/components/signed-in";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Elimination } from "@/lib/api/couples";
import type { Contestant, Season } from "@/lib/api/show";
import { getStats, type Dance, type Stats } from "@/lib/api/stats";
import { eliminatedWhen, useShowEliminated } from "@/lib/show/eliminated";
import { useGroupFilter } from "@/lib/show/group-filter";
import { episodeLabel } from "@/lib/show/schedule";
import { useSeason } from "@/lib/show/use-season";
import { byStyle, distribution, extremes, type Bar } from "@/lib/show/stats-summary";
import { button, cn } from "@/lib/ui";

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
  if (load.kind === "loading") return <PageLoader label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <StatsLoader season={load.season} />;
}

function StatsLoader({ season }: { season: Season }) {
  const filter = useGroupFilter();
  return (
    <>
      <PageHeader title="Your accuracy" />
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

  if (load.kind === "loading") return <StatsSkeleton label="Loading your stats" />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="your stats" message={load.message} retry={retry} />;
  }
  return <StatsView season={season} stats={load.stats} />;
}

const off = (mae: number) => `${formatScore(mae)} off`;

function StatsView({ season, stats }: { season: Season; stats: Stats }) {
  const { mine } = stats;
  const [showOut, setShowOut] = useShowEliminated("stats");
  const judgeName = (id: string) => {
    const j = season.judges.find((x) => x.id === id);
    return j ? `${j.name}${j.guest ? " (guest)" : ""}` : id;
  };
  const label = (ep: number) => {
    const e = season.episodes.find((x) => x.ep === ep);
    return e ? episodeLabel(e, season.episodes) : `Episode ${ep}`;
  };

  if (mine.mae === null) {
    return (
      <>
        <EmptyState
          title="Nothing to compare yet"
          action={
            <Link href="/episode/" className={button("primary", "sm")}>
              Score a dance
            </Link>
          }
        >
          Stats count dances you scored once every judge&apos;s score is confirmed.
        </EmptyState>
      </>
    );
  }

  const judges: Bar[] = Object.entries(mine.judges)
    .map(([id, j]) => ({ label: judgeName(id), value: j.mae, count: j.count }))
    .sort((a, b) => a.value - b.value);
  const rank = stats.others.filter((o) => o.mae < (mine.mae ?? 0)).length + 1;
  const short = (ep: number) => label(ep).replace("Week ", "W").replace(", night ", "/");
  const couple = (key: string) => season.contestants.find((x) => x.id === key.split("#")[0]);
  // A team dance's key names every member couple, "a+b+c#1", so no one couple matches it.
  const team = (key: string) =>
    key
      .slice(0, key.lastIndexOf("#"))
      .split("+")
      .map((id) => season.contestants.find((x) => x.id === id)?.members.find((m) => m.role === "celebrity")?.name ?? id)
      .join(", ");
  // A team dance's key names no one couple, so it never reads as eliminated.
  const out = (key: string): Elimination | undefined => (stats.eliminated ?? {})[key.slice(0, key.lastIndexOf("#"))];
  const gone = new Set(stats.dances.flatMap((d) => (out(d.key) ? [d.key.split("#")[0]] : []))).size;
  const { closest, furthest } = extremes(showOut ? stats.dances : stats.dances.filter((d) => !out(d.key)));

  return (
    <>
      <section
        aria-labelledby="overall"
        className="relative flex flex-col gap-1 overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-ballroom to-ink p-5"
      >
        <span
          aria-hidden="true"
          className="absolute -top-16 -right-10 size-48 rounded-full bg-[radial-gradient(circle,rgb(232_194_104/0.18),transparent_70%)]"
        />
        <h2 id="overall" className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          Against the judges&apos; average
        </h2>
        <p className="text-4xl font-semibold text-pearl tabular-nums">
          <CountUp value={mine.mae} format={off} />
        </p>
        <p className="text-sm text-silver-dim">
          Average gap per dance, over {mine.count} {mine.count === 1 ? "dance" : "dances"}.
          {stats.others.length > 0 && ` You rank ${rank} of ${stats.others.length + 1} on the dances you've scored.`}
        </p>
      </section>

      <ShowEliminated checked={showOut} onChange={setShowOut} count={gone} />

      {/* Columns, not a grid: the cards differ in height and a grid row would pad the short ones. */}
      <div className="stagger gap-4 lg:columns-2 xl:columns-3 [&>section]:mb-4 [&>section]:break-inside-avoid">
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
          <p className="flex gap-4 text-xs text-silver-dim">
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-gold" />
              You
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-current" />
              Judges&apos; average
            </span>
          </p>
        </Card>

        <Card id="calls" title="Best calls and biggest misses">
          {closest.length === 0 ? (
            <p className="text-sm text-silver-dim">Everyone you scored has gone home. Switch on Show eliminated to see them.</p>
          ) : (
            <Calls title="Best calls" season={season.season} dances={closest} couple={couple} team={team} short={short} out={out} />
          )}
          {furthest.length > 0 && (
            <Calls title="Biggest misses" season={season.season} dances={furthest} couple={couple} team={team} short={short} out={out} />
          )}
        </Card>
      </div>
    </>
  );
}

function Calls({
  title,
  season,
  dances,
  couple,
  team,
  short,
  out,
}: {
  title: string;
  season: string;
  dances: Dance[];
  couple: (key: string) => Contestant | undefined;
  team: (key: string) => string;
  short: (ep: number) => string;
  out: (key: string) => Elimination | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-silver-dim uppercase">{title}</h3>
      <ul aria-label={title} className="flex flex-col divide-y divide-silver/10 text-sm">
        {dances.map((d) => {
          const c = couple(d.key);
          const gone = out(d.key);
          return (
            <li key={`${d.ep}-${d.key}`} className="flex items-center justify-between gap-3 py-2">
              {c && (
                <span className={cn("shrink-0", gone && OUT_FADE)}>
                  <CoupleLink members={c.members} season={season} size={32} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("truncate", gone ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")}>
                  {c ? <CoupleNames members={c.members} /> : team(d.key)}
                </span>
                <span className="truncate text-xs text-silver-dim">
                  {/* The stamp doesn't fit beside 32px faces in a three-column card, so the line says it, as on the roster. */}
                  {gone && <span className="font-semibold text-stamp">Out {eliminatedWhen(gone).toLowerCase()} · </span>}
                  {short(d.ep)}
                  {d.style && ` · ${d.style}`}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block">
                  You {d.paddle} · judges {formatScore(d.panelMean)}
                </span>
                <span className="block text-xs text-silver-dim">{off(d.error)}</span>
              </span>
            </li>
          );
        })}
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
      className="w-full text-silver-dim"
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
      <polyline points={line((d) => d.panelMean)} pathLength={1} fill="none" stroke="currentColor" strokeWidth={1.5} className="draw" />
      <g className="text-gold">
        <polyline
          points={line((d) => d.paddle)}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="draw"
          style={{ "--d": "250ms" } as CSSProperties}
        />
        {dances.map((d, i) => (
          <circle
            key={`${d.ep}-${d.key}`}
            cx={x(i)}
            cy={y(d.paddle)}
            r={2.5}
            fill="currentColor"
            className="pop"
            style={{ "--d": `${250 + (i / Math.max(1, dances.length - 1)) * 1100}ms` } as CSSProperties}
          >
            <title>{`${label(d.ep)}: you ${d.paddle}, judges ${formatScore(d.panelMean)}`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}

function StatsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}...</span>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
