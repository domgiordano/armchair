import type { Elimination } from "@/lib/api/couples";
import { getOverview, type OverviewEpisode } from "@/lib/api/overview";
import { getEpisodeState, type EpisodeState, type Member, type Season } from "@/lib/api/show";
import { currentSeals } from "@/lib/show/sealed";
import type { OddsEntry } from "@armchair/app-core/favorites/odds";

/*
 * The Couples leaderboard: every couple ranked over the weeks the viewer has
 * fully revealed. A week counts only once each of its episodes, and every
 * episode before it, is complete (gate.results_open) with nothing sealed on
 * this device, so the board never runs ahead of what the viewer has seen.
 * favorites_get holds its odds back the same way.
 */

/** One couple's dance with a confirmed panel. Team dances are left out, as overview_get leaves them. */
export interface Dance {
  couple: string;
  ep: number;
  week: number;
  style: string | null;
  /** The panel's mean. */
  score: number;
  perfect: boolean;
  /** Other users' paddles, as the gate shows them. */
  others: { sub: string; value: number }[];
}

export interface WeekScore {
  week: number;
  score: number;
}

export interface BoardCouple {
  id: string;
  members: Member[];
  /** Null for a couple without a number to rank by, or out of the competition. */
  rank: number | null;
  /** Places gained since the week before: positive is a climb. */
  move: number | null;
  average: number | null;
  /** The panel's mean for the board's week, null if they didn't dance it. */
  last: number | null;
  lastStyles: string[];
  best: number | null;
  /** Other users' mean over the couple's dances, null under two raters. */
  crowd: number | null;
  /** Crowd minus judges: positive when our users liked them more. */
  delta: number | null;
  /** The board week's score against the week they danced before it. */
  trend: number | null;
  dances: number;
  perfect: number;
  weeks: WeekScore[];
  eliminated: Elimination | null;
  /** favorites_get's entry for the board's week; null for a couple out by then, or before odds exist. */
  odds: Odds | null;
}

export type Odds = Pick<OddsEntry<unknown>, "odds" | "chance" | "move">;

export type BoardSort = "odds" | "average" | "last" | "best" | "crowd" | "delta" | "trend" | "dances" | "perfect";

export const BOARD_SORTS: { value: BoardSort; label: string }[] = [
  { value: "average", label: "Judges' average" },
  { value: "odds", label: "Odds to win" },
  { value: "last", label: "This week's score" },
  { value: "best", label: "Best score" },
  { value: "crowd", label: "Crowd average" },
  { value: "delta", label: "Crowd vs judges" },
  { value: "trend", label: "Trend" },
  { value: "dances", label: "Dances" },
  { value: "perfect", label: "Perfect scores" },
];

const VALUE: Record<BoardSort, (c: BoardCouple) => number | null> = {
  odds: (c) => c.odds?.chance ?? null,
  average: (c) => c.average,
  last: (c) => c.last,
  best: (c) => c.best,
  crowd: (c) => c.crowd,
  delta: (c) => c.delta,
  trend: (c) => c.trend,
  // A couple yet to dance has nothing to rank, not zero.
  dances: (c) => c.dances || null,
  perfect: (c) => (c.dances ? c.perfect : null),
};

// One other person's "average" is just their paddle (common/couples.py MIN_RATERS).
const MIN_RATERS = 2;

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export const weekOf = (e: { ep: number; week: number | null }) => e.week ?? e.ep;

export const celebrityName = (members: Member[]) => (members.find((m) => m.role === "celebrity") ?? members[0])?.name ?? "";

/**
 * The last week the viewer has revealed: every aired episode up to and
 * including it complete and unsealed. Null before they've finished week one.
 */
export function revealedThrough(episodes: OverviewEpisode[], sealed: (ep: number) => boolean): number | null {
  const done = (e: OverviewEpisode) => e.aired && e.complete === true && !sealed(e.ep);
  let through: number | null = null;
  for (const week of [...new Set(episodes.map(weekOf))].sort((a, b) => a - b)) {
    const nights = episodes.filter((e) => weekOf(e) === week);
    if (!nights.every(done)) break;
    through = week;
  }
  return through;
}

