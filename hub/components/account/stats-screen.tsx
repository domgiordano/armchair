"use client";

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";

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
import {
  currentSeasons,
  EDITION_NAMES,
  getRanks,
  getTraitorsStats,
  type Edition,
  type EventKind,
  type Ranks,
  type TraitorsSeason,
  type TraitorsStats,
} from "@/lib/api/traitors";
import { dwtsLink, traitorsLink } from "@/lib/links";
import { useLoad } from "@/lib/load";

import { SignedInPage } from "./hub-shell";
import { EDITIONS, ShowSwitch, type HubShow } from "./show-switch";
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
  const [show, setShow] = useState<HubShow>("dwts");
  return (
    <SignedInPage eyebrow="Your stats" pitch="Sign in to see how close you score to the judges.">
      <header className="rise" style={step(0)}>
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Stats</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          How close you <span className="text-brand-gradient">call it.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          {show === "dwts"
            ? "Accuracy is the average gap between your paddle and the judges’ average. Lower is closer."
            : "Points for every call that lands: the round table’s top 3, the night’s murder and recruit, and your winners."}
        </p>
      </header>
      <ShowSwitch value={show} onChange={setShow} />
      {show === "dwts" ? <StatsBody /> : <TraitorsStatsBody key={show} editions={EDITIONS[show]} />}
    </SignedInPage>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" className="mt-8 grid gap-6 lg:grid-cols-2">
      <span className="sr-only">Loading your stats...</span>
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl lg:col-span-2" />
    </div>
  );
}

function StatsBody() {
  const [load, retry] = useLoad(loadStats);

  if (load.kind === "loading") return <StatsSkeleton />;
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
          id="show"
          title="Dancing with the Stars"
          subtitle={`Season ${season.number} · ${season.year}`}
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

// Each show's card borrows its app tile's colours, as on the dashboard.
const THEMES = {
  dwts: {
    surface: "border-[#2b3a7a] from-[#16245e] to-[#060b26] text-[#f3e6c0]",
    glow: "bg-[radial-gradient(closest-side,rgb(255_201_60/0.22),transparent)]",
    sub: "text-[#f3e6c0]/75",
  },
  traitors: {
    surface: "border-[#1c3a2a] from-[#0b2418] to-[#040d08] text-[#e9dcc0]",
    glow: "bg-[radial-gradient(closest-side,rgb(255_140_60/0.18),transparent)]",
    sub: "text-[#e9dcc0]/75",
  },
};

interface ShowCardProps {
  id: string;
  title: string;
  subtitle: string;
  stats: FigureProps[];
  theme?: keyof typeof THEMES;
  index?: number;
}

function ShowCard({ id, title, subtitle, stats, theme = "dwts", index = 1 }: ShowCardProps) {
  const t = THEMES[theme];
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`rise relative overflow-hidden rounded-3xl border bg-linear-to-br p-5 sm:p-6 ${t.surface}`}
      style={step(index)}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -top-16 -right-10 size-56 rounded-full ${t.glow}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-gold">THIS SEASON</p>
          <h2 id={`${id}-title`} className="mt-1 text-xl font-bold tracking-tight">
            {title}
          </h2>
          <p className={`text-sm ${t.sub}`}>{subtitle}</p>
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

interface TraitorsSeasonData {
  season: TraitorsSeason;
  stats: TraitorsStats;
  ranks: Ranks & { total: number };
}

async function loadTraitorsStats(editions: Edition[]): Promise<TraitorsSeasonData[]> {
  const seasons = await currentSeasons(editions);
  return Promise.all(
    seasons.map(async (season) => {
      const [stats, ranks] = await Promise.all([
        getTraitorsStats(season.id),
        getRanks(season.id, season.show, "global"),
      ]);
      return { season, stats, ranks };
    }),
  );
}

function TraitorsStatsBody({ editions }: { editions: Edition[] }) {
  const fetcher = useCallback(() => loadTraitorsStats(editions), [editions]);
  const [load, retry] = useLoad(fetcher);

  if (load.kind === "loading") return <StatsSkeleton />;
  if (load.kind === "error") {
    return (
      <div className="mt-8 max-w-md">
        <ErrorNote what="your stats" message={load.message} retry={retry} />
      </div>
    );
  }
  if (load.value.length === 0) {
    return (
      <div className="mt-8">
        <Empty>No season is on right now. Stats start with your first pick.</Empty>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col gap-10">
      {load.value.map((data, i) => (
        <TraitorsSeasonStats key={data.season.id} {...data} index={i * 3 + 1} />
      ))}
      <a href={traitorsLink()} className={`${QUIET} -ml-3 self-start`}>
        Every pick in The Traitors app
      </a>
    </div>
  );
}

const EVENTS: { kind: EventKind; label: string }[] = [
  { kind: "RT", label: "Round table" },
  { kind: "MURDER", label: "Murder" },
  { kind: "RECRUIT", label: "Recruit" },
];

function TraitorsSeasonStats({ season, stats, ranks, index }: TraitorsSeasonData & { index: number }) {
  const started = stats.events > 0 || stats.points > 0;
  const tables = stats.byEvent.RT.scored;
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <ShowCard
        id={season.id}
        theme="traitors"
        index={index}
        title={`The Traitors ${EDITION_NAMES[season.show]}`}
        subtitle={`Season ${season.number} · ${season.year}`}
        stats={[
          { label: "Points", value: String(stats.points), note: started ? `over ${stats.events} calls` : "Make a pick to start" },
          {
            label: "Season rank",
            value: started ? `#${ranks.me.rank}` : "--",
            note: started ? `of ${ranks.total}` : "Ranks after your first call",
          },
          { label: "Banishments", value: String(stats.banishHits), note: `called in ${tables} round ${tables === 1 ? "table" : "tables"}` },
          {
            label: "Winner bet",
            value: stats.winnerPoints === null ? "--" : String(stats.winnerPoints),
            note: stats.winnerPoints === null ? "Settles at the finale" : "points",
          },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Panel id={`${season.id}-events`} title="Call by call" index={index + 1}>
          <EventBars byEvent={stats.byEvent} />
        </Panel>
        <Panel id={`${season.id}-episodes`} title="Your episodes" index={index + 2}>
          <PointsChart episodes={stats.byEpisode} />
        </Panel>
      </div>
    </div>
  );
}

function EventBars({ byEvent }: { byEvent: TraitorsStats["byEvent"] }) {
  const rows = EVENTS.map((e) => ({ ...e, ...byEvent[e.kind] }));
  if (rows.every((r) => r.scored === 0)) {
    return <Empty>Your calls show up here once a round table is confirmed.</Empty>;
  }
  return (
    <Chart
      caption="How often each kind of call landed, and the points it earned."
      table={{
        head: ["Call", "Result"],
        rows: rows.map((r) => [r.label, `${r.hits} of ${r.scored} right, ${r.points} points`]),
      }}
    >
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.kind} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-text">{r.label}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {r.hits} of {r.scored} &middot; {r.points} pts
              </span>
            </div>
            <span className="block h-2 overflow-hidden rounded-full bg-line/70">
              <span
                className="grow-x block h-full rounded-full bg-linear-to-r from-orange to-gold"
                style={{ width: `${r.scored ? Math.max(3, (r.hits / r.scored) * 100) : 0}%`, "--d": `${i * 80}ms` } as CSSProperties}
              />
            </span>
          </li>
        ))}
      </ul>
    </Chart>
  );
}

