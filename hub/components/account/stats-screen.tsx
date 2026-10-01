"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  ALL_TIME,
  currentSeason,
  getBoard,
  getJudges,
  getSeasonStats,
  listSeasons,
  type Board,
  type SeasonEntry,
  type SeasonStats,
} from "@/lib/api/dwts";
import { dwtsLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { SignedInPage } from "./hub-shell";
import { Empty, ErrorNote, Panel, QUIET, Skeleton, step } from "./ui";

interface StatsData {
  season: SeasonEntry;
  stats: SeasonStats;
  judges: Map<string, string>;
  seasonBoard: Board & { total: number };
  allTime: Board & { total: number };
}

async function loadStats(): Promise<StatsData | null> {
  const season = currentSeason(await listSeasons());
  if (!season) return null;
  const [stats, judges, seasonBoard, allTime] = await Promise.all([
    getSeasonStats(season.id),
    getJudges(season.id),
    getBoard(season.id, "global"),
    getBoard(ALL_TIME, "global"),
  ]);
  return { season, stats, judges: new Map(judges.map((j) => [j.id, j.name])), seasonBoard, allTime };
}

const gap = (mae: number | null) => (mae === null ? "--" : mae.toFixed(2));

const rankNote = (board: Board & { total: number }) => {
  if (board.me.rank !== null) return `of ${board.total}`;
  const left = Math.max(0, board.minDances - board.me.count);
  return `${left} more ${left === 1 ? "dance" : "dances"} to rank`;
};

export function StatsScreen() {
  return (
    <SignedInPage eyebrow="Your stats" pitch="Sign in to see how close you score to the judges.">
      <header className="rise" style={step(0)}>
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Stats</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          How close you <span className="text-brand-gradient">call it.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Accuracy is the average gap between your paddle and the judges&rsquo; average. Lower is closer.
        </p>
      </header>
      <StatsBody />
    </SignedInPage>
  );
}

function StatsBody() {
  const [load, retry] = useLoad(loadStats);

  if (load.kind === "loading") {
    return (
      <div role="status" className="mt-8 grid gap-6 lg:grid-cols-2">
        <span className="sr-only">Loading your stats...</span>
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl lg:col-span-2" />
      </div>
    );
  }
  if (load.kind === "error") {
    return (
      <div className="mt-8 max-w-md">
        <ErrorNote what="your stats" message={load.message} retry={retry} />
      </div>
    );
  }
  if (!load.value) {
    return (
      <div className="mt-8">
        <Empty>No season is open yet. Stats start with the first episode you score.</Empty>
      </div>
    );
  }

  const { season, stats, judges, seasonBoard, allTime } = load.value;
  const closest = Object.entries(stats.mine.judges).sort(([, a], [, b]) => a.mae - b.mae)[0];

  return (
    <div className="mt-8 flex flex-col gap-6 lg:gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
        <ShowCard
          season={season}
          stats={[
            { label: "Dances scored", value: String(stats.mine.count) },
            { label: "Accuracy", value: gap(stats.mine.mae), note: stats.mine.mae === null ? "Score a dance to start" : "points off" },
            { label: "Season rank", value: seasonBoard.me.rank === null ? "--" : `#${seasonBoard.me.rank}`, note: rankNote(seasonBoard) },
            {
              label: "Closest judge",
              value: closest ? (judges.get(closest[0]) ?? closest[0]).split(" ")[0] : "--",
              note: closest ? `${closest[1].mae.toFixed(2)} off` : "Shows once you score",
            },
          ]}
        />
        <Panel id="all-time" title="All-time" index={2}>
          <dl className="grid grid-cols-3 gap-3">
            <Figure label="Dances" value={String(allTime.me.count)} />
            <Figure label="Accuracy" value={gap(allTime.me.mae)} note="points off" />
            <Figure
              label="Rank"
              value={allTime.me.rank === null ? "--" : `#${allTime.me.rank}`}
              note={rankNote(allTime)}
            />
          </dl>
          <p className="text-xs leading-relaxed text-muted">Every Dancing with the Stars season you&rsquo;ve scored, together.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Panel id="weeks" title="Your episodes" index={3}>
          <EpisodeChart episodes={stats.episodes} />
        </Panel>
        <Panel id="judges" title="Judge by judge" index={4}>
          <JudgeBars judges={judges} mine={stats.mine.judges} />
        </Panel>
      </div>

      <a href={dwtsLink("/stats/")} className={`${QUIET} -ml-3 self-start`}>
        Every chart in the Dancing with the Stars app
      </a>
    </div>
  );
}

interface FigureProps {
  label: string;
  value: string;
  note?: string;
}

function Figure({ label, value, note }: FigureProps) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="order-2 text-[11px] leading-tight font-medium tracking-wide text-muted">{label}</dt>
      <dd className="order-1 truncate text-2xl font-extrabold tracking-tight text-text tabular-nums sm:text-3xl">{value}</dd>
      {note && <dd className="order-3 mt-0.5 text-[11px] leading-tight text-muted/80">{note}</dd>}
    </div>
  );
}