/** The dances an episode's view opens, scored by a confirmed panel. */
export function dancesOf(state: EpisodeState): Dance[] {
  return state.performances.flatMap((card) => {
    if (card.locked || card.contestants.length !== 1 || card.judges.length === 0) return [];
    const values = card.judges.map((j) => (j.state === "confirmed" ? j.value : null));
    if (values.some((v) => v === null)) return [];
    const marks = values as number[];
    return [
      {
        couple: card.contestants[0],
        ep: state.ep,
        week: weekOf(state),
        style: card.style,
        score: round2(marks.reduce((a, b) => a + b, 0) / marks.length),
        perfect: marks.every((v) => v === 10),
        others: card.others,
      },
    ];
  });
}

interface Contestant {
  id: string;
  members: Member[];
}

/** Every couple's numbers over the dances of weeks up to `week`, unranked. */
function standings(
  roster: Contestant[],
  dances: Dance[],
  outs: Map<string, Elimination>,
  week: number,
  odds: Map<string, Odds>,
): BoardCouple[] {
  return roster.map((c) => {
    const mine = dances.filter((d) => d.couple === c.id && d.week <= week);
    const byWeek = new Map<number, Dance[]>();
    for (const d of mine) byWeek.set(d.week, [...(byWeek.get(d.week) ?? []), d]);
    const weeks = [...byWeek]
      .sort(([a], [b]) => a - b)
      .map(([w, ds]) => ({ week: w, score: mean(ds.map((d) => d.score)) as number }));
    const latest = weeks.at(-1);
    const last = latest?.week === week ? latest.score : null;
    const before = weeks.at(-2);
    const average = mean(mine.map((d) => d.score));
    const others = mine.flatMap((d) => d.others);
    const crowd = new Set(others.map((o) => o.sub)).size >= MIN_RATERS ? mean(others.map((o) => o.value)) : null;
    const out = outs.get(c.id);
    return {
      id: c.id,
      members: c.members,
      rank: null,
      move: null,
      average,
      last,
      lastStyles: last === null ? [] : (byWeek.get(week) ?? []).map((d) => d.style ?? "Dance"),
      best: mine.length ? Math.max(...mine.map((d) => d.score)) : null,
      crowd,
      delta: crowd !== null && average !== null ? round2(crowd - average) : null,
      trend: last !== null && before ? round2(last - before.score) : null,
      dances: mine.length,
      perfect: mine.filter((d) => d.perfect).length,
      weeks,
      eliminated: out && (out.week ?? out.ep) <= week ? out : null,
      odds: odds.get(c.id) ?? null,
    };
  });
}

/** Highest first; ties share a place and the next one skips, as week_board_get ranks. */
function ranked(couples: BoardCouple[], by: BoardSort): Map<string, number> {
  const value = VALUE[by];
  const live = couples.filter((c) => !c.eliminated && value(c) !== null);
  return new Map(live.map((c) => [c.id, 1 + live.filter((o) => (value(o) as number) > (value(c) as number)).length]));
}

export interface BoardOptions {
  roster: Contestant[];
  dances: Dance[];
  outs: Map<string, Elimination>;
  week: number;
  by: BoardSort;
  showOut: boolean;
  /** The odds board for `week`, by couple. */
  odds?: Map<string, Odds>;
}

/**
 * The board as of `week`: couples still dancing in place order, then those
 * with nothing to rank by, by name; then, when `showOut`, the eliminated,
 * most recently out first. `move` compares each place with the same sort a
 * week earlier.
 */
