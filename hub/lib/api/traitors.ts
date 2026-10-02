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

/** Until the caller bets on a current season, the API hides its schedule. */
type SeasonView =
  | { needsBet: true }
  | { needsBet: false; episodes: { ep: number; releaseAt: string }[] };

export const getTraitorsSeason = (season: string) =>
  request<SeasonView>(`/traitors/season?season=${encodeURIComponent(season)}`);

export interface SeasonCard {
  season: TraitorsSeason;
  points: number;
  /** Null until the caller has a scored call. */
  rank: number | null;
  total: number;
  needsBet: boolean;
  next: { ep: number; releaseAt: string } | null;
}

/** The dashboard's view of each current season. A season the API won't show (403, 404) is left out. */
export async function getSeasonCards(): Promise<SeasonCard[]> {
  const seasons = await currentSeasons(["tus", "tuk", "tukc"]);
  const cards = await Promise.all(
    seasons.map(async (season) => {
      try {
        const [view, stats, ranks] = await Promise.all([
          getTraitorsSeason(season.id),
          getTraitorsStats(season.id),
          getRanks(season.id, season.show, "global"),
        ]);
        const now = Date.now();
        const next = view.needsBet ? undefined : view.episodes.find((e) => Date.parse(e.releaseAt) > now);
        return {
          season,
          points: stats.points,
          rank: stats.events > 0 || stats.points > 0 ? ranks.me.rank : null,
          total: ranks.total,
          needsBet: view.needsBet,
          next: next ? { ep: next.ep, releaseAt: next.releaseAt } : null,
        };
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
        throw e;
      }
    }),
  );
  return cards.filter((c) => c !== null);
}