function ShowCard({ season, stats }: { season: SeasonEntry; stats: FigureProps[] }) {
  return (
    <section
      aria-labelledby="show-title"
      className="rise relative overflow-hidden rounded-3xl border border-[#2b3a7a] bg-linear-to-br from-[#16245e] to-[#060b26] p-5 text-[#f3e6c0] sm:p-6"
      style={step(1)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_201_60/0.22),transparent)]"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-gold">THIS SEASON</p>
          <h2 id="show-title" className="mt-1 text-xl font-bold tracking-tight">
            Dancing with the Stars
          </h2>
          <p className="text-sm text-[#f3e6c0]/75">
            Season {season.number} &middot; {season.year}
          </p>
        </div>
      </div>
      <dl className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {stats.map((s) => (
          <Figure key={s.label} {...s} />
        ))}
      </dl>
    </section>
  );
}

function EpisodeChart({ episodes }: { episodes: SeasonStats["episodes"] }) {
  const scored = episodes.filter((e) => e.count > 0 && e.mae !== null);
  if (scored.length === 0) return <Empty>Score an episode and your gap to the judges shows up here, week by week.</Empty>;

  const gaps = scored.map((e) => e.mae as number);
  const top = Math.max(2, Math.ceil(Math.max(...gaps) * 1.2));
  const best = gaps.length > 1 ? Math.min(...gaps) : null;

  return (
    <Chart
      caption="Points off the judges' average, per episode. Shorter is closer."
      table={{ head: ["Episode", "Average gap"], rows: scored.map((e) => [`Episode ${e.ep}`, `${gap(e.mae)} off`]) }}
    >
      <ol className="flex h-44 items-stretch gap-1.5 border-b border-muted/40 sm:gap-2">
        {scored.map((e, i) => (
          <li key={e.ep} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] leading-none font-semibold text-text tabular-nums">{gap(e.mae)}</span>
            <span
              className={`grow-y w-full max-w-9 rounded-t-md ${
                e.mae === best ? "bg-gold" : "bg-linear-to-t from-violet to-magenta"
              }`}
              style={{ height: `${Math.max(3, ((e.mae as number) / top) * 100)}%`, "--d": `${i * 60}ms` } as CSSProperties}
            />
          </li>
        ))}
      </ol>
      <ol aria-hidden="true" className="mt-1.5 flex gap-1.5 sm:gap-2">
        {scored.map((e) => (
          <li key={e.ep} className="min-w-0 flex-1 text-center text-[10px] text-muted">
            E{e.ep}
          </li>
        ))}
      </ol>
      {best !== null && <p className="mt-3 text-xs text-muted">Your closest episode is in gold.</p>}
    </Chart>
  );
}

function JudgeBars({ judges, mine }: { judges: Map<string, string>; mine: SeasonStats["mine"]["judges"] }) {
  const rows = Object.entries(mine)
    .map(([id, j]) => ({ id, name: judges.get(id) ?? id, ...j }))
    .sort((a, b) => a.mae - b.mae);
  if (rows.length === 0) return <Empty>Once you score, this shows which judge you think most like.</Empty>;

  const top = Math.max(2, Math.max(...rows.map((r) => r.mae)) * 1.1);
  return (
    <Chart
      caption="Your average gap to each judge. The top bar is the judge you score most like."
      table={{ head: ["Judge", "Average gap"], rows: rows.map((r) => [r.name, `${r.mae.toFixed(2)} off over ${r.count}`]) }}
    >
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={`truncate font-medium ${i === 0 ? "text-gold" : "text-text"}`}>{r.name}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{r.mae.toFixed(2)} off</span>
            </div>
            <span className="block h-2 overflow-hidden rounded-full bg-line/70">
              <span
                className={`grow-x block h-full rounded-full ${i === 0 ? "bg-linear-to-r from-orange to-gold" : "bg-linear-to-r from-blue to-violet"}`}
                style={{ width: `${Math.max(3, (r.mae / top) * 100)}%`, "--d": `${i * 80}ms` } as CSSProperties}
              />
            </span>
          </li>
        ))}
      </ul>
    </Chart>
  );
}

interface ChartProps {
  caption: string;
  table: { head: [string, string]; rows: [string, string][] };
  children: ReactNode;
}

/** A drawn chart for sighted readers, the same numbers as a table for screen readers. */
function Chart({ caption, table, children }: ChartProps) {
  return (
    <figure className="flex flex-col">
      <div aria-hidden="true">{children}</div>
      <figcaption className="mt-3 text-xs leading-relaxed text-muted">{caption}</figcaption>
      {/* sr-only on the table itself doesn't clip: tables ignore width and overflow. */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([name, value]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
