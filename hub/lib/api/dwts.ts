import { request } from "./client";

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

interface Leaderboard {
  minDances: number;
  ranked: unknown[];
  me: { rank: number | null };
}

/** Your Dancing with the Stars season at a glance: the current season's stats and global rank. */
export async function getSnapshot(): Promise<Snapshot | null> {
  const { seasons } = await request<{ seasons: SeasonEntry[] }>("/seasons/list?show=dwts");
  const season = seasons.find((s) => s.current) ?? seasons[0];
  if (!season) return null;
  const query = (extra: string) => `season=${encodeURIComponent(season.id)}${extra}`;
  const [stats, board] = await Promise.all([
    request<Stats>(`/stats/get?${query("")}`),
    request<Leaderboard>(`/leaderboard/get?${query("&scope=global")}`),
  ]);
  return {
    season,
    count: stats.mine.count,
    mae: stats.mine.mae,
    rank: board.me.rank,
    ranked: board.ranked.length,
    minDances: board.minDances,
  };
}
