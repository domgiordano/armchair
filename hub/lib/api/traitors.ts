import { ApiError, request, requestWithMeta, type AvatarKind } from "./client";
import type { Scope, SeasonEntry } from "./dwts";

/** Each edition is its own show in the catalog: US, UK, and Celebrity UK. */
export type Edition = "tus" | "tuk" | "tukc";

export const EDITION_NAMES: Record<Edition, string> = { tus: "US", tuk: "UK", tukc: "Celebrity UK" };

export type TraitorsSeason = SeasonEntry & { show: Edition };

export const seasonLabel = (s: TraitorsSeason) => `${EDITION_NAMES[s.show]} · Season ${s.number}`;

/** The current seasons of these editions, in the order given. */
export async function currentSeasons(editions: Edition[]): Promise<TraitorsSeason[]> {
  const lists = await Promise.all(
    editions.map((show) => request<{ seasons: SeasonEntry[] }>(`/seasons/list?show=${show}`)),
  );
  return lists.flatMap(({ seasons }, i) => seasons.filter((s) => s.current).map((s) => ({ ...s, show: editions[i] })));
}

export type EventKind = "RT" | "MURDER" | "RECRUIT";

export interface TraitorsStats {
  season: string;
  points: number;
  events: number;
  banishHits: number;
  byEvent: Record<EventKind, { scored: number; hits: number; points: number }>;
  byEpisode: { ep: number; points: number }[];
  /** Null until the season's winners are known. */
  winnerPoints: number | null;
}

export const getTraitorsStats = (season: string) =>
  request<TraitorsStats>(`/traitors/stats?season=${encodeURIComponent(season)}`);

export interface Ranking {
  rank: number;
  sub: string;
  name: string | null;
  picture: string | null;
  avatarKind: AvatarKind;
  points: number;
  events: number;
  banishHits: number;
  average: number | null;
}

export interface Ranks {
  season: string;
  scope: Scope;
  ranked: Ranking[];
  /** Always present: the caller has a rank even before their first pick. */
  me: Ranking;
}

/** `season` is a season id, or `all` for every season of `show`. */
export async function getRanks(season: string, show: Edition, scope: Scope): Promise<Ranks & { total: number }> {
  const query = new URLSearchParams({ season, show, scope });
  const { data, meta } = await requestWithMeta<Ranks>(`/traitors/ranks?${query}`);
  // `ranked` stops at 100; meta counts everyone.
  return { ...data, total: typeof meta?.ranked === "number" ? meta.ranked : data.ranked.length };
}

/** Points in each current season. A season the API won't show (403, 404) is left out. */
export async function getCurrentPoints(): Promise<{ season: TraitorsSeason; points: number; events: number }[]> {
  const seasons = await currentSeasons(["tus", "tuk", "tukc"]);
  const rows = await Promise.all(
    seasons.map(async (season) => {
      try {
        const { points, events } = await getTraitorsStats(season.id);
        return { season, points, events };
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
        throw e;
      }
    }),
  );
  return rows.filter((r) => r !== null);
}