export function board({ roster, dances, outs, week, by, showOut, odds = new Map() }: BoardOptions): BoardCouple[] {
  const now = standings(roster, dances, outs, week, odds);
  const places = ranked(now, by);
  // The odds board carries its own movement; there's no other week's odds in hand to rank.
  const before = week > 1 && by !== "odds" ? ranked(standings(roster, dances, outs, week - 1, odds), by) : new Map<string, number>();
  const rows = now.map((c) => {
    const rank = places.get(c.id) ?? null;
    const then = before.get(c.id);
    const move = by === "odds" ? (c.odds?.move?.rank ?? null) : rank !== null && then !== undefined ? then - rank : null;
    return { ...c, rank, move };
  });
  const name = (a: BoardCouple, b: BoardCouple) => celebrityName(a.members).localeCompare(celebrityName(b.members));
  const tiebreak = (a: BoardCouple, b: BoardCouple) => (b.average ?? -1) - (a.average ?? -1) || name(a, b);
  const dancing = rows
    .filter((c) => !c.eliminated)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.rank === null ? name(a, b) : tiebreak(a, b)));
  if (!showOut) return dancing;
  const out = rows
    .filter((c) => c.eliminated)
    .sort((a, b) => (b.eliminated?.ep ?? 0) - (a.eliminated?.ep ?? 0) || name(a, b));
  return [...dancing, ...out];
}

export const sortValue = (c: BoardCouple, by: BoardSort) => VALUE[by](c);

export interface Highlights {
  podium: BoardCouple[];
  climber: BoardCouple | null;
  faller: BoardCouple | null;
  top: Dance | null;
}

/** The header strip: the judges' top three, the biggest moves since last week, and the season's best dance so far. */
export function highlights(opts: Omit<BoardOptions, "by" | "showOut">): Highlights {
  const rows = board({ ...opts, by: "average", showOut: false }).filter((c) => c.rank !== null);
  const moved = rows.filter((c) => c.move !== null && c.move !== 0);
  const most = (sign: 1 | -1) =>
    moved.filter((c) => Math.sign(c.move as number) === sign).sort((a, b) => sign * ((b.move as number) - (a.move as number)))[0] ??
    null;
  const seen = opts.dances.filter((d) => d.week <= opts.week);
  const top = seen.reduce<Dance | null>((best, d) => (best === null || d.score > best.score ? d : best), null);
  return { podium: rows.slice(0, 3), climber: most(1), faller: most(-1), top };
}

export interface BoardWeek {
  week: number;
  theme: string | null;
  /** The week's last episode: the odds snapshot that goes with the board as of this week. */
  lastEp: number;
}

export interface BoardData {
  /** The last week the board may show; null before the viewer has finished week one. */
  through: number | null;
  weeks: BoardWeek[];
  dances: Dance[];
  outs: Map<string, Elimination>;
  /** The first aired episode holding the board back, to finish or reveal. */
  next: { ep: number; week: number; sealed: boolean } | null;
}

/** The board's data: the overview for what's revealed, then each revealed episode's view. */
export async function loadBoard(season: Season): Promise<BoardData> {
  const overview = await getOverview(season.season);
  const seals = currentSeals();
  const sealed = (ep: number) => seals.episode(season.season, ep);
  const through = revealedThrough(overview.episodes, sealed);
  const shown = through === null ? [] : overview.episodes.filter((e) => weekOf(e) <= through);
  const states = await Promise.all(shown.map((e) => getEpisodeState(season.season, e.ep)));
  const outs = new Map<string, Elimination>();
  for (const s of states) for (const id of s.eliminated ?? []) outs.set(id, { ep: s.ep, week: s.week });
  const weeks = new Map<number, BoardWeek>();
  for (const e of shown) {
    const w = weekOf(e);
    weeks.set(w, { week: w, theme: weeks.get(w)?.theme ?? e.theme, lastEp: Math.max(e.ep, weeks.get(w)?.lastEp ?? 0) });
  }
  const held = overview.episodes.find((e) => e.aired && weekOf(e) > (through ?? 0) && (e.complete !== true || sealed(e.ep)));
  return {
    through,
    weeks: [...weeks.values()],
    dances: states.flatMap(dancesOf),
    outs,
    next: held ? { ep: held.ep, week: weekOf(held), sealed: held.complete === true } : null,
  };
}
