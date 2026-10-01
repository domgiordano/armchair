import { request, requestWithMeta } from "./client";

export interface SeasonEntry {
  id: string;
  number: number;
  year: number;
  current: boolean;
}

export interface Snapshot {
  season: SeasonEntry;
  /** Dances scored this season. */
  count: number;
  /** Average points off the judges' panel; null until there is something to compare. */
  mae: number | null;
  rank: number | null;
  ranked: number;
  minDances: number;
}

interface Stats {
  mine: { count: number; mae: number | null };
}

/** Your Dancing with the Stars season at a glance: the current season's stats and global rank. */
export async function getSnapshot(): Promise<Snapshot | null> {
  const { seasons } = await request<{ seasons: SeasonEntry[] }>("/seasons/list?show=dwts");
  const season = seasons.find((s) => s.current) ?? seasons[0];
  if (!season) return null;
  const query = (extra: string) => `season=${encodeURIComponent(season.id)}${extra}`;
  const [stats, board] = await Promise.all([
    request<Stats>(`/stats/get?${query("")}`),
    getBoard(season.id, "global"),
  ]);
  return {
    season,
    count: stats.mine.count,
    mae: stats.mine.mae,
    rank: board.me.rank,
    ranked: board.total,
    minDances: board.minDances,
  };
}

export const listSeasons = async () =>
  (await request<{ seasons: SeasonEntry[] }>("/seasons/list?show=dwts")).seasons;

/** The season the app is on: the current one, or the newest. */
export const currentSeason = (seasons: SeasonEntry[]) => seasons.find((s) => s.current) ?? seasons[0] ?? null;

export interface Accuracy {
  count: number;
  mae: number | null;
  judges: Record<string, { count: number; mae: number }>;
}

export interface SeasonStats {
  season: string;
  mine: Accuracy;
  episodes: (Accuracy & { ep: number })[];
}

export const getSeasonStats = (season: string) =>
  request<SeasonStats>(`/stats/get?season=${encodeURIComponent(season)}`);

export const getJudges = async (season: string) =>
  (await request<{ judges: { id: string; name: string }[] }>(`/seasons/get?season=${encodeURIComponent(season)}`))
    .judges;

export type Scope = "global" | "friends";

/** `season=all` is all-time across DWTS seasons. */
export const ALL_TIME = "all";

export interface Standing {
  sub: string;
  name: string | null;
  picture: string | null;
  count: number;
  mae: number | null;
}

export interface Board {
  minDances: number;
  ranked: (Standing & { rank: number; mae: number })[];
  unranked: Standing[];
  me: Standing & { rank: number | null };
}

export async function getBoard(season: string, scope: Scope): Promise<Board & { total: number }> {
  const { data, meta } = await requestWithMeta<Board>(
    `/leaderboard/get?season=${encodeURIComponent(season)}&scope=${scope}`,
  );
  // `ranked` stops at 100; meta counts everyone.
  return { ...data, total: typeof meta?.ranked === "number" ? meta.ranked : data.ranked.length };
}