function PointsChart({ episodes }: { episodes: TraitorsStats["byEpisode"] }) {
  // Episodes still to come list at zero; stop at the last one that scored.
  const last = episodes.findLastIndex((e) => e.points > 0);
  const shown = episodes.slice(0, last + 1);
  if (shown.length === 0) return <Empty>Make your picks and your points show up here, episode by episode.</Empty>;

  const top = Math.max(...shown.map((e) => e.points));
  return (
    <Chart
      caption="Points per episode. Your best is in gold."
      table={{ head: ["Episode", "Points"], rows: shown.map((e) => [`Episode ${e.ep}`, `${e.points} points`]) }}
    >
      <ol className="flex h-44 items-stretch gap-1.5 border-b border-muted/40 sm:gap-2">
        {shown.map((e, i) => (
          <li key={e.ep} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] leading-none font-semibold text-text tabular-nums">{e.points}</span>
            <span
              className={`grow-y w-full max-w-9 rounded-t-md ${e.points === top ? "bg-gold" : "bg-linear-to-t from-violet to-magenta"}`}
              style={{ height: `${Math.max(3, (e.points / top) * 100)}%`, "--d": `${i * 60}ms` } as CSSProperties}
            />
          </li>
        ))}
      </ol>
      <ol aria-hidden="true" className="mt-1.5 flex gap-1.5 sm:gap-2">
        {shown.map((e) => (
          <li key={e.ep} className="min-w-0 flex-1 text-center text-[10px] text-muted">
            E{e.ep}
          </li>
        ))}
      </ol>
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
